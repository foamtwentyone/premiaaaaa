// Чтение тегов ID3v2 из mp3: название, артист и встроенная обложка (APIC).
// Без зависимостей; поддерживаются версии 2.2, 2.3 и 2.4.

const syncsafe = (b, i) => (b[i] << 21) | (b[i + 1] << 14) | (b[i + 2] << 7) | b[i + 3];
const int32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const int24 = (b, i) => (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];

/** Снимает «unsynchronisation»: каждая пара 0xFF 0x00 превращается в 0xFF */
function unsync(bytes) {
  const out = [];
  for (let i = 0; i < bytes.length; i++) {
    out.push(bytes[i]);
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00) i++;
  }
  return Uint8Array.from(out);
}

function decodeText(enc, bytes) {
  const label = enc === 1 ? 'utf-16' : enc === 2 ? 'utf-16be' : enc === 3 ? 'utf-8' : 'windows-1251';
  // Латиница-1 в русских mp3 почти всегда на деле cp1251 — так кириллица не превращается в «кракозябры»
  return new TextDecoder(label).decode(bytes).replace(/\0+$/, '').split('\0')[0].trim();
}

/** Длина строки, завершённой нулём, с учётом кодировки (в UTF-16 терминатор — два байта) */
function zeroEnd(bytes, start, enc) {
  const wide = enc === 1 || enc === 2;
  for (let i = start; i < bytes.length; i += wide ? 2 : 1) {
    if (bytes[i] === 0 && (!wide || bytes[i + 1] === 0)) return i;
  }
  return bytes.length;
}

function parsePicture(body, v2) {
  const enc = body[0];
  let i = 1;
  let mime;
  if (v2) {
    // ID3v2.2: 3-символьный формат вместо MIME
    mime = new TextDecoder().decode(body.subarray(1, 4)).toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
    i = 4;
  } else {
    const end = zeroEnd(body, 1, 0);
    mime = new TextDecoder().decode(body.subarray(1, end)) || 'image/jpeg';
    if (!mime.includes('/')) mime = `image/${mime.toLowerCase() === 'png' ? 'png' : 'jpeg'}`;
    i = end + 1;
  }
  const type = body[i];
  const descEnd = zeroEnd(body, i + 1, enc);
  const data = body.subarray(descEnd + (enc === 1 || enc === 2 ? 2 : 1));
  return { type, mime, data };
}

/** Разбирает тег из начала файла. Возвращает { title, artist, picture: Blob|null } */
export function parseId3(buffer) {
  let b = new Uint8Array(buffer);
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return { title: '', artist: '', picture: null };
  const ver = b[3];
  const flags = b[5];
  const size = syncsafe(b, 6);
  let tag = b.subarray(10, 10 + size);
  if (flags & 0x80 && ver < 4) tag = unsync(tag);

  let pos = 0;
  if (flags & 0x40 && ver === 3) pos = 4 + int32(tag, 0); // расширенный заголовок
  if (flags & 0x40 && ver === 4) pos = syncsafe(tag, 0);

  const out = { title: '', artist: '', picture: null };
  let bestPic = null;
  const idLen = ver === 2 ? 3 : 4;
  const headLen = ver === 2 ? 6 : 10;

  while (pos + headLen <= tag.length) {
    const id = String.fromCharCode(...tag.subarray(pos, pos + idLen));
    if (!/^[A-Z0-9]+$/.test(id)) break; // дошли до padding
    const fsize = ver === 2 ? int24(tag, pos + 3) : ver === 4 ? syncsafe(tag, pos + 4) : int32(tag, pos + 4);
    const fflags = ver === 2 ? 0 : tag[pos + 9];
    let body = tag.subarray(pos + headLen, pos + headLen + fsize);
    pos += headLen + fsize;
    if (ver === 4 && fflags & 0x02) body = unsync(body);
    if (ver === 4 && fflags & 0x01) body = body.subarray(4); // data length indicator

    if (id === 'TIT2' || id === 'TT2') out.title = decodeText(body[0], body.subarray(1));
    else if (id === 'TPE1' || id === 'TP1') out.artist = decodeText(body[0], body.subarray(1));
    else if (id === 'APIC' || id === 'PIC') {
      const pic = parsePicture(body, ver === 2);
      // Предпочитаем лицевую обложку (тип 3), иначе первую попавшуюся
      if (!bestPic || (pic.type === 3 && bestPic.type !== 3)) bestPic = pic;
    }
  }
  if (bestPic?.data.length) out.picture = new Blob([bestPic.data], { type: bestPic.mime });
  return out;
}

/** Скачивает только тег (обычно первые сотни КБ), а не весь файл */
export async function readTags(url) {
  const head = await fetch(url, { headers: { Range: 'bytes=0-9' } });
  if (!head.ok) throw new Error(`Файл не найден (${head.status})`);
  const first = new Uint8Array(await head.arrayBuffer());
  // Сервер без поддержки Range отдал весь файл — разбираем его целиком
  if (first.length > 10) return parseId3(first.buffer);
  if (first[0] !== 0x49 || first[1] !== 0x44 || first[2] !== 0x33) return { title: '', artist: '', picture: null };
  const size = syncsafe(first, 6) + 10;
  const res = await fetch(url, { headers: { Range: `bytes=0-${size - 1}` } });
  return parseId3(await res.arrayBuffer());
}

/** «Artist - Title.mp3» → { artist, title } — запасной вариант, если тегов нет */
export function guessFromFilename(path) {
  const name = decodeURIComponent(path.split('/').pop()).replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  const m = name.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: name };
}
