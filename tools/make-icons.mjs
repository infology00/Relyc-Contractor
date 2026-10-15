/* Rasterise the Relyc mark to PNG/ICO without any image dependency.
   The mark is a polygon plus a rectangular counter, so a scanline
   even-odd fill with 4x supersampling is all we need. */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];

// Mark geometry in a 40x40 box (matches favicon.svg / header mark)
const OUTER = [
  [8, 6], [27, 6], [31, 10], [31, 17], [27, 21], [24.5, 21],
  [32, 34], [23.5, 34], [16, 21], [14, 21], [14, 34], [8, 34]
];
const COUNTER = [[14, 11], [23, 11], [23, 16], [14, 16]];

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex('#05070A');
const FG = hex('#E39B26');

function render(size, radiusRatio) {
  const S = 4; // supersample factor
  const px = Buffer.alloc(size * size * 4);
  const r = size * radiusRatio;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0, bgHits = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const fx = x + (sx + 0.5) / S;
          const fy = y + (sy + 0.5) / S;

          // rounded-square background coverage
          let inBg = true;
          const cx = Math.min(Math.max(fx, r), size - r);
          const cy = Math.min(Math.max(fy, r), size - r);
          const dx = fx - cx, dy = fy - cy;
          if (dx * dx + dy * dy > r * r) inBg = false;
          if (inBg) bgHits++;

          // mark coverage, mapped from the 40-unit design box
          const mx = (fx / size) * 40;
          const my = (fy / size) * 40;
          if (inBg && inside(OUTER, mx, my) && !inside(COUNTER, mx, my)) hits++;
        }
      }
      const total = S * S;
      const aBg = bgHits / total;
      const aFg = hits / total;
      const i = (y * size + x) * 4;
      // composite mark over background, then background over transparency
      const mix = (c) => Math.round((BG[c] * (aBg - aFg) + FG[c] * aFg) / (aBg || 1));
      px[i] = mix(0); px[i + 1] = mix(1); px[i + 2] = mix(2);
      px[i + 3] = Math.round(aBg * 255);
    }
  }
  return px;
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const crcTable = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc = (buf) => {
    let c = -1;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ICO wrapping PNG payloads (supported since Windows Vista) */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach((e, i) => {
    const o = i * 16;
    dir[o] = e.size >= 256 ? 0 : e.size;
    dir[o + 1] = e.size >= 256 ? 0 : e.size;
    dir[o + 2] = 0; dir[o + 3] = 0;
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(e.data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.data.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.data)]);
}

const touch = png(180, render(180, 0.0)); // iOS masks its own corners
writeFileSync(join(OUT, 'apple-touch-icon.png'), touch);

const p512 = png(512, render(512, 0.175));
writeFileSync(join(OUT, 'icon-512.png'), p512);
writeFileSync(join(OUT, 'icon-192.png'), png(192, render(192, 0.175)));
writeFileSync(join(OUT, 'mark-256.png'), png(256, render(256, 0.175)));

const sizes = [16, 32, 48];
writeFileSync(join(OUT, 'favicon.ico'),
  ico(sizes.map((s) => ({ size: s, data: png(s, render(s, 0.16)) }))));

console.log('icons written to', OUT);
