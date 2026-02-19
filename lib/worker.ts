
import { ProcessingFile, ProcessedResult } from '../types';

const workerCode = `
  function calculateCRC(data) {
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

  function inject300DPI(buffer) {
    const insertPos = 33; 
    const physChunk = new Uint8Array([
      0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 46, 35, 0, 0, 46, 35, 1, 0, 0, 0, 0
    ]);
    const crc = calculateCRC(physChunk.slice(4, 17));
    const dv = new DataView(physChunk.buffer);
    dv.setUint32(17, crc);
    const newBuffer = new Uint8Array(buffer.length + physChunk.length);
    newBuffer.set(buffer.slice(0, insertPos), 0);
    newBuffer.set(physChunk, insertPos);
    newBuffer.set(buffer.slice(insertPos), insertPos + physChunk.length);
    return newBuffer;
  }

  async function processFile(file, paletteSize) {
    const isPng = file.mimeType === 'image/png' || file.name.toLowerCase().endsWith('.png');
    
    if (isPng) {
      const img = UPNG.decode(file.data);
      const rgba = UPNG.toRGBA8(img)[0];
      const compressed = UPNG.encode([rgba], img.width, img.height, paletteSize);
      const finalData = inject300DPI(new Uint8Array(compressed));
      return {
        name: file.name,
        data: finalData,
        originalSize: file.size,
        newSize: finalData.length,
        mimeType: 'image/png'
      };
    } else {
      // For non-PNG, we use OffscreenCanvas to re-encode to original format
      // This allows preserving the "file type" while applying standard optimization
      const blob = new Blob([file.data], { type: file.mimeType });
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      
      const quality = 0.92; // High quality for Etsy print-ready, but still optimized
      const outputBlob = await canvas.convertToBlob({ 
        type: file.mimeType, 
        quality: quality 
      });
      const arrayBuffer = await outputBlob.arrayBuffer();
      const finalData = new Uint8Array(arrayBuffer);
      
      return {
        name: file.name,
        data: finalData,
        originalSize: file.size,
        newSize: finalData.length,
        mimeType: file.mimeType
      };
    }
  }

  self.onmessage = async function(e) {
    const { files, paletteSize } = e.data;
    const results = [];
    const transferList = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        self.postMessage({ type: 'PROGRESS', payload: { 
          progress: (i / files.length) * 100, 
          currentFile: file.name 
        }});

        const processed = await processFile(file, paletteSize);
        
        results.push(processed);
        transferList.push(processed.data.buffer);
      } catch (err) {
        console.error('Worker error:', file.name, err);
        // Fallback: return original if error
        results.push({
          name: file.name,
          data: new Uint8Array(file.data),
          originalSize: file.size,
          newSize: file.size,
          mimeType: file.mimeType
        });
        transferList.push(file.data);
      }
    }

    self.postMessage({ type: 'DONE', payload: results }, transferList);
  };
`;

let workerUrl: string | null = null;
let librarySource: string | null = null;

async function fetchLib(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load library: ${url}`);
  return res.text();
}

export async function prepareWorkerEnvironment() {
  if (workerUrl) return;

  const [pako, upng] = await Promise.all([
    fetchLib('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js'),
    fetchLib('https://cdn.jsdelivr.net/npm/upng-js@2.1.0/UPNG.min.js')
  ]);

  librarySource = `
    var window = self;
    ${pako}
    ${upng}
    ${workerCode}
  `;

  const blob = new Blob([librarySource], { type: 'application/javascript' });
  workerUrl = URL.createObjectURL(blob);
}

export function initWorker() {
  if (!workerUrl) {
    throw new Error("Worker environment not prepared. Call prepareWorkerEnvironment first.");
  }
  return new Worker(workerUrl);
}

export async function processWithWorker(
  worker: Worker,
  files: ProcessingFile[],
  paletteSize: number,
  onProgress: (p: number, f: string) => void
): Promise<ProcessedResult[]> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'PROGRESS') {
        onProgress(payload.progress, payload.currentFile);
      } else if (type === 'DONE') {
        resolve(payload);
      }
    };
    worker.onerror = (err) => reject(err);
    
    const transfers = files.map(f => f.data);
    worker.postMessage({ files, paletteSize }, transfers);
  });
}
