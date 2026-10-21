import React, { useEffect, useRef } from 'react';
import { 
  Sparkles, CheckCircle2, CircleDashed, Terminal, Music, 
  Cpu, FileCode2, Volume2, ShieldCheck, Film
} from 'lucide-react';
import { GenerationEvent } from '../types';

interface LiveProgressProps {
  currentEvent: GenerationEvent | null;
  logs: Array<{ time: string; text: string; data?: any }>;
}

export const LiveProgress: React.FC<LiveProgressProps> = ({ currentEvent, logs }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Determine stage based on events
  const getStageStatus = (stageName: string) => {
    const step = currentEvent?.step || '';
    const stages = ['dna', 'script', 'tts', 'scenes', 'compile'];
    
    let currentStageIndex = 0;
    if (step === 'dna') currentStageIndex = 0;
    else if (step.startsWith('script')) currentStageIndex = 1;
    else if (step.startsWith('tts')) currentStageIndex = 2;
    else if (step.startsWith('scene')) currentStageIndex = 3;
    else if (step === 'complete') currentStageIndex = 4;

    const targetIndex = stages.indexOf(stageName);

    if (currentStageIndex > targetIndex) return 'completed';
    if (currentStageIndex === targetIndex) return 'active';
    return 'pending';
  };

  const sceneProgress = currentEvent?.step?.startsWith('scene')
    ? {
        current: currentEvent.index || 1,
        total: currentEvent.total || 7,
        text: currentEvent.text || '',
        substep: currentEvent.substep || 'gerando...'
      }
    : null;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 lg:p-6 space-y-6 animate-fade-in shadow-xl">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Film className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Gerador em Execução no Backend Python
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            </h3>
            <p className="text-xs text-zinc-400">
              O Python está consultando a Gemini API, roteirizando e codificando as cenas em Canvas 2D
            </p>
          </div>
        </div>
      </div>

      {/* Stepper Pipeline */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { id: 'dna', label: '1. DNA & Paleta', icon: Sparkles },
          { id: 'script', label: '2. Roteiro', icon: FileCode2 },
          { id: 'tts', label: '3. Narração TTS', icon: Volume2 },
          { id: 'scenes', label: '4. Cenas Canvas', icon: Cpu },
          { id: 'compile', label: '5. HTML5 Final', icon: CheckCircle2 }
        ].map(stage => {
          const status = getStageStatus(stage.id);
          const Icon = stage.icon;

          return (
            <div
              key={stage.id}
              className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                status === 'completed'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : status === 'active'
                  ? 'bg-amber-500/10 border-amber-500/60 text-amber-300 ring-2 ring-amber-500/20'
                  : 'bg-zinc-950/40 border-zinc-800 text-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-4 h-4" />
                {status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {status === 'active' && <CircleDashed className="w-3.5 h-3.5 animate-spin" />}
              </div>
              <span className="text-[11px] font-medium leading-tight">
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scene Level Indicator if generating scenes */}
      {sceneProgress && (
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">
              Progresso das Cenas Canvas 2D:
            </span>
            <span className="font-mono text-amber-400 font-bold">
              Cena {sceneProgress.current} de {sceneProgress.total} ({Math.round((sceneProgress.current / sceneProgress.total) * 100)}%)
            </span>
          </div>

          <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${(sceneProgress.current / sceneProgress.total) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="font-semibold text-zinc-200 truncate max-w-[280px]">
              "{sceneProgress.text}"
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono text-[10px]">
              {sceneProgress.substep}
            </span>
          </div>
        </div>
      )}

      {/* DNA parameters if already generated */}
      {currentEvent?.dna && (
        <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">
            DNA do Reel:
          </span>
          <span className="text-zinc-300 font-medium">
            Estilo: <strong className="text-amber-400">{currentEvent.dna.estilo}</strong>
          </span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-300">
            BPM: <strong className="text-zinc-100">{currentEvent.dna.bpm}</strong>
          </span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-300">
            Transição: <strong className="text-zinc-100">{currentEvent.dna.transition}</strong>
          </span>
          <span className="text-zinc-500">·</span>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Paleta:</span>
            <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: currentEvent.dna.pal.bg1 }} />
            <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: currentEvent.dna.pal.bg2 }} />
            <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: currentEvent.dna.pal.acc }} />
            <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: currentEvent.dna.pal.acc2 }} />
          </div>
        </div>
      )}

      {/* Live Terminal Log Stream */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 font-mono">
            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
            Console do Backend Python (Eventos em Tempo Real)
          </span>
          <span className="text-[10px] text-zinc-500">
            {logs.length} eventos registrados
          </span>
        </div>

        <div className="bg-zinc-950 border border-zinc-800/90 rounded-xl p-3.5 font-mono text-[11px] h-48 overflow-y-auto space-y-1.5 leading-relaxed text-zinc-300">
          {logs.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-zinc-600 shrink-0 select-none">[{item.time}]</span>
              <span className={item.text.includes('Erro') || item.text.includes('stderr') ? 'text-rose-400' : (item.text.includes('sucesso') ? 'text-emerald-400' : 'text-zinc-300')}>
                {item.text}
              </span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
};
