import React, { useState } from 'react';
import { 
  Maximize2, ExternalLink, Download, Code, RotateCcw, 
  Smartphone, Monitor, Sparkles, Check, Share2
} from 'lucide-react';
import { ShowreelItem } from '../types';

interface ReelPlayerProps {
  reel: ShowreelItem | null;
  onSelectSceneInspector?: () => void;
}

export const ReelPlayer: React.FC<ReelPlayerProps> = ({ reel, onSelectSceneInspector }) => {
  const [deviceFrame, setDeviceFrame] = useState<'mobile' | 'expanded'>('mobile');
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(1);

  if (!reel) {
    return (
      <div className="h-full min-h-[460px] sm:min-h-[560px] flex flex-col items-center justify-center p-6 sm:p-8 border border-dashed border-white/[0.08] rounded-3xl bg-zinc-900/30 text-center">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center mb-4 text-zinc-500 shadow-inner">
          <Smartphone className="w-7 h-7" />
        </div>
        <h3 className="text-sm sm:text-base font-semibold text-zinc-200 mb-1">
          Nenhum Showreel Ativo no Player
        </h3>
        <p className="text-xs text-zinc-500 max-w-sm mb-6 leading-relaxed">
          Configure seu briefing e toque em "Gerar Showreel no Backend" ou escolha um showreel no histórico para assistir.
        </p>
      </div>
    );
  }

  const handleCopyLink = () => {
    const fullUrl = window.location.origin + reel.htmlUrl;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReload = () => {
    setIframeKey(k => k + 1);
  };

  const handleDownloadCode = () => {
    if (reel.jsCode) {
      const blob = new Blob([reel.jsCode], { type: 'text/javascript;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `showreel_codigo_${reel.id}.js`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else {
      window.open(`/api/reels/${reel.id}/code`, '_blank');
    }
  };

  return (
    <div className="bg-zinc-900/60 backdrop-blur-2xl border border-white/[0.08] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
      {/* Top Floating Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] bg-[#050508]/80 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
              {reel.title}
            </h2>
            <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 truncate">
              <span>{reel.filename}</span>
              <span>·</span>
              <span className="text-amber-400/90">HTML5 Canvas</span>
              {reel.scenes?.some(s => s.audio) && (
                <>
                  <span>·</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                    🎙️ Narração Humanizada
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar Buttons (Apple Frosted Pills) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleReload}
            className="p-2 rounded-full border border-white/[0.08] bg-zinc-900/80 hover:bg-zinc-800 active:scale-95 text-zinc-300 text-xs transition cursor-pointer"
            title="Reiniciar Showreel"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setDeviceFrame(f => f === 'mobile' ? 'expanded' : 'mobile')}
            className="hidden sm:flex px-3 py-1.5 rounded-full border border-white/[0.08] bg-zinc-900/80 hover:bg-zinc-800 active:scale-95 text-zinc-300 text-xs font-medium items-center gap-1.5 transition cursor-pointer"
            title="Alternar moldura"
          >
            {deviceFrame === 'mobile' ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-zinc-400" />
                <span>Expandido</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                <span>Mobile</span>
              </>
            )}
          </button>

          <a
            href={reel.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 sm:px-3 sm:py-1.5 rounded-full border border-white/[0.08] bg-zinc-900/80 hover:bg-zinc-800 active:scale-95 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition"
            title="Abrir em Nova Aba"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova Aba</span>
          </a>

          <a
            href={reel.htmlUrl}
            download={reel.filename}
            className="px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-500/10"
            title="Baixar HTML autônomo"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Baixar HTML</span>
          </a>
        </div>
      </div>

      {/* Main Reel Viewport */}
      <div className="flex-1 bg-black/95 p-2 sm:p-4 flex items-center justify-center overflow-hidden min-h-[500px] sm:min-h-[640px]">
        {deviceFrame === 'mobile' ? (
          /* Mobile Frame: On mobile it fills gracefully; on desktop it shows the sleek iPhone frame */
          <div className="relative w-full max-w-[340px] sm:max-w-[360px] h-[580px] sm:h-[660px] rounded-[32px] sm:rounded-[40px] border-4 sm:border-[8px] border-zinc-800/90 bg-black shadow-2xl overflow-hidden ring-1 ring-white/10 flex flex-col">
            {/* Phone Speaker Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-3.5 bg-zinc-800 rounded-full z-20 flex items-center justify-center">
              <div className="w-8 h-1 bg-zinc-700 rounded-full" />
            </div>

            {/* Iframe */}
            <iframe
              key={iframeKey}
              src={reel.htmlUrl}
              title={reel.title}
              className="w-full h-full border-0 rounded-[26px] sm:rounded-[32px]"
              allow="autoplay; camera; microphone"
            />
          </div>
        ) : (
          /* Expanded Canvas View */
          <div className="w-full h-[620px] rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl">
            <iframe
              key={iframeKey}
              src={reel.htmlUrl}
              title={reel.title}
              className="w-full h-full border-0"
              allow="autoplay; camera; microphone"
            />
          </div>
        )}
      </div>

      {/* Footer Bar */}
      <div className="px-4 py-3 bg-[#050508]/80 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Toque em <strong className="text-zinc-200">"Gravar vídeo"</strong> no próprio player para exportar MP4/WebM sem ffmpeg.
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyLink}
            className="text-[11px] hover:text-zinc-200 transition cursor-pointer flex items-center gap-1"
          >
            <Share2 className="w-3 h-3 text-zinc-400" />
            {copied ? 'Link Copiado!' : 'Compartilhar'}
          </button>
          <span>·</span>
          <button
            onClick={handleDownloadCode}
            className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition cursor-pointer"
            title="Baixar código JavaScript de todas as cenas"
          >
            <Code className="w-3 h-3" />
            Código JS
          </button>
        </div>
      </div>
    </div>
  );
};
