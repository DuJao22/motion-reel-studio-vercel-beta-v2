import React, { useState } from 'react';
import { 
  FileCode2, Copy, Check, Clock, Layout, Mic, ChevronDown, ChevronRight,
  Layers, Sparkles
} from 'lucide-react';
import { SceneData } from '../types';

interface SceneInspectorProps {
  scenes: SceneData[];
  title?: string;
  motivo?: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  hook: { label: 'Abertura (Hook)', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  body: { label: 'Conteúdo (Body)', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  climax: { label: 'Clímax (Destaque)', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  closing: { label: 'Encerramento (Card Final)', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
};

export const SceneInspector: React.FC<SceneInspectorProps> = ({ scenes, title, motivo }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!scenes || scenes.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-zinc-800 rounded-2xl text-zinc-500 text-xs">
        Nenhuma cena carregada para inspeção. Gere um showreel ou selecione um do histórico.
      </div>
    );
  }

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 lg:p-6 space-y-5">
      {/* Header Info */}
      <div className="border-b border-zinc-800 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            Estrutura e Código das Cenas ({scenes.length} cenas)
          </h3>
          {title && (
            <p className="text-xs text-zinc-400 mt-0.5">
              Showreel: <strong className="text-zinc-200">{title}</strong>
              {motivo && <span> · Motivo visual: <em className="text-amber-300">{motivo}</em></span>}
            </p>
          )}
        </div>
      </div>

      {/* Scenes List Accordion */}
      <div className="space-y-3">
        {scenes.map((scene, idx) => {
          const isExpanded = expandedIndex === idx;
          const roleInfo = ROLE_LABELS[scene.role] || { label: scene.role, color: 'bg-zinc-800 text-zinc-400 border-zinc-700' };

          return (
            <div
              key={idx}
              className={`rounded-xl border transition overflow-hidden ${
                isExpanded ? 'bg-zinc-950 border-zinc-700' : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              {/* Scene Row Header */}
              <div
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-zinc-800 text-zinc-300 font-mono text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-zinc-100 truncate">
                        {scene.text}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                      {scene.layout && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-400 font-mono">
                          layout: {scene.layout}
                        </span>
                      )}
                    </div>
                    {scene.sub && (
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {scene.sub}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-zinc-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    {scene.dur.toFixed(1)}s
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details & Code */}
              {isExpanded && (
                <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/90 space-y-3.5">
                  {/* Scene Metadata Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {scene.idea && (
                      <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                          Ideia & Coreografia da IA:
                        </span>
                        <p className="text-zinc-300 text-[11px] leading-relaxed">
                          {scene.idea}
                        </p>
                      </div>
                    )}

                    {scene.fala && (
                      <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                        <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider block mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Mic className="w-3 h-3" />
                            Narração da Voz (Gemini TTS):
                          </span>
                          {scene.audio && (
                            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-normal normal-case">
                              ✓ Áudio WAV Sincronizado
                            </span>
                          )}
                        </span>
                        <p className="text-zinc-200 text-[11px] italic leading-relaxed">
                          "{scene.fala}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Scene Canvas Code Viewer */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-mono flex items-center gap-1.5 text-[11px]">
                        <FileCode2 className="w-3.5 h-3.5 text-zinc-500" />
                        Código JavaScript Canvas 2D (ctx, t, ts, W, H, P, M):
                      </span>
                      {scene.code && (
                        <button
                          onClick={() => handleCopyCode(scene.code || '', idx)}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copiar Função
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <pre className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto max-h-60 overflow-y-auto leading-relaxed">
                      <code>
                        {scene.code || `// Cena gerada com fallback paramétrico padrão (${scene.fb || 'kinetic'})`}
                      </code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
