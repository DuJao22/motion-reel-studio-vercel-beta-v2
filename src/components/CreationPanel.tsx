import React from 'react';
import { 
  Sparkles, Palette, Monitor, Zap, Volume2, Cpu, ArrowRight,
  Flame, RefreshCw, Check
} from 'lucide-react';
import { PresetsConfig } from '../types';

interface CreationPanelProps {
  presets: PresetsConfig;
  prompt: string;
  setPrompt: (p: string) => void;
  styleId: number;
  setStyleId: (id: number) => void;
  resolutionId: number;
  setResolutionId: (id: number) => void;
  fps: number;
  setFps: (fps: number) => void;
  accent: string;
  setAccent: (accent: string) => void;
  effort: number;
  setEffort: (effort: number) => void;
  voice: string;
  setVoice: (voice: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  keyCount: number;
}

const INSPIRATION_PROMPTS = [
  "Lançamento de app fintech com gráficos 3D modernos e números em ascensão rápida",
  "Apresentação de marca de moda minimalista com tipografia editorial elegante",
  "Showreel cyberpunk com HUDs digitais, scanlines, código neon e batida forte",
  "Marketing para inteligência artificial com foco em performance e impacto",
  "Portfólio criativo destacando tipografia cinética, cortes rápidos e geometria"
];

export const CreationPanel: React.FC<CreationPanelProps> = ({
  presets,
  prompt,
  setPrompt,
  styleId,
  setStyleId,
  resolutionId,
  setResolutionId,
  fps,
  setFps,
  accent,
  setAccent,
  effort,
  setEffort,
  voice,
  setVoice,
  onGenerate,
  isGenerating,
  keyCount
}) => {
  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Briefing Card (Apple Inset Grouped Style) */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] sm:text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Briefing do Showreel
          </label>
          <span className="text-[10px] text-zinc-500 font-medium">
            IA Roteiriza & Codifica
          </span>
        </div>

        <textarea
          rows={3}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Descreva o tema, visual e mensagem (ex: Lançamento de produto com visual futurista e tipografia forte)..."
          className="w-full bg-[#050508]/80 border border-white/[0.08] focus:border-amber-400/80 rounded-xl p-3.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition resize-none leading-relaxed"
        />

        {/* Horizontal Scrollable Prompt Chips (Mobile Friendly with Momentum) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
            {INSPIRATION_PROMPTS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(sample)}
                className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.07] text-zinc-300 transition cursor-pointer"
              >
                {sample.slice(0, 36)}...
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Estilo Visual (Apple Inset Grid) */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] sm:text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            Estilo Visual
          </label>
          <span className="text-[10px] text-zinc-500 font-medium">
            Selecione a atmosfera
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {presets.styles.map((s) => {
            const isSelected = styleId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyleId(s.id)}
                className={`p-3 rounded-xl sm:rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-400/60 shadow-lg shadow-amber-500/5'
                    : 'bg-[#050508]/60 border-white/[0.06] hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${isSelected ? 'text-amber-300' : 'text-zinc-200'}`}>
                    {s.name}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                  {s.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Resolução & Fluidez (Apple Segmented Controls) */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Resolução Segmented Switcher */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-zinc-400" />
              Resolução Vertical 9:16
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#050508]/80 border border-white/[0.07]">
            {presets.resolutions.map((r) => {
              const isSelected = resolutionId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setResolutionId(r.id)}
                  className={`py-2 px-1 rounded-lg text-center transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-800 text-white font-semibold shadow-sm border border-white/10'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="text-[11px] font-mono leading-tight">{r.width}x{r.height}</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">{r.id === 2 ? 'Recomendado' : (r.id === 1 ? 'Rápido' : 'Máxima')}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fluidez Segmented Switcher */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-zinc-400" />
              Taxa de Quadros (FPS)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#050508]/80 border border-white/[0.07]">
            {presets.framerates.map((f) => {
              const isSelected = fps === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFps(f.value)}
                  className={`py-2 px-2 rounded-lg text-center transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-800 text-white font-semibold shadow-sm border border-white/10'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="text-[11px] font-mono leading-tight">{f.value} FPS</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">{f.value === 24 ? 'Cinema' : 'Fluido'}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Cor & Narração TTS (Apple Style Pickers) */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Cor de Destaque */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Cor de Destaque (Accent)
            </span>
            <span className="font-mono text-[11px] text-zinc-400 font-medium">{accent}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              type="color"
              value={accent}
              onChange={e => setAccent(e.target.value)}
              className="w-10 h-10 rounded-full border border-white/20 bg-transparent cursor-pointer p-0.5 shrink-0"
            />
            <div className="flex flex-wrap gap-2 flex-1">
              {presets.accentPresets.map(presetColor => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setAccent(presetColor)}
                  style={{ backgroundColor: presetColor }}
                  className={`w-7 h-7 rounded-full border transition-transform active:scale-90 cursor-pointer ${
                    accent.toLowerCase() === presetColor.toLowerCase()
                      ? 'scale-115 border-white ring-2 ring-white/20 shadow-md'
                      : 'border-transparent opacity-85 hover:opacity-100'
                  }`}
                  title={presetColor}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Narração TTS */}
        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              Narração com Voz Humana (TTS)
            </span>
            <span className="text-[10px] text-amber-400/90 font-medium">Reativa à voz</span>
          </div>
          <select
            value={voice}
            onChange={e => setVoice(e.target.value)}
            className="w-full bg-[#050508]/80 border border-white/[0.08] focus:border-amber-400/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
          >
            {presets.voices.map(v => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 5. Esforço da IA Segmented Card */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            Nível de Esforço da IA por Cena
          </label>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#050508]/80 border border-white/[0.07]">
          {presets.efforts.map(eff => {
            const isSelected = effort === eff.id;
            return (
              <button
                key={eff.id}
                type="button"
                onClick={() => setEffort(eff.id)}
                className={`py-2.5 px-2 rounded-lg text-center transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-800 text-amber-300 font-semibold shadow-sm border border-white/10'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="text-xs">{eff.name}</div>
                <div className="text-[9px] text-zinc-400 truncate mt-0.5">{eff.id === 2 ? 'Recomendado' : (eff.id === 1 ? '1 chamada' : '3 chamadas')}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Action Button (Apple Tactile CTA) */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:via-orange-400 hover:to-rose-400 active:scale-[0.98] disabled:opacity-50 text-zinc-950 font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition cursor-pointer shadow-xl shadow-orange-500/20"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
              <span>Gerando Showreel com IA (Canvas 2D)...</span>
            </>
          ) : (
            <>
              <span>Gerar Showreel com IA</span>
              <ArrowRight className="w-4 h-4 text-zinc-950" />
            </>
          )}
        </button>

        <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-2.5 px-1.5">
          <span className="flex items-center gap-1 text-emerald-400/90 font-medium">
            Otimizado para Vercel · Salvo Permanente
          </span>
          <span className="font-mono text-amber-300">{keyCount} chaves prontas</span>
        </div>
      </div>
    </div>
  );
};
