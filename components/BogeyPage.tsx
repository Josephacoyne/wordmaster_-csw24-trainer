
import React from 'react';
import { WordEntry, AppMode } from '../types';

interface BogeyPageProps {
  word: WordEntry;
  sourceMode: AppMode;
  onContinue: (targetMode: AppMode) => void;
}

const BogeyPage: React.FC<BogeyPageProps> = ({ word, sourceMode, onContinue }) => {
  const isTrainingSource = sourceMode === AppMode.TRAINING;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-red-600 p-6 flex items-center justify-center flex-col gap-2">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Missed It!</h2>
        </div>

        <div className="p-8 flex flex-col items-center gap-8">
            <div className="w-24 h-32 bg-indigo-100 border-b-8 border-indigo-600 rounded-2xl flex items-center justify-center relative shadow-lg">
                <span className="tile-font text-5xl text-indigo-900">{word.w}</span>
            </div>

            <div className="text-center space-y-4 w-full">
                <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Meaning</p>
                    <p className="text-slate-800 text-xl sm:text-2xl serif-font italic leading-tight">
                        {word.d}
                    </p>
                </div>

                <div className="bg-indigo-50 p-6 rounded-2xl border-2 border-indigo-100 relative mt-2">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 rounded-full text-[8px] font-black text-white uppercase tracking-widest shadow-sm">
                        Memory Hook
                    </div>
                    <p className="text-indigo-900 font-black text-lg italic leading-snug">
                        "{word.m}"
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-3 w-full mt-4">
              <button 
                  onClick={() => onContinue(sourceMode)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xl hover:bg-indigo-700 transition-all shadow-md active:scale-[0.98]"
              >
                  Continue {isTrainingSource ? 'Training' : 'Challenge'}
              </button>
              <button 
                  onClick={() => onContinue(isTrainingSource ? AppMode.CHALLENGE : AppMode.TRAINING)}
                  className="w-full py-2 text-slate-400 font-bold text-sm hover:text-slate-600 transition-all underline underline-offset-4"
              >
                  Switch Mode
              </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default BogeyPage;
