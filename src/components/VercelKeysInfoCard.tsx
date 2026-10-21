import React from 'react';
import { Key, ShieldCheck, Sparkles, Plus, Lock, ExternalLink, HardDrive } from 'lucide-react';

interface VercelKeysInfoCardProps {
  keyCount: number;
  onOpenKeysModal: () => void;
}

export const VercelKeysInfoCard: React.FC<VercelKeysInfoCardProps> = ({
  keyCount,
  onOpenKeysModal
}) => {
  return (
    <div className="bg-gradient-to-b from-zinc-900/60 to-zinc-950/70 backdrop-blur-xl border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Key className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Chaves Gemini no Sistema
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono font-medium">
                {keyCount} {keyCount === 1 ? 'chave' : 'chaves'}
              </span>
            </h4>
            <p className="text-[11px] text-zinc-400">
              Zero variáveis de ambiente necessárias na Vercel
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenKeysModal}
          className="text-[11px] px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition active:scale-95 cursor-pointer shadow-sm flex items-center gap-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Configurar</span>
        </button>
      </div>

      {/* Description Card */}
      <div className="p-3.5 rounded-xl bg-[#050508]/70 border border-white/[0.06] space-y-2.5 text-xs">
        <div className="flex items-center gap-2 text-zinc-300 text-[11px]">
          <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-medium text-emerald-400">
            Armazenamento permanente ativo (Não some ao recarregar a tela)
          </span>
        </div>

        <p className="text-zinc-400 text-[11px] leading-relaxed">
          Suas chaves, preferências e vídeos gerados ficam salvos com segurança no armazenamento local permanente do seu navegador (<code className="text-amber-300 bg-white/5 px-1 py-0.5 rounded font-mono text-[10px]">IndexedDB + localStorage</code>). O rodízio inteligente acontece automaticamente a cada cena gerada.
        </p>

        {/* Link direto para pegar no Google AI Studio */}
        <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Precisa de uma chave gratuita?
          </span>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition cursor-pointer"
          >
            <span>Criar chave no Google AI Studio</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
