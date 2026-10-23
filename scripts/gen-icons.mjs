// Generates PNG icons for the PWA manifest without any native dependencies.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x / size, y / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
// Boombox glyph painter in normalized coords.
function paint(u, v) {
  const inRect = (x, y, w, h) => u >= x && u <= x + w && v >= y && v <= y + h;
  const dist = (cx, cy) => Math.hypot(u - cx, v - cy);
  let c = [10, 10, 12, 255];
  if (inRect(0.125, 0.34, 0.75, 0.38)) c = [255, 122, 26, 255];
  if (inRect(0.145, 0.365, 0.71, 0.33)) c = [28, 28, 34, 255];
  if (inRect(0.235, 0.27, 0.53, 0.05)) c = [255, 122, 26, 255];
  for (const cx of [0.3125, 0.6875]) {
    const d = dist(cx, 0.53);
    if (d < 0.12) c = [255, 209, 102, 255];
    if (d < 0.1) c = [10, 10, 12, 255];
    if (d < 0.04) c = [255, 122, 26, 255];
  }
  if (inRect(0.42, 0.4, 0.16, 0.04)) c = [255, 209, 102, 255];
  if (inRect(0.42, 0.48, 0.16, 0.025)) c = [85, 85, 85, 255];
  if (inRect(0.42, 0.53, 0.16, 0.025)) c = [85, 85, 85, 255];
  return c;
}
mkdirSync('public/icons', { recursive: true });
for (const s of [192, 512]) writeFileSync(`public/icons/icon-${s}.png`, png(s, paint));
console.log('icons generated');
