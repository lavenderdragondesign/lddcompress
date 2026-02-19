import React from 'react';

interface FinishModalProps {
  originalSize: number;
  newSize: number;
  fileCount: number;
  hasJpeg: boolean;
  hasNonJpeg: boolean;
  onRestart: () => void;
  onDownloadZip: () => void;
  onDownloadIndividuals: () => void;
  onClose: () => void;
}

const formatSize = (bytes: number) => {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const FinishModal: React.FC<FinishModalProps> = ({ 
  originalSize, 
  newSize, 
  fileCount, 
  hasJpeg,
  hasNonJpeg,
  onRestart,
  onDownloadZip,
  onDownloadIndividuals,
  onClose
}) => {
  // Calculate savings accurately
  const savedSize = Math.max(0, originalSize - newSize);
  const savedPercent = originalSize > 0 ? Math.round((savedSize / originalSize) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] relative animate-in zoom-in-95 duration-500">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-white hover:text-emerald-500 transition-colors p-2 z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="bg-emerald-500 p-10 text-zinc-950 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.4)_0%,transparent_60%)] animate-pulse"></div>
          </div>
          <h2 className="text-6xl font-black italic uppercase tracking-tighter mb-2 leading-none">Space Saved</h2>
          <div className="text-xl font-black uppercase tracking-widest opacity-80">{formatSize(savedSize)} RECLAIMED</div>
        </div>

        <div className="p-10">
          <div className="grid grid-cols-2 gap-5 mb-10">
            <div className="bg-zinc-800/40 p-6 rounded-3xl border border-zinc-800/50">
              <p className="text-[10px] text-white uppercase font-black tracking-widest mb-2">Processed</p>
              <p className="text-2xl font-black text-white">{fileCount} <span className="text-sm opacity-50">Files</span></p>
            </div>
            <div className="bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/20">
              <p className="text-[10px] text-emerald-500 uppercase font-black tracking-widest mb-2">Efficiency</p>
              <p className="text-2xl font-black text-emerald-400">-{savedPercent}%</p>
            </div>
          </div>

          <div className="space-y-4 mb-10 text-xs font-medium">
            <div className="flex justify-between py-4 border-b border-zinc-800/50 items-center">
              <span className="text-white uppercase tracking-widest text-[10px] font-bold">Original Size</span>
              <span className="text-2xl font-black text-white">{formatSize(originalSize)}</span>
            </div>
            <div className="flex justify-between py-4 border-b border-zinc-800/50 items-center">
              <span className="text-white uppercase tracking-widest text-[10px] font-bold">Compressed Total</span>
              <span className="text-2xl font-black text-white">{formatSize(newSize)}</span>
            </div>
            <div className="flex justify-between py-4 items-center">
              <span className="text-white uppercase tracking-widest text-[10px] font-bold">Resolution Status</span>
              <span className="text-2xl font-black text-emerald-500 uppercase tracking-tighter shadow-emerald-500/20">{hasJpeg ? (hasNonJpeg ? 'PNG: 300 DPI • JPG: 72 DPI' : 'VERIFIED 72 DPI') : 'VERIFIED 300 DPI'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onDownloadZip}
              className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black italic uppercase tracking-widest rounded-2xl transition-all hover:scale-[1.02] shadow-[0_10px_30px_rgba(16,185,129,0.2)] flex flex-col items-center justify-center"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Zipped Bundle</span>
              </div>
              <span className="text-[10px] mt-1 opacity-80 not-italic">⭐ RECOMMENDED ⭐</span>
            </button>
            
            <div className="space-y-2">
              <button
                onClick={onDownloadIndividuals}
                className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black italic uppercase tracking-widest rounded-2xl transition-all border border-zinc-700/50 flex flex-col items-center justify-center text-xs"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download Individual Images</span>
                </div>
                <span className="text-[8px] mt-0.5 opacity-50 not-italic">(MESSY & CLUTTERED)</span>
              </button>
            </div>

            <button
              onClick={onRestart}
              className="w-full py-4 text-white hover:text-emerald-500 font-bold uppercase tracking-[0.2em] text-[10px] transition-colors mt-2"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinishModal;
