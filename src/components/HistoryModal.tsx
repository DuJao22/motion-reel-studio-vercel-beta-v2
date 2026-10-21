import React from 'react';
import { X, History, Film, ExternalLink, Download, Play, Calendar, Trash2, HardDrive } from 'lucide-react';
import { ShowreelItem } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reels: ShowreelItem[];
  onSelectReel: (reel: ShowreelItem) => void;
  onDeleteReel?: (id: string) => void;
  activeReelId?: string;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  reels,
  onSelectReel,
  onDeleteReel,
  activeReelId
}) => {
  if (!isOpen) return null;

  const handleDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (confirm(`Deseja excluir "${title}" do histórico salvo?`)) {
      if (onDeleteReel) onDeleteReel(id);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-[#09090e] border border-white/[0.09] rounded-t-[32px] sm:rounded-3xl w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* iOS Grabber on Mobile */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-inner">
              <History className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-100 flex items-center gap-2">
                Histórico de Showreels
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-amber-300 font-mono">
                  {reels.length}
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                <HardDrive className="w-3 h-3 text-emerald-400" />
                <span>Salvo permanentemente no navegador (IndexedDB) · Não some ao atualizar</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-white/5 active:scale-90 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-2.5 flex-1">
          {reels.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-xs">
              <Film className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              Nenhum showreel gerado ainda. Configure seu briefing para criar o primeiro!
            </div>
          ) : (
            reels.map((reel) => {
              const isActive = activeReelId === reel.id;
              const formattedDate = new Date(reel.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
              });

              return (
                <div
                  key={reel.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-amber-500/10 border-amber-500/50'
                      : 'bg-[#050508]/60 border-white/[0.07] hover:border-white/20'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-xs text-zinc-100 truncate">
                        {reel.title}
                      </span>
                      {isActive && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
                          No Player
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        {formattedDate}
                      </span>
                      <span>·</span>
                      <span>{((reel.size || 35000) / 1024).toFixed(0)} KB</span>
                      <span>·</span>
                      <span className="text-emerald-400/90 font-sans">Local</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectReel(reel);
                        onClose();
                      }}
                      className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 text-amber-400" />
                      Assistir
                    </button>

                    <a
                      href={reel.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl border border-white/[0.08] hover:bg-white/5 active:scale-95 text-zinc-400 hover:text-zinc-200 transition"
                      title="Abrir em Nova Aba"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <a
                      href={reel.htmlUrl}
                      download={reel.filename}
                      className="p-2 rounded-xl border border-white/[0.08] hover:bg-white/5 active:scale-95 text-zinc-400 hover:text-zinc-200 transition"
                      title="Baixar HTML"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    {onDeleteReel && (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, reel.id, reel.title)}
                        className="p-2 rounded-xl border border-white/[0.08] hover:bg-rose-500/10 hover:border-rose-500/30 text-zinc-500 hover:text-rose-400 active:scale-95 transition cursor-pointer"
                        title="Excluir do Histórico"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 bg-zinc-950/90 border-t border-white/[0.08] flex items-center justify-between safe-bottom">
          <span className="text-[11px] text-zinc-500">
            Armazenamento permanente IndexedDB
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-white/[0.08] hover:bg-white/5 active:scale-95 text-xs font-medium text-zinc-300 transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
