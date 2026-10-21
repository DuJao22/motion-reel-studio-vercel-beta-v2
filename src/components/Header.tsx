import React from 'react';
import { Film, Key, History, Sparkles } from 'lucide-react';

interface HeaderProps {
  keyCount: number;
  onOpenKeys: () => void;
  onOpenHistory: () => void;
  onNewProject: () => void;
  activeTab?: string;
  onSelectTab?: (tab: 'create' | 'player' | 'inspector' | 'logs') => void;
  isGenerating?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  keyCount,
  onOpenKeys,
  onOpenHistory,
  onNewProject,
  activeTab = 'create',
  onSelectTab,
  isGenerating = false
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#050508]/80 backdrop-blur-2xl transition-all safe-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none" onClick={onNewProject}>
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 p-[1px] flex items-center justify-center shadow-lg shadow-orange-500/15">
            <div className="w-full h-full bg-[#09090e] rounded-[11px] flex items-center justify-center">
              <Film className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm sm:text-base text-zinc-100 tracking-tight">
                Motion Reel
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-amber-300">
                Studio v3
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 hidden md:block tracking-normal">
              Canvas 2D & Narração TTS com IA · Salvo Permanente
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Apple Segmented Style) */}
        {onSelectTab && (
          <nav className="hidden md:flex items-center p-1 rounded-full bg-zinc-900/90 border border-white/[0.08] shadow-inner">
            <button
              type="button"
              onClick={() => onSelectTab('create')}
              className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Criar & Briefing
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('player')}
              className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'player'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Player
              {isGenerating && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('inspector')}
              className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'inspector'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Cenas & Código
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('logs')}
              className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Console
            </button>
          </nav>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Key Counter Trigger */}
          <button
            onClick={onOpenKeys}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border border-white/[0.08] bg-zinc-900/60 hover:bg-zinc-800/80 active:scale-95 text-zinc-200 text-xs font-medium transition cursor-pointer"
            title="Gerenciar lista de chaves Gemini"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-300 font-mono text-[11px] font-semibold">
              {keyCount}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse hidden sm:block" />
          </button>

          {/* History */}
          <button
            onClick={onOpenHistory}
            className="p-2 sm:px-3 sm:py-1.5 rounded-full border border-white/[0.08] bg-zinc-900/60 hover:bg-zinc-800 active:scale-95 text-zinc-300 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
            title="Histórico de vídeos gerados"
          >
            <History className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Histórico</span>
          </button>
        </div>
      </div>
    </header>
  );
};
