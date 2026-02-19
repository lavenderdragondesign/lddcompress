
import React, { useCallback } from 'react';

interface UploadZoneProps {
  onFilesSelected: (files: FileList) => void;
  disabled: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFilesSelected, disabled }) => {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  }, [onFilesSelected, disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      // Reset input so same file can be picked again
      e.target.value = '';
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`relative group w-full max-w-2xl h-80 border-2 border-dashed rounded-[3rem] flex flex-col items-center justify-center transition-all duration-500 shrink-0
        ${disabled ? 'opacity-40 cursor-not-allowed border-zinc-800' : 'cursor-pointer border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-500/[0.03] hover:shadow-[0_0_80px_rgba(16,185,129,0.05)]'}`}
    >
      <input
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.webp,.zip"
        onChange={handleChange}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <div className="flex flex-col items-center pointer-events-none p-12 text-center">
        <div className="w-20 h-20 bg-zinc-900 rounded-[2rem] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-500/10 transition-all duration-500 shadow-xl border border-zinc-800 group-hover:border-emerald-500/20">
          <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2 group-hover:text-emerald-500 transition-colors">Select or Drop Files</h3>
        <p className="text-white text-sm max-w-xs mx-auto leading-relaxed">
          PNG, JPG, WebP, or ZIP bundles.
          Automatic optimization while keeping original formats.
        </p>
        <div className="mt-8 flex gap-2">
           <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[9px] font-bold text-white uppercase tracking-widest group-hover:border-emerald-500/20 group-hover:text-emerald-400 transition-all">Optimization Active</span>
        </div>
      </div>
    </div>
  );
};

export default UploadZone;
