import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, ProcessingFile, ProcessedResult } from './types';
import UploadZone from './components/UploadZone';
import ProgressOverlay from './components/ProgressOverlay';
import FinishModal from './components/FinishModal';
import { initWorker, processWithWorker, prepareWorkerEnvironment } from './lib/worker';

declare const JSZip: any;

// Target slightly under 20MB to ensure Etsy acceptance
const ETSY_LIMIT = 19.90 * 1024 * 1024;

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    status: 'idle',
    progress: 0,
    currentFile: '',
    currentFileUrl: null,
    results: [],
    totalOriginalSize: 0,
    totalNewSize: 0,
    inputCount: 0,
    squeezeAttempt: 0,
    eta: null,
  });

  const [isSystemReady, setIsSystemReady] = useState(false);
  const workerPool = useRef<Worker[]>([]);
  const startTimeRef = useRef<number>(0);
  const workListRef = useRef<ProcessingFile[]>([]);

  // Pick a worker count that uses as much horsepower as possible without
  // freezing low-RAM machines. Browsers only expose coarse hints.
  const decideWorkerCount = () => {
    const cores = Math.max(1, navigator.hardwareConcurrency || 4);
    const mem = (navigator as any).deviceMemory as number | undefined; // GB-ish (Chrome/Edge)

    // Leave one core free for UI responsiveness on most systems.
    const uiReserve = cores >= 4 ? 1 : 0;
    const maxByCpu = Math.max(1, cores - uiReserve);

    let maxByMem: number;
    if (mem == null) {
      // Unknown RAM (Safari/Firefox): conservative but still fast.
      maxByMem = 6;
    } else if (mem <= 1) {
      maxByMem = 1;
    } else if (mem <= 2) {
      maxByMem = 2;
    } else if (mem <= 4) {
      maxByMem = 4;
    } else if (mem <= 8) {
      maxByMem = 8;
    } else if (mem <= 16) {
      maxByMem = 10;
    } else {
      maxByMem = 12;
    }

    return Math.max(1, Math.min(maxByCpu, maxByMem));
  };

  useEffect(() => {
    const initializePool = async () => {
      try {
        await prepareWorkerEnvironment();
        const count = decideWorkerCount();
        for (let i = 0; i < count; i++) {
          workerPool.current.push(initWorker());
        }
        setIsSystemReady(true);
      } catch (err) {
        console.error("Failed to initialize workers:", err);
        setState(prev => ({ ...prev, error: "Initialization failed. Check your connection." }));
      }
    };
    initializePool();
    return () => workerPool.current.forEach(w => w.terminate());
  }, []);

  const clearWorkListPreviews = () => {
    workListRef.current.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    workListRef.current = [];
  };

  const startProcessing = useCallback(async (rawFiles: FileList) => {
    if (!isSystemReady) return;

    const inputFiles = Array.from(rawFiles);
    const initialInputSize = inputFiles.reduce((acc, f) => acc + f.size, 0);

    clearWorkListPreviews();
    setState(prev => ({ 
      ...prev, 
      status: 'processing', 
      progress: 0, 
      results: [], 
      error: undefined, 
      eta: null, 
      currentFileUrl: null,
      totalOriginalSize: initialInputSize, // Track what the user actually uploaded
      inputCount: inputFiles.length
    }));
    
    startTimeRef.current = Date.now();
    const flattenedWorkList: ProcessingFile[] = [];
    // Nested ZIP support (zip -> zip -> image). Keeps names unique to avoid overwrites.
const usedNames = new Map<string, number>();

const makeUniqueName = (rawName: string) => {
  const safe = rawName.replace(/\\/g, '/').replace(/\//g, '__');
  const key = safe.toLowerCase();
  const n = usedNames.get(key) ?? 0;
  usedNames.set(key, n + 1);
  if (n === 0) return safe;
  // keep extension
  const m = safe.match(/^(.*?)(\.[a-z0-9]+)$/i);
  if (!m) return `${safe}__dup${n+1}`;
  return `${m[1]}__dup${n+1}${m[2]}`;
};

const pushImage = (displayName: string, data: ArrayBuffer, mimeType: string) => {
  const uniqueName = makeUniqueName(displayName);
  const blob = new Blob([data], { type: mimeType });
  flattenedWorkList.push({
    name: uniqueName,
    data,
    size: data.byteLength,
    previewUrl: URL.createObjectURL(blob),
    mimeType
  });
};

const isSupportedImageName = (n: string) => {
  const low = n.toLowerCase();
  return low.endsWith('.png') || low.endsWith('.jpg') || low.endsWith('.jpeg') || low.endsWith('.webp');
};

const isZipName = (n: string) => n.toLowerCase().endsWith('.zip');

const guessMime = (n: string) => {
  const low = n.toLowerCase();
  if (low.endsWith('.jpg') || low.endsWith('.jpeg')) return 'image/jpeg';
  if (low.endsWith('.webp')) return 'image/webp';
  return 'image/png';
};

const scanZip = async (zipObj: any, labelStack: string[], depth: number) => {
  // Safety caps to avoid zip-bomb style freezes on low-RAM systems
  const MAX_DEPTH = 4;
  if (depth > MAX_DEPTH) return;

  const files = Object.keys(zipObj.files);
  for (const zName of files) {
    const entry = zipObj.files[zName];
    if (!entry || entry.dir) continue;

    if (zName.startsWith('__MACOSX/') || zName.endsWith('.DS_Store')) continue;

    if (isSupportedImageName(zName)) {
      const data = await entry.async('arraybuffer');
      const mimeType = guessMime(zName);
      const prefix = labelStack.length ? labelStack.join('__') + '__' : '';
      pushImage(prefix + zName, data, mimeType);
    } else if (isZipName(zName)) {
      try {
        const nestedBytes = await entry.async('arraybuffer');
        const nestedZip = new JSZip();
        const nestedContent = await nestedZip.loadAsync(nestedBytes);
        const nestedLabel = (labelStack.length ? labelStack.join('__') + '__' : '') + zName;
        await scanZip(nestedContent, [nestedLabel], depth + 1);
      } catch (e) {
        // Skip unreadable/encrypted nested zips gracefully
        console.warn('Skipped nested zip:', zName, e);
      }
    }
  }
};


    try {
      for (const file of inputFiles) {
        const name = file.name.toLowerCase();
        
        if (name.endsWith('.zip')) {
          const zip = new JSZip();
          const content = await zip.loadAsync(file);

          // Includes nested zips (zip -> zip -> image)
          await scanZip(content, [file.name], 0);
        } else {
          const isSupportedImage = file.type.startsWith('image/') || 
                                 name.endsWith('.png') || 
                                 name.endsWith('.jpg') || 
                                 name.endsWith('.jpeg') || 
                                 name.endsWith('.webp');

          if (isSupportedImage) {
            const data = await file.arrayBuffer();
            const mimeType = file.type || (name.endsWith('.png') ? 'image/png' : (name.endsWith('.webp') ? 'image/webp' : 'image/jpeg'));
            const blob = new Blob([data], { type: mimeType });
            flattenedWorkList.push({ 
              name: file.name, 
              data, 
              size: file.size,
              previewUrl: URL.createObjectURL(blob),
              mimeType
            });
          }
        }
      }

      workListRef.current = flattenedWorkList;

      // Use the true image count (after ZIP extraction) for UI logic
      setState(prev => ({ ...prev, inputCount: flattenedWorkList.length }));

      if (flattenedWorkList.length === 0) {
        setState(prev => ({ ...prev, status: 'idle', error: 'No valid image files found.' }));
        return;
      }

      const pool = workerPool.current;
      const workerCount = pool.length;
      const chunks: ProcessingFile[][] = Array.from({ length: workerCount }, () => []);
      flattenedWorkList.forEach((file, index) => chunks[index % workerCount].push(file));

      const totalFiles = flattenedWorkList.length;
      let completedCount = 0;
      
      const processingPromises = chunks.map((chunk, i) => {
        if (chunk.length === 0) return Promise.resolve([]);
        return processWithWorker(pool[i], chunk, 256, (p, currentFile) => {
          const now = Date.now();
          const elapsed = (now - startTimeRef.current) / 1000;
          const currentBatchProgress = (completedCount / totalFiles) * 100;
          let eta = null;
          if (currentBatchProgress > 2) {
            eta = Math.round((elapsed / currentBatchProgress) * (100 - currentBatchProgress));
          }

          const sourceFile = workListRef.current.find(f => f.name === currentFile);
          setState(prev => ({ 
            ...prev, 
            currentFile, 
            eta, 
            currentFileUrl: sourceFile?.previewUrl || null 
          }));
        }).then(results => {
          completedCount += results.length;
          setState(prev => ({ ...prev, progress: (completedCount / totalFiles) * 100 }));
          return results;
        });
      });

      const allResults = (await Promise.all(processingPromises)).flat();
      const finalPackedSize = allResults.reduce((acc, f) => acc + f.data.length, 0);
      
      setState(prev => ({
        ...prev,
        status: 'done',
        results: allResults,
        totalNewSize: finalPackedSize,
        progress: 100,
        eta: 0,
        currentFileUrl: null
      }));

    } catch (err: any) {
      console.error('Processing Failure:', err);
      setState(prev => ({ ...prev, status: 'idle', error: `System Error: ${err.message}` }));
    }
  }, [isSystemReady]);

  const handleDownloadZip = async (results: ProcessedResult[]) => {
    if (results.length === 1) {
      triggerDownload(new Blob([results[0].data], { type: results[0].mimeType }), results[0].name);
      return;
    }

    // First Fit Decreasing to pack efficiently
    const sorted = [...results].sort((a, b) => b.data.length - a.data.length);
    const volumes: { zip: any; size: number }[] = [];
    
    for (const f of sorted) {
      let targetVol = volumes.find(v => v.size + f.data.length <= ETSY_LIMIT);
      if (!targetVol) {
        targetVol = { zip: new JSZip(), size: 0 };
        volumes.push(targetVol);
      }
      targetVol.zip.file(f.name, f.data);
      targetVol.size += f.data.length;
    }

    if (volumes.length === 1) {
      // USE DEFLATE TO ENSURE SAVINGS
      const blob = await volumes[0].zip.generateAsync({ 
        type: 'blob', 
        compression: 'DEFLATE',
        compressionOptions: { level: 6 } 
      });
      triggerDownload(blob, 'Etsy_Optimized_Pack.zip');
    } else {
      const master = new JSZip();
      for (let i = 0; i < volumes.length; i++) {
        const blob = await volumes[i].zip.generateAsync({ 
          type: 'blob', 
          compression: 'DEFLATE',
          compressionOptions: { level: 6 } 
        });
        master.file(`Part${i+1}of${volumes.length}.zip`, blob);
      }
      const masterBlob = await master.generateAsync({ type: 'blob', compression: 'STORE' });
      triggerDownload(masterBlob, 'Etsy_Art_Bundle_All_Parts.zip');
    }
  };

  const handleDownloadIndividuals = (results: ProcessedResult[]) => {
    results.forEach((res, i) => {
      setTimeout(() => {
        triggerDownload(new Blob([res.data], { type: res.mimeType }), res.name);
      }, i * 200);
    });
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div className="min-h-screen flex bg-[#020202] text-zinc-100 font-sans overflow-hidden">
      <main className="flex-1 flex flex-col items-center justify-start py-12 md:py-16 px-8 relative overflow-hidden scrollbar-hide">
        {/* User Logo Top Left */}
        <div className="absolute top-8 left-8 z-10 animate-in fade-in duration-1000">
           <div className="w-16 h-16 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)] bg-zinc-900">
             <img 
               src="/logo.png" 
               alt="Lavender Dragon Design" 
               className="w-full h-full object-cover"
               onError={(e) => {
                 (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/initials/svg?seed=LavenderDragonDesign&backgroundColor=10b981';
               }}
             />
           </div>
        </div>

        <div className="max-w-4xl w-full text-center mb-10 animate-in fade-in slide-in-from-top duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400 mb-6 shadow-2xl">
            <span className={`relative flex h-2 w-2`}>
              <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${isSystemReady ? 'animate-ping' : ''}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isSystemReady ? 'bg-emerald-500' : 'bg-zinc-700'}`}></span>
            </span>
            {isSystemReady ? 'Turbo Engine Primed' : 'Engine Warming...'}
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/25 rounded-full text-[11px] font-black uppercase tracking-[0.35em] text-yellow-300 mb-4 shadow-2xl">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" />
            Beta
          </div>

          <h1 className="text-4xl md:text-6xl font-black italic uppercase text-emerald-500 mb-2 leading-[0.9] flex flex-col items-center">
            <span className="text-white tracking-tighter">LavenderDragonDesign's</span>
            <span className="text-5xl md:text-7xl tracking-[0.05em] py-2 select-none">IMAGE COMPRESSOR</span>
            <span className="tracking-normal"> & ZIP SPLITTER</span>
          </h1>

          <p className="text-white text-xl md:text-2xl font-medium max-w-3xl mx-auto leading-relaxed mt-6">
            Professional image optimization & intelligent ZIP splitting. 
            Compressing JPG, WebP, and PNG into Etsy-ready bundles.
            <br/>
            <span className="text-white text-lg mt-4 block italic font-semibold leading-relaxed">
              This tool works best with upscaled and images resized to the final size needed for export. 
              This does not change resolution or size, just file size.
            </span>
          </p>
        </div>

        <UploadZone 
          onFilesSelected={startProcessing} 
          disabled={state.status === 'processing' || !isSystemReady} 
        />

        {state.error && (
          <div className="mt-8 p-5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl animate-in zoom-in duration-300">
            <p className="font-black uppercase tracking-widest text-[10px] mb-1 opacity-50">System Fault</p>
            <p className="font-medium text-sm">{state.error}</p>
          </div>
        )}
      </main>

      <aside className="w-96 bg-zinc-900/30 border-l border-zinc-800 p-8 flex flex-col justify-between shrink-0 overflow-hidden">
        <div className="space-y-12">
          <div>
            <h4 className="text-emerald-400 font-black uppercase tracking-[0.3em] text-xs mb-8 border-b border-emerald-500/20 pb-2">The Workflow</h4>
            <ul className="space-y-8">
              <li className="flex gap-6 items-start">
                <span className="text-white font-black italic text-4xl leading-none">01</span>
                <p className="text-sm text-white leading-relaxed font-medium">Drop PNG, JPG, or WebP files. Entire ZIPs are unpacked automatically.</p>
              </li>
              <li className="flex gap-6 items-start">
                <span className="text-white font-black italic text-4xl leading-none">02</span>
                <p className="text-sm text-white leading-relaxed font-medium">Massive parallel optimization using Warmed Workers to crunch pixels into 256-color palettes.</p>
              </li>
              <li className="flex gap-6 items-start">
                <span className="text-white font-black italic text-4xl leading-none">03</span>
                <p className="text-sm text-white leading-relaxed font-medium">Injects 300 DPI metadata for PNG/WebP (keeps transparency). JPG/JPEG are treated as 72 DPI (photo standard) — DPI is metadata only; pixel size is what matters.</p>
              </li>
              <li className="flex gap-6 items-start">
                <span className="text-white font-black italic text-4xl leading-none">04</span>
                <p className="text-sm text-white leading-relaxed font-medium">Intelligent bin-packing into multiple parts to respect Etsy's 20MB limit.</p>
              </li>
            </ul>
          </div>

          <div className="p-8 bg-zinc-950/50 rounded-[2rem] border border-zinc-800">
            <h4 className="text-white font-black text-sm mb-4 italic uppercase tracking-tighter">Format Support</h4>
            <div className="flex flex-wrap gap-2">
              {['PNG','JPG','WebP','ZIP'].map(t => (
                <span key={t} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-[10px] font-black text-white uppercase tracking-widest border border-zinc-700/50">{t}</span>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-left">
              <p className="text-[11px] text-white/90 font-semibold leading-relaxed">
                <span className="text-yellow-300 font-black uppercase tracking-widest mr-2">Heads up:</span>
                This is beta. With a lot of images (and depending on your computer specs), you may see bugs, crashes, or freezes. We’re optimizing it as we speak.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-zinc-800 mt-8 flex flex-col items-center gap-6 text-center">
          <div>
            <p className="text-[10px] text-white font-black uppercase tracking-[0.4em]">
              &copy; 2026 Lavender Dragon Design
            </p>
            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.1em] mt-1">
              Dev. By Andrea - Made With ❤️
            </p>
          </div>
          
          <a 
            href="https://lddtools.lol" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl font-black uppercase italic tracking-widest text-[10px] transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
          >
            Visit lddtools.lol
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </aside>

      {state.status === 'processing' && (
        <ProgressOverlay 
          progress={state.progress} 
          currentFile={state.currentFile} 
          currentFileUrl={state.currentFileUrl}
          squeezeAttempt={0}
          eta={state.eta}
        />
      )}

      {state.status === 'done' && (
        <FinishModal 
          originalSize={state.totalOriginalSize}
          newSize={state.totalNewSize}
          fileCount={state.inputCount || state.results.length}
          hasJpeg={state.results.some(r => r.mimeType === 'image/jpeg' || /\.jpe?g$/i.test(r.name))}
          hasNonJpeg={state.results.some(r => !(r.mimeType === 'image/jpeg' || /\.jpe?g$/i.test(r.name)))}
          onRestart={() => setState(prev => ({ ...prev, status: 'idle' }))}
          onDownloadZip={() => handleDownloadZip(state.results)}
          onDownloadIndividuals={() => handleDownloadIndividuals(state.results)}
          onClose={() => setState(prev => ({ ...prev, status: 'idle' }))}
        />
      )}
    </div>
  );
};

export default App;
