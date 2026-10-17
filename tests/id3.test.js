import test from 'node:test';
import assert from 'node:assert/strict';
import { parseId3, guessFromFilename } from '../src/lib/id3.js';

// Сборка тега ID3v2 вручную
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const safe = (n) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const utf16 = (s) => [0xff, 0xfe, ...[...s].flatMap((c) => [c.charCodeAt(0) & 255, c.charCodeAt(0) >> 8])];

function tag(ver, frames) {
  const body = frames.flatMap(([id, data]) => [...ascii(id), ...(ver === 4 ? safe(data.length) : be32(data.length)), 0, 0, ...data]);
  return Uint8Array.from([...ascii('ID3'), ver, 0, 0, ...safe(body.length), ...body]).buffer;
}

test('ID3v2.3: UTF-16 текст и лицевая обложка', () => {
  const pic = (type, bytes) => [1, ...ascii('image/jpeg'), 0, type, 0xff, 0xfe, 0, 0, ...bytes];
  const r = parseId3(tag(3, [
    ['TIT2', [1, ...utf16('Летать')]],
    ['TPE1', [1, ...utf16('Дима Космос')]],
    ['APIC', pic(4, [9, 9])],
    ['APIC', pic(3, [1, 2, 3])],
  ]));
  assert.equal(r.title, 'Летать');
  assert.equal(r.artist, 'Дима Космос');
  assert.equal(r.picture.type, 'image/jpeg');
  assert.equal(r.picture.size, 3);
});

test('ID3v2.4: UTF-8 и cp1251 в latin1-полях', () => {
  const r = parseId3(tag(4, [
    ['TIT2', [3, ...new TextEncoder().encode('Пиксели')]],
    ['TPE1', [0, 0xc0, 0xed, 0xff]], // «Аня» в cp1251
  ]));
  assert.equal(r.title, 'Пиксели');
  assert.equal(r.artist, 'Аня');
  assert.equal(r.picture, null);
});

test('файл без тегов', () => {
  assert.deepEqual(parseId3(new Uint8Array([0xff, 0xfb, 0x90, 0, 0, 0, 0, 0, 0, 0, 0]).buffer), { title: '', artist: '', picture: null });
});

test('имя файла «Артист - Название»', () => {
  assert.deepEqual(guessFromFilename('/tracks/' + encodeURI('GUMMY - Сахарная вата.mp3')), { artist: 'GUMMY', title: 'Сахарная вата' });
  assert.deepEqual(guessFromFilename('/tracks/my_song.mp3'), { artist: '', title: 'my song' });
});
