import React from 'react';
import { Sparkles, Video, Layers, Key, History, Terminal } from 'lucide-react';

interface MobileTabBarProps {
  activeTab: 'create' | 'player' | 'inspector' | 'logs';
  onSelectTab: (tab: 'create' | 'player' | 'inspector' | 'logs') => void;
  onOpenKeys: () => void;
  onOpenHistory: () => void;
  keyCount: number;
  isGenerating: boolean;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenKeys,
  onOpenHistory,
  keyCount,
  isGenerating
}) => {
  return (
    <div className="md:hidden fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto pointer-events-auto">
      <nav className="flex items-center justify-around px-2 py-1.5 rounded-full bg-zinc-950/85 backdrop-blur-2xl border border-white/[0.12] shadow-2xl shadow-black/80">
        {/* Tab 1: Criar */}
        <button
          type="button"
          onClick={() => onSelectTab('create')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all active:scale-90 cursor-pointer ${
            activeTab === 'create'
              ? 'text-amber-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">Criar</span>
        </button>

        {/* Tab 2: Player */}
        <button
          type="button"
          onClick={() => onSelectTab('player')}
          className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all active:scale-90 cursor-pointer ${
            activeTab === 'player'
              ? 'text-amber-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Video className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">Player</span>
          {isGenerating && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        {/* Tab 3: Cenas */}
        <button
          type="button"
          onClick={() => onSelectTab('inspector')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all active:scale-90 cursor-pointer ${
            activeTab === 'inspector'
              ? 'text-amber-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">Cenas</span>
        </button>

        {/* Action: Chaves */}
        <button
          type="button"
          onClick={onOpenKeys}
          className="relative flex flex-col items-center justify-center py-1 px-3 rounded-full text-zinc-400 hover:text-zinc-200 transition-all active:scale-90 cursor-pointer"
        >
          <Key className="w-4 h-4 mb-0.5 text-amber-400" />
          <span className="text-[10px] leading-tight">Chaves ({keyCount})</span>
        </button>

        {/* Action: Histórico */}
        <button
          type="button"
          onClick={onOpenHistory}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-full text-zinc-400 hover:text-zinc-200 transition-all active:scale-90 cursor-pointer"
        >
          <History className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">Histórico</span>
        </button>
      </nav>
    </div>
  );
};
