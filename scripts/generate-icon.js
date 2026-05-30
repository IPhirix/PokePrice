'use strict'
const fs   = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 256
const CX = SIZE / 2
const CY = SIZE / 2

const RED   = [220,  50,  50, 255]
const WHITE = [248, 248, 248, 255]
const BLACK = [ 30,  30,  30, 255]
const CLEAR = [  0,   0,   0,   0]

const R_OUTER = 120
const R_INNER = 112
const BAND_H  = 14
const BTN_OUT = 30
const BTN_IN  = 22

function classify(x, y) {
  const dx = x - CX, dy = y - CY
  const r  = Math.sqrt(dx * dx + dy * dy)
  if (r > R_OUTER)               return CLEAR
  if (r > R_INNER)               return BLACK
  if (r <= BTN_IN)               return WHITE
  if (r <= BTN_OUT)              return BLACK
  if (Math.abs(dy) <= BAND_H)    return BLACK
  return dy < 0 ? RED : WHITE
}

function samplePixel(px, py) {
  const N = 3, N2 = N * N
  let rr = 0, gg = 0, bb = 0, aa = 0
  for (let sy = 0; sy < N; sy++)
    for (let sx = 0; sx < N; sx++) {
      const c = classify(px + (sx + 0.5) / N, py + (sy + 0.5) / N)
      rr += c[0]; gg += c[1]; bb += c[2]; aa += c[3]
    }
  return [rr / N2, gg / N2, bb / N2, aa / N2].map(Math.round)
}

function buildPNG() {
  const stride = SIZE * 4 + 1
  const raw = Buffer.alloc(SIZE * stride)
  for (let y = 0; y < SIZE; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < SIZE; x++) {
      const c = samplePixel(x, y)
      const i = y * stride + 1 + x * 4
      raw[i] = c[0]; raw[i + 1] = c[1]; raw[i + 2] = c[2]; raw[i + 3] = c[3]
    }
  }

  const compressed = zlib.deflateSync(raw)

  const crcTable = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    crcTable[n] = c
  }
  function crc32(buf) {
    let crc = 0xFFFFFFFF
    for (const b of buf) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8)
    return (~crc) >>> 0
  }
  function chunk(type, data) {
    const t = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])))
    return Buffer.concat([len, t, data, crcBuf])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8; ihdr[9] = 6

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function buildICO(pngBuf) {
  const hdr = Buffer.alloc(6)
  hdr.writeUInt16LE(0, 0); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(1, 4)
  const dir = Buffer.alloc(16)
  dir[0] = 0; dir[1] = 0; dir[2] = 0; dir[3] = 0
  dir.writeUInt16LE(1, 4); dir.writeUInt16LE(32, 6)
  dir.writeUInt32LE(pngBuf.length, 8)
  dir.writeUInt32LE(22, 12)
  return Buffer.concat([hdr, dir, pngBuf])
}

const assetsDir = path.join(__dirname, '..', 'assets')
fs.mkdirSync(assetsDir, { recursive: true })

const png = buildPNG()
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png)
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), buildICO(png))
console.log('✓ assets/icon.png and assets/icon.ico generated')
