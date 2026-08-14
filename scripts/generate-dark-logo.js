'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function processPng(srcPath, destPath) {
  const buf = fs.readFileSync(srcPath);
  let offset = 8; // skip PNG signature

  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  let idatBuffers = [];
  let otherChunksBefore = [];
  let otherChunksAfter = [];
  let foundIdat = false;

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      foundIdat = true;
      idatBuffers.push(data);
    } else if (type === 'IEND') {
      break;
    } else {
      if (!foundIdat) otherChunksBefore.push({ type, data });
      else otherChunksAfter.push({ type, data });
    }
  }

  console.log(`PNG Info: ${width}x${height}, bitDepth: ${bitDepth}, colorType: ${colorType}`);

  const compressedData = Buffer.concat(idatBuffers);
  const rawData = zlib.inflateSync(compressedData);

  const bytesPerPixel = 4; // Assuming RGBA (colorType 6)
  const scanlineLength = 1 + width * bytesPerPixel;
  const uncompressed = Buffer.alloc(rawData.length);

  // Simple unfilter assuming no complex filters or filter 0/1/2
  // We unfilter row by row
  let prevRow = Buffer.alloc(width * bytesPerPixel);
  let curRow = Buffer.alloc(width * bytesPerPixel);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    const filterType = rawData[rowOffset];
    uncompressed[rowOffset] = 0; // we will output filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const srcIdx = rowOffset + 1 + x * bytesPerPixel;
      const dstIdx = rowOffset + 1 + x * bytesPerPixel;

      let r = rawData[srcIdx];
      let g = rawData[srcIdx + 1];
      let b = rawData[srcIdx + 2];
      let a = rawData[srcIdx + 3];

      // Handle unfiltering
      if (filterType === 1) { // Sub
        if (x > 0) {
          r = (r + curRow[(x - 1) * bytesPerPixel]) & 0xff;
          g = (g + curRow[(x - 1) * bytesPerPixel + 1]) & 0xff;
          b = (b + curRow[(x - 1) * bytesPerPixel + 2]) & 0xff;
          a = (a + curRow[(x - 1) * bytesPerPixel + 3]) & 0xff;
        }
      } else if (filterType === 2) { // Up
        r = (r + prevRow[x * bytesPerPixel]) & 0xff;
        g = (g + prevRow[x * bytesPerPixel + 1]) & 0xff;
        b = (b + prevRow[x * bytesPerPixel + 2]) & 0xff;
        a = (a + prevRow[x * bytesPerPixel + 3]) & 0xff;
      } else if (filterType === 3) { // Average
        const leftR = x > 0 ? curRow[(x - 1) * bytesPerPixel] : 0;
        const leftG = x > 0 ? curRow[(x - 1) * bytesPerPixel + 1] : 0;
        const leftB = x > 0 ? curRow[(x - 1) * bytesPerPixel + 2] : 0;
        const leftA = x > 0 ? curRow[(x - 1) * bytesPerPixel + 3] : 0;
        const upR = prevRow[x * bytesPerPixel];
        const upG = prevRow[x * bytesPerPixel + 1];
        const upB = prevRow[x * bytesPerPixel + 2];
        const upA = prevRow[x * bytesPerPixel + 3];
        r = (r + Math.floor((leftR + upR) / 2)) & 0xff;
        g = (g + Math.floor((leftG + upG) / 2)) & 0xff;
        b = (b + Math.floor((leftB + upB) / 2)) & 0xff;
        a = (a + Math.floor((leftA + upA) / 2)) & 0xff;
      } else if (filterType === 4) { // Paeth
        const paeth = (a, b, c) => {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          if (pa <= pb && pa <= pc) return a;
          if (pb <= pc) return b;
          return c;
        };
        const leftR = x > 0 ? curRow[(x - 1) * bytesPerPixel] : 0;
        const leftG = x > 0 ? curRow[(x - 1) * bytesPerPixel + 1] : 0;
        const leftB = x > 0 ? curRow[(x - 1) * bytesPerPixel + 2] : 0;
        const leftA = x > 0 ? curRow[(x - 1) * bytesPerPixel + 3] : 0;
        const upR = prevRow[x * bytesPerPixel];
        const upG = prevRow[x * bytesPerPixel + 1];
        const upB = prevRow[x * bytesPerPixel + 2];
        const upA = prevRow[x * bytesPerPixel + 3];
        const upLeftR = x > 0 ? prevRow[(x - 1) * bytesPerPixel] : 0;
        const upLeftG = x > 0 ? prevRow[(x - 1) * bytesPerPixel + 1] : 0;
        const upLeftB = x > 0 ? prevRow[(x - 1) * bytesPerPixel + 2] : 0;
        const upLeftA = x > 0 ? prevRow[(x - 1) * bytesPerPixel + 3] : 0;
        r = (r + paeth(leftR, upR, upLeftR)) & 0xff;
        g = (g + paeth(leftG, upG, upLeftG)) & 0xff;
        b = (b + paeth(leftB, upB, upLeftB)) & 0xff;
        a = (a + paeth(leftA, upA, upLeftA)) & 0xff;
      }

      curRow[x * bytesPerPixel] = r;
      curRow[x * bytesPerPixel + 1] = g;
      curRow[x * bytesPerPixel + 2] = b;
      curRow[x * bytesPerPixel + 3] = a;

      // Color transformation:
      // Red icon check: Red dominates strongly
      const isRed = r > 130 && g < 80 && b < 80;
      
      // White/light grey text check
      const isLightText = a > 20 && !isRed && (r > 120 && g > 120 && b > 120);

      if (isLightText) {
        // Invert to dark charcoal (#1a202c / #111827)
        // Keep subtle shading if anti-aliased
        const lightness = (r + g + b) / (3 * 255);
        // Map 1.0 (pure white) to dark charcoal (20, 25, 35)
        const darkR = Math.round(20 * lightness);
        const darkG = Math.round(25 * lightness);
        const darkB = Math.round(35 * lightness);

        uncompressed[dstIdx] = darkR;
        uncompressed[dstIdx + 1] = darkG;
        uncompressed[dstIdx + 2] = darkB;
        uncompressed[dstIdx + 3] = a;
      } else {
        uncompressed[dstIdx] = r;
        uncompressed[dstIdx + 1] = g;
        uncompressed[dstIdx + 2] = b;
        uncompressed[dstIdx + 3] = a;
      }
    }

    prevRow.set(curRow);
  }

  const newIdat = zlib.deflateSync(uncompressed, { level: 9 });

  // Build PNG Buffer
  const outBuffers = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];

  function writeChunk(type, data) {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const chunkData = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(chunkData), 0);
    outBuffers.push(lenBuf, typeBuf, data, crcBuf);
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = bitDepth;
  ihdrData[9] = colorType;
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  writeChunk('IHDR', ihdrData);

  for (const c of otherChunksBefore) writeChunk(c.type, c.data);
  writeChunk('IDAT', newIdat);
  for (const c of otherChunksAfter) writeChunk(c.type, c.data);
  writeChunk('IEND', Buffer.alloc(0));

  const finalBuf = Buffer.concat(outBuffers);
  fs.writeFileSync(destPath, finalBuf);
  console.log(`Saved dark logo to ${destPath} (${finalBuf.length} bytes)`);
}

processPng(
  path.join(__dirname, '../assets/mtb-breakers-logo.png'),
  path.join(__dirname, '../assets/mtb-breakers-logo-dark.png')
);
