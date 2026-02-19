
import React from 'react';

interface ProgressOverlayProps {
  progress: number;
  currentFile: string;
  currentFileUrl: string | null;
  squeezeAttempt: number;
  eta: number | null;
}

const formatETA = (seconds: number) => {
  if (seconds < 60) return `${seconds}s remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s remaining`;
};

const ProgressOverlay: React.FC<ProgressOverlayProps> = ({ progress, currentFile, currentFileUrl, eta }) => {
  const radius = 90;
  const stroke = 12;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="fixed inset-0 z-50 bg-[#020202]/98 flex items-center justify-center backdrop-blur-3xl animate-in fade-in duration-500">
      <div className="flex flex-col items-center w-full max-w-xl px-12">
        <div className="relative flex items-center justify-center mb-12">
          {/* Progress Ring */}
          <svg
            height={radius * 2}
            width={radius * 2}
            viewBox={`0 0 ${radius * 2} ${radius * 2}`}
            className="transform -rotate-90 drop-shadow-[0_0_40px_rgba(16,185,129,0.4)]"
          >
            <circle
              stroke="currentColor"
              fill="transparent"
              strokeWidth={stroke}
              className="text-zinc-900"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            <circle
              stroke="currentColor"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
              className="text-emerald-500"
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
          </svg>
          
          {/* Centered Image Preview or Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            {currentFileUrl ? (
              <img 
                src={currentFileUrl} 
                alt="Processing Preview" 
                className="w-24 h-24 object-contain rounded-xl shadow-2xl animate-in zoom-in duration-300"
              />
            ) : (
              <span className="text-6xl font-black font-mono tracking-tighter text-emerald-500">
                {Math.round(progress)}<span className="text-2xl opacity-50">%</span>
              </span>
            )}
          </div>
        </div>

        <div className="text-center w-full space-y-4">
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">
            Compressing & Zipping
          </h2>
          
          <div className="flex flex-col items-center gap-1">
            <span className="text-emerald-500 text-3xl font-black font-mono tracking-tighter">
              {Math.round(progress)}%
            </span>
            {eta !== null && (
              <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                {formatETA(eta)}
              </p>
            )}
          </div>

          <div className="h-6 overflow-hidden max-w-sm mx-auto mt-4">
             <p className="text-white text-[10px] font-mono uppercase tracking-[0.2em] truncate opacity-80" title={currentFile}>
              {currentFile || 'Injecting Engine...'}
            </p>
          </div>
          
          <div className="pt-8 flex gap-3 justify-center">
            <div className="w-1.5 h-1.5 bg-emerald-500/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-emerald-500/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-emerald-500/40 rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressOverlay;
