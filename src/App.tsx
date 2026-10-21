import React, { useState, useEffect } from 'react';
import { 
  Play, Film, Sparkles, Layers, Terminal, Key, History, 
  ExternalLink, Download, CheckCircle2, AlertCircle, RefreshCw,
  Video, Code
} from 'lucide-react';
import { Header } from './components/Header';
import { CreationPanel } from './components/CreationPanel';
import { LiveProgress } from './components/LiveProgress';
import { ReelPlayer } from './components/ReelPlayer';
import { SceneInspector } from './components/SceneInspector';
import { KeysModal } from './components/KeysModal';
import { HistoryModal } from './components/HistoryModal';
import { MobileTabBar } from './components/MobileTabBar';
import { VercelKeysInfoCard } from './components/VercelKeysInfoCard';
import { ApiKeyItem, PresetsConfig, ShowreelItem, GenerationEvent, SceneData } from './types';
import { 
  getSavedKeys, saveKeysToStorage, clearKeysFromStorage,
  getSavedPreferences, savePreferencesToStorage,
  getSavedActiveReelId, saveActiveReelId,
  getAllSavedReels, saveReelToDatabase, deleteReelFromDatabase,
  getOrCreateReelBlobUrl
} from './services/storage';
import { generateReelClientSide } from './services/reelGenerator';

const DEFAULT_PRESETS: PresetsConfig = {
  styles: [
    { id: 1, name: 'Minimalista e elegante', desc: 'Espaço vazio, linhas finas, círculos, movimento lento e tipografia leve' },
    { id: 2, name: 'Cinematográfico e dramático', desc: 'Alto contraste, vinheta, luz e sombra, letterbox, zoom lento e serifas dramáticas' },
    { id: 3, name: 'Futurista e tecnológico', desc: 'HUD interfaces, wireframes, grades 3D, scanlines, dados digitais e brilho neon' },
    { id: 4, name: 'Colorido e energético', desc: 'Formas vibrantes, cores saturadas, movimento elástico e círculos em explosão' },
    { id: 5, name: 'Editorial e tipográfico', desc: 'Tipografia como protagonista, grid editorial, filetes, números gigantes e serifa elegante' },
    { id: 6, name: 'Surpresa (Design Aleatório)', desc: 'DNA e estilo combinados de forma imprevisível e única pelo gerador' }
  ],
  resolutions: [
    { id: 1, width: 540, height: 960, label: '540 x 960 (Rápido / Teste)' },
    { id: 2, width: 720, height: 1280, label: '720 x 1280 (Recomendado 9:16)' },
    { id: 3, width: 1080, height: 1920, label: '1080 x 1920 (Qualidade Máxima)' }
  ],
  framerates: [
    { value: 24, label: '24 FPS (Cinema & Leve)' },
    { value: 30, label: '30 FPS (Movimento Suave)' }
  ],
  voices: [
    { id: 'Kore', label: 'Kore (Firme e Clara)' },
    { id: 'Puck', label: 'Puck (Animada e Dinâmica)' },
    { id: 'Charon', label: 'Charon (Informativa e Grave)' },
    { id: 'Aoede', label: 'Aoede (Leve e Suave)' },
    { id: 'Sulafat', label: 'Sulafat (Calorosa e Natural)' },
    { id: 'none', label: 'Sem Narração (Apenas Batida Sintetizada)' }
  ],
  efforts: [
    { id: 1, name: 'Rápido', desc: '1 chamada direta de código por cena' },
    { id: 2, name: 'Equilibrado', desc: '2 chamadas: planeja coreografia e escreve código (Recomendado)' },
    { id: 3, name: 'Máximo', desc: '3 chamadas: planeja, escreve e refina cada cena com IA' }
  ],
  accentPresets: ['#FFB454', '#38bdf8', '#a855f7', '#22c55e', '#ef4444', '#f43f5e', '#eab308']
};

function sanitizeKeyList(rawKeys: string[]): string[] {
  return rawKeys
    .map(k => String(k).trim().replace(/['"]/g, ''))
    .filter(k => k.length >= 25 && !k.startsWith('AQ.'));
}

function formatKeyItem(k: string): ApiKeyItem {
  return {
    key: k,
    masked: k.length > 10 ? `${k.slice(0, 6)}...${k.slice(-4)}` : k,
    type: k.startsWith('AIza') ? 'Gemini Standard' : 'API Key',
    length: k.length
  };
}

export default function App() {
  // Load saved preferences from localStorage so they never reset on refresh
  const savedPrefs = getSavedPreferences();

  // Config & Keys State
  const [keys, setKeys] = useState<ApiKeyItem[]>(() => {
    const stored = sanitizeKeyList(getSavedKeys());
    return stored.map(formatKeyItem);
  });
  const [presets, setPresets] = useState<PresetsConfig>(DEFAULT_PRESETS);
  const [reels, setReels] = useState<ShowreelItem[]>([]);

  // Studio Form Options (Restored from persistent storage)
  const [prompt, setPrompt] = useState(
    savedPrefs.prompt || 'Showreel moderno de apresentação de produto com tipografia impactante, formas geométricas e ritmo acelerado'
  );
  const [styleId, setStyleId] = useState(savedPrefs.styleId ?? 2);
  const [resolutionId, setResolutionId] = useState(savedPrefs.resolutionId ?? 2);
  const [fps, setFps] = useState(savedPrefs.fps ?? 24);
  const [accent, setAccent] = useState(savedPrefs.accent || '#FFB454');
  const [effort, setEffort] = useState(savedPrefs.effort ?? 2);
  const [voice, setVoice] = useState(savedPrefs.voice || 'Kore');

  // Generation & Pipeline State
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<GenerationEvent | null>(null);
  const [logs, setLogs] = useState<Array<{ time: string; text: string; data?: any }>>([]);

  // Active Showreel State
  const [activeReel, setActiveReel] = useState<ShowreelItem | null>(null);
  const [activeScenes, setActiveScenes] = useState<SceneData[]>([]);
  const [activeTitle, setActiveTitle] = useState('');
  const [activeMotivo, setActiveMotivo] = useState('');

  // UI Tabs and Modals (Mobile-first navigation)
  const [activeTab, setActiveTab] = useState<'create' | 'player' | 'inspector' | 'logs'>('create');
  const [isKeysModalOpen, setIsKeysModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Automatically persist user preferences whenever they change
  useEffect(() => {
    savePreferencesToStorage({
      prompt,
      styleId,
      resolutionId,
      fps,
      accent,
      effort,
      voice
    });
  }, [prompt, styleId, resolutionId, fps, accent, effort, voice]);

  // Load persistent data on startup: Keys, Reels (IndexedDB), and Active Showreel
  useEffect(() => {
    const initData = async () => {
      // 1. Load keys from storage and sanitize (purge any old invalid dummy tokens)
      const rawLocalKeys = getSavedKeys();
      const sanitized = sanitizeKeyList(rawLocalKeys);

      if (rawLocalKeys.length !== sanitized.length) {
        saveKeysToStorage(sanitized);
      }

      if (sanitized.length > 0) {
        setKeys(sanitized.map(formatKeyItem));
      } else {
        // Fetch valid keys from server environment if available
        try {
          const res = await fetch('/api/keys');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.keys) && data.keys.length > 0) {
              const validEnvKeys = sanitizeKeyList(data.keys);
              if (validEnvKeys.length > 0) {
                saveKeysToStorage(validEnvKeys);
                setKeys(validEnvKeys.map(formatKeyItem));
              }
            }
          }
        } catch (e) {}
      }

      // 2. Load presets from API if available
      try {
        const res = await fetch('/api/config/presets');
        if (res.ok) {
          const data = await res.json();
          setPresets(data);
        }
      } catch (e) {}

      // 3. Load Showreels from IndexedDB (Vercel-proof persistence)
      try {
        const localReels = await getAllSavedReels();
        const activeId = getSavedActiveReelId();

        // Ensure all reels have valid Blob URLs
        const preparedReels = localReels.map(r => ({
          ...r,
          htmlUrl: getOrCreateReelBlobUrl(r)
        }));

        setReels(preparedReels);

        if (preparedReels.length > 0) {
          const match = activeId ? preparedReels.find(r => r.id === activeId) : null;
          const chosen = match || preparedReels[0];
          setActiveReel(chosen);
          if (chosen.scenes) setActiveScenes(chosen.scenes);
          setActiveTitle(chosen.title);
          if (chosen.motivo) setActiveMotivo(chosen.motivo);
        }

        // Try to fetch backend reels (if running with server disk) and merge without deleting local reels
        try {
          const res = await fetch('/api/reels');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.reels)) {
              setReels(prev => {
                const map = new Map<string, ShowreelItem>();
                // Local reels take priority
                prev.forEach(r => map.set(r.id, r));
                data.reels.forEach((br: any) => {
                  if (!map.has(br.id)) {
                    map.set(br.id, br);
                  }
                });
                return Array.from(map.values()).sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
              });
            }
          }
        } catch (e) {}
      } catch (err) {
        console.error('Erro ao carregar reels salvos:', err);
      }
    };

    initData();
  }, []);

  // Save keys handler (persists permanently in browser localStorage)
  const handleSaveKeys = async (newKeys: string[]) => {
    saveKeysToStorage(newKeys);
    setKeys(newKeys.map(formatKeyItem));

    // Also attempt background sync to backend if available
    try {
      fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: newKeys })
      }).catch(() => {});
    } catch (e) {}
  };

  // Reset keys handler
  const handleResetKeys = async () => {
    clearKeysFromStorage();
    setKeys([]);

    try {
      const res = await fetch('/api/keys/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.keys)) {
          const valid = sanitizeKeyList(data.keys);
          saveKeysToStorage(valid);
          setKeys(valid.map(formatKeyItem));
        }
      }
    } catch (e) {}
  };

  // Delete a reel from history & IndexedDB
  const handleDeleteReel = async (id: string) => {
    await deleteReelFromDatabase(id);
    setReels(prev => prev.filter(r => r.id !== id));
    if (activeReel?.id === id) {
      const remaining = reels.filter(r => r.id !== id);
      const nextActive = remaining[0] || null;
      setActiveReel(nextActive);
      if (nextActive) {
        saveActiveReelId(nextActive.id);
        if (nextActive.scenes) setActiveScenes(nextActive.scenes);
        setActiveTitle(nextActive.title);
        if (nextActive.motivo) setActiveMotivo(nextActive.motivo);
      } else {
        setActiveScenes([]);
        setActiveTitle('');
        setActiveMotivo('');
      }
    }
  };

  // Select an active reel from history
  const handleSelectReel = (selected: ShowreelItem) => {
    const withUrl = {
      ...selected,
      htmlUrl: getOrCreateReelBlobUrl(selected)
    };
    setActiveReel(withUrl);
    saveActiveReelId(withUrl.id);
    if (withUrl.scenes) setActiveScenes(withUrl.scenes);
    setActiveTitle(withUrl.title);
    if (withUrl.motivo) setActiveMotivo(withUrl.motivo);
    setActiveTab('player');
  };

  // Generate showreel handler (Universal client-side + IndexedDB persistence)
  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setCurrentEvent({ step: 'init', message: 'Iniciando gerador de showreel...' });
    setLogs([{ time: new Date().toLocaleTimeString(), text: 'Solicitação de geração iniciada no sistema.' }]);
    setActiveTab('player');

    const activeRawKeys = keys.map(k => k.key);

    try {
      // Execute the generator directly in browser with persistent IndexedDB saving
      // This is 100% immune to Vercel's 10-second timeout and missing python3
      const newReel = await generateReelClientSide(
        prompt,
        {
          keys: activeRawKeys,
          styleId,
          resolutionId,
          fps,
          accent,
          effort,
          voice
        },
        (ev) => {
          setCurrentEvent(ev);
          if (ev.step === 'script_done') {
            if (ev.scenes) setActiveScenes(ev.scenes);
            if (ev.title) setActiveTitle(ev.title);
            if (ev.motivo) setActiveMotivo(ev.motivo);
          }
        },
        (logText) => {
          setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: logText }]);
        }
      );

      // Successfully generated and saved to IndexedDB
      setIsGenerating(false);
      setActiveReel(newReel);
      saveActiveReelId(newReel.id);
      if (newReel.scenes) setActiveScenes(newReel.scenes);
      setActiveTitle(newReel.title);
      if (newReel.motivo) setActiveMotivo(newReel.motivo);

      // Prepend to reels list
      setReels(prev => [newReel, ...prev.filter(r => r.id !== newReel.id)]);

    } catch (err: any) {
      console.error('Erro na geração:', err);
      setIsGenerating(false);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `Erro: ${err.message}` }]);
      alert('Erro na geração: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950 pb-20 md:pb-6">
      {/* 1. Apple-style Frosted Header */}
      <Header
        keyCount={keys.length}
        onOpenKeys={() => setIsKeysModalOpen(true)}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onNewProject={() => {
          setPrompt('');
          setActiveTab('create');
        }}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        isGenerating={isGenerating}
      />

      {/* 2. Main Studio Workspace (Mobile First + Desktop Responsive Grid) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-5 lg:p-6">
        {/* Mobile View: Render active tab cleanly */}
        <div className="md:hidden space-y-4">
          {activeTab === 'create' && (
            <>
              <CreationPanel
                presets={presets}
                prompt={prompt}
                setPrompt={setPrompt}
                styleId={styleId}
                setStyleId={setStyleId}
                resolutionId={resolutionId}
                setResolutionId={setResolutionId}
                fps={fps}
                setFps={setFps}
                accent={accent}
                setAccent={setAccent}
                effort={effort}
                setEffort={setEffort}
                voice={voice}
                setVoice={setVoice}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                keyCount={keys.length}
              />
              <VercelKeysInfoCard
                keyCount={keys.length}
                onOpenKeysModal={() => setIsKeysModalOpen(true)}
              />
            </>
          )}

          {activeTab === 'player' && (
            <div className="space-y-4">
              {isGenerating && (
                <LiveProgress currentEvent={currentEvent} logs={logs} />
              )}
              <ReelPlayer reel={activeReel} />
            </div>
          )}

          {activeTab === 'inspector' && (
            <SceneInspector
              scenes={activeScenes}
              title={activeTitle || activeReel?.title}
              motivo={activeMotivo}
            />
          )}

          {activeTab === 'logs' && (
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-xs">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  Console do Estúdio
                </span>
                <button
                  onClick={() => setLogs([])}
                  className="text-zinc-500 hover:text-zinc-300 text-[11px]"
                >
                  Limpar
                </button>
              </div>
              <div className="bg-black/60 border border-white/[0.06] rounded-xl p-3 font-mono text-[11px] h-80 overflow-y-auto space-y-2 leading-relaxed text-zinc-300">
                {logs.length === 0 ? (
                  <div className="text-zinc-600 text-xs py-4 text-center">Nenhum log registrado ainda.</div>
                ) : (
                  logs.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <span className="text-zinc-600 shrink-0">[{item.time}]</span>
                      <span className={item.text.includes('Erro') ? 'text-rose-400' : 'text-zinc-300'}>
                        {item.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop View: 2-Column Responsive Workspace */}
        <div className="hidden md:grid md:grid-cols-12 gap-6">
          {/* Left Column: Studio Parameters & Creation */}
          <div className="md:col-span-5 space-y-4">
            <CreationPanel
              presets={presets}
              prompt={prompt}
              setPrompt={setPrompt}
              styleId={styleId}
              setStyleId={setStyleId}
              resolutionId={resolutionId}
              setResolutionId={setResolutionId}
              fps={fps}
              setFps={setFps}
              accent={accent}
              setAccent={setAccent}
              effort={effort}
              setEffort={setEffort}
              voice={voice}
              setVoice={setVoice}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              keyCount={keys.length}
            />
            <VercelKeysInfoCard
              keyCount={keys.length}
              onOpenKeysModal={() => setIsKeysModalOpen(true)}
            />
          </div>

          {/* Right Column: Player & Active Workspace Tab */}
          <div className="md:col-span-7 flex flex-col space-y-4">
            {isGenerating ? (
              <div className="space-y-4">
                <LiveProgress currentEvent={currentEvent} logs={logs} />
                {activeReel && (
                  <div className="opacity-40 pointer-events-none">
                    <ReelPlayer reel={activeReel} />
                  </div>
                )}
              </div>
            ) : (
              <>
                {activeTab === 'create' || activeTab === 'player' ? (
                  <ReelPlayer reel={activeReel} />
                ) : activeTab === 'inspector' ? (
                  <SceneInspector
                    scenes={activeScenes}
                    title={activeTitle || activeReel?.title}
                    motivo={activeMotivo}
                  />
                ) : (
                  <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-xs">
                      <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-amber-400" />
                        Histórico do Console do Estúdio
                      </span>
                      <button
                        onClick={() => setLogs([])}
                        className="text-zinc-500 hover:text-zinc-300 text-[11px]"
                      >
                        Limpar Logs
                      </button>
                    </div>
                    <div className="bg-black/60 border border-white/[0.06] rounded-2xl p-4 font-mono text-[11px] h-96 overflow-y-auto space-y-2 leading-relaxed text-zinc-300">
                      {logs.length === 0 ? (
                        <div className="text-zinc-600 text-xs py-8 text-center">Nenhum log registrado ainda.</div>
                      ) : (
                        logs.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-zinc-600 shrink-0 select-none">[{item.time}]</span>
                            <span className={item.text.includes('Erro') ? 'text-rose-400' : 'text-zinc-300'}>
                              {item.text}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* 3. Mobile Floating iOS Tab Bar */}
      <MobileTabBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenKeys={() => setIsKeysModalOpen(true)}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        keyCount={keys.length}
        isGenerating={isGenerating}
      />

      {/* 4. Apple Sheet Modals */}
      <KeysModal
        isOpen={isKeysModalOpen}
        onClose={() => setIsKeysModalOpen(false)}
        keys={keys}
        onSaveKeys={handleSaveKeys}
        onResetKeys={handleResetKeys}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        reels={reels}
        onSelectReel={handleSelectReel}
        onDeleteReel={handleDeleteReel}
        activeReelId={activeReel?.id}
      />
    </div>
  );
}
