
/**
 * Injects a pHYs chunk into a PNG buffer to set the resolution to 300 DPI.
 * 300 DPI = 11811 pixels per meter.
 */
export function inject300DPI(buffer: Uint8Array): Uint8Array {
  const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
  
  // Verify PNG signature
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== PNG_SIGNATURE[i]) return buffer;
  }

  // pHYs chunk: length (4), type (4), data (9), CRC (4) = 21 bytes
  // Data for 300 DPI:
  // X: 11811 (0x00002E23)
  // Y: 11811 (0x00002E23)
  // Unit: 1 (meters)
  const physChunk = new Uint8Array([
    0, 0, 0, 9,             // Length: 9
    112, 72, 89, 115,       // Type: pHYs
    0, 0, 46, 35,           // X: 11811
    0, 0, 46, 35,           // Y: 11811
    1,                      // Unit: meters
    0, 0, 0, 0              // CRC (placeholder)
  ]);

  // Calculate CRC for pHYs chunk
  const crc = calculateCRC(physChunk.slice(4, 17));
  const crcView = new DataView(physChunk.buffer, physChunk.byteOffset + 17, 4);
  crcView.setUint32(0, crc);

  // The pHYs chunk should come after IHDR (which starts at byte 8)
  // IHDR is usually 13 bytes data + 12 bytes overhead = 25 bytes.
  // Signature (8) + IHDR (25) = 33 bytes.
  const insertPos = 33;
  
  const newBuffer = new Uint8Array(buffer.length + physChunk.length);
  newBuffer.set(buffer.slice(0, insertPos), 0);
  newBuffer.set(physChunk, insertPos);
  newBuffer.set(buffer.slice(insertPos), insertPos + physChunk.length);
  
  return newBuffer;
}

// Simple CRC32 implementation
function calculateCRC(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
