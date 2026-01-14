
import React from 'react';

interface KeyboardProps {
  onKey: (key: string) => void;
  disabledKeys?: string[];
}

const Keyboard: React.FC<KeyboardProps> = ({ onKey, disabledKeys = [] }) => {
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];

  return (
    <div className="flex flex-col items-center gap-2 w-full select-none">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-2 w-full">
          {row.map(key => (
            <button
              key={key}
              onClick={() => onKey(key)}
              disabled={disabledKeys.includes(key)}
              className={`
                h-12 sm:h-14 flex-1 max-w-[50px] rounded-xl font-black text-lg sm:text-xl 
                transition-all active:scale-90 shadow-sm border
                ${disabledKeys.includes(key) 
                  ? 'bg-slate-100 text-slate-300 border-slate-200' 
                  : 'bg-white text-slate-800 hover:bg-indigo-50 hover:text-indigo-600 border-slate-200 hover:border-indigo-300'
                }
              `}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Keyboard;
