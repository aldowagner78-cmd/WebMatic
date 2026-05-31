/**
 * Genera icon.ico y icon.png para electron-builder
 * usando solo módulos de Node built-in (sin dependencias externas).
 * Crea un ICO con una sola imagen 256x256 en formato BMP embebido.
 */
const fs   = require("fs");
const path = require("path");

// ── Paleta de colores ─────────────────────────────────────────────
const BG     = [30,  30,  46];   // #1e1e2e  fondo oscuro
const ACCENT = [137, 180, 250];  // #89b4fa  azul Catppuccin
const WHITE  = [205, 214, 244];  // #cdd6f4  texto claro

const SIZE = 256;

// ── Canvas de pixels RGBA ─────────────────────────────────────────
const pixels = Buffer.alloc(SIZE * SIZE * 4, 0);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const off = (y * SIZE + x) * 4;
  pixels[off]     = r;
  pixels[off + 1] = g;
  pixels[off + 2] = b;
  pixels[off + 3] = a;
}

function fillCircle(cx, cy, r, col) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x-cx)**2 + (y-cy)**2 <= r*r) setPixel(x, y, ...col);
}

function fillRect(x0, y0, w, h, col) {
  for (let y = y0; y < y0+h; y++)
    for (let x = x0; x < x0+w; x++) setPixel(x, y, ...col);
}

// Fondo circular
fillCircle(128, 128, 120, BG);

// Letra "W" estilizada centrada
const pts = [
  // trazo izquierdo bajada
  [72, 70, 14, 80, ACCENT],
  // trazo derecha bajada
  [170, 70, 14, 80, ACCENT],
  // diagonal centro-izq subida
  [86, 150, 14, 40, ACCENT],
  // diagonal centro-der subida
  [156, 150, 14, 40, ACCENT],
  // trazo centro bajada izq
  [114, 110, 14, 50, ACCENT],
  // trazo centro bajada der
  [128, 110, 14, 50, ACCENT],
];

// Dibujar "W" como 5 barras diagonales aproximadas
function drawLine(x0, y0, x1, y1, thick, col) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + dx * i / steps);
    const y = Math.round(y0 + dy * i / steps);
    fillCircle(x, y, thick, col);
  }
}

const t = 9; // grosor
drawLine( 72,  68,  95, 170, t, ACCENT); // pata izq
drawLine(184,  68, 161, 170, t, ACCENT); // pata der
drawLine( 95, 170, 128, 100, t, ACCENT); // diagonal izq-centro
drawLine(161, 170, 128, 100, t, ACCENT); // diagonal der-centro

// Punto naranja abajo como detalle
fillCircle(128, 185, 8, [250, 179, 135]);

// ── Escribir PNG (formato mínimo sin libpng, usando raw + zlib) ───
const zlib = require("zlib");

function writePng(pixels, size, outPath) {
  const PNG_SIG = Buffer.from([137,80,78,71,13,10,26,10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // CRC32
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw scanlines (filtro 0 por fila)
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size*4)] = 0; // filtro None
    pixels.copy(raw, y*(1+size*4)+1, y*size*4, (y+1)*size*4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const out = Buffer.concat([
    PNG_SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(outPath, out);
  console.log("PNG generado:", outPath, out.length, "bytes");
}

// ── Escribir ICO (encabezado + BMP 32-bit) ────────────────────────
function writeIco(pixels, size, outPath) {
  // ICO con una sola imagen 256x256
  const bmpDataSize = size * size * 4;
  const bmpHeaderSize = 40;
  const totalBmpSize = bmpHeaderSize + bmpDataSize;

  // ICO header (6 bytes) + 1 directory entry (16 bytes)
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0);  // reserved
  icoHeader.writeUInt16LE(1, 2);  // type: icon
  icoHeader.writeUInt16LE(1, 4);  // count: 1

  const dirEntry = Buffer.alloc(16);
  dirEntry[0] = 0;    // width: 0 = 256
  dirEntry[1] = 0;    // height: 0 = 256
  dirEntry[2] = 0;    // color count
  dirEntry[3] = 0;    // reserved
  dirEntry.writeUInt16LE(1,  4);  // planes
  dirEntry.writeUInt16LE(32, 6);  // bit count
  dirEntry.writeUInt32LE(totalBmpSize, 8);   // size of image data
  dirEntry.writeUInt32LE(6 + 16, 12);        // offset (after header+dir)

  // BMP INFOHEADER (40 bytes)
  const bmpHeader = Buffer.alloc(40);
  bmpHeader.writeUInt32LE(40,          0);  // header size
  bmpHeader.writeInt32LE(size,         4);  // width
  bmpHeader.writeInt32LE(size * 2,     8);  // height * 2 (ICO convention)
  bmpHeader.writeUInt16LE(1,          12);  // planes
  bmpHeader.writeUInt16LE(32,         14);  // bits per pixel
  bmpHeader.writeUInt32LE(0,          16);  // compression: none
  bmpHeader.writeUInt32LE(bmpDataSize,20);  // image size
  bmpHeader.writeInt32LE(0,           24);  // x pixels per meter
  bmpHeader.writeInt32LE(0,           28);  // y pixels per meter
  bmpHeader.writeUInt32LE(0,          32);  // colors used
  bmpHeader.writeUInt32LE(0,          36);  // important colors

  // BMP pixels (bottom-up, BGRA)
  const bmpPixels = Buffer.alloc(bmpDataSize);
  for (let y = 0; y < size; y++) {
    const srcRow = (size - 1 - y);  // flip vertical
    for (let x = 0; x < size; x++) {
      const src = (srcRow * size + x) * 4;
      const dst = (y * size + x) * 4;
      bmpPixels[dst]   = pixels[src+2]; // B
      bmpPixels[dst+1] = pixels[src+1]; // G
      bmpPixels[dst+2] = pixels[src];   // R
      bmpPixels[dst+3] = pixels[src+3]; // A
    }
  }

  const out = Buffer.concat([icoHeader, dirEntry, bmpHeader, bmpPixels]);
  fs.writeFileSync(outPath, out);
  console.log("ICO generado:", outPath, out.length, "bytes");
}

const buildDir = __dirname;
writePng(pixels, SIZE, path.join(buildDir, "icon.png"));
writeIco(pixels, SIZE, path.join(buildDir, "icon.ico"));
console.log("Iconos generados correctamente.");
