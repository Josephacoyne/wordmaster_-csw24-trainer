import React from 'react';
import { AppMode } from '../types';

interface HeaderProps {
  mode: AppMode;
  onHome: () => void;
  title: string;
}

const Header: React.FC<HeaderProps> = ({ mode, onHome, title }) => {
  return (
    <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-50">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          {mode !== AppMode.HOME && (
            <button 
              onClick={onHome}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-bold text-lg transition-all active:scale-95 flex items-center gap-2 shadow-md border border-indigo-400/30"
            >
              <span className="text-2xl">‹</span> Back
            </button>
          )}
          <h1 className="text-xl font-black tracking-tight text-slate-100">
            {title}
          </h1>
        </div>
      </div>
    </header>
  );
};

export default Header;