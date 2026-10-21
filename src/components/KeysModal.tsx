import React, { useState } from 'react';
import { X, Key, Plus, Trash2, RotateCw, Check, Copy, AlertCircle, Shield, FileText, ExternalLink, Sparkles } from 'lucide-react';
import { ApiKeyItem } from '../types';

interface KeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  keys: ApiKeyItem[];
  onSaveKeys: (newKeys: string[]) => Promise<void>;
  onResetKeys: () => Promise<void>;
}

export const KeysModal: React.FC<KeysModalProps> = ({
  isOpen,
  onClose,
  keys,
  onSaveKeys,
  onResetKeys
}) => {
  const [keyList, setKeyList] = useState<string[]>(keys.map(k => k.key));
  const [newKey, setNewKey] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  React.useEffect(() => {
    setKeyList(keys.map(k => k.key));
  }, [keys]);

  if (!isOpen) return null;

  const handleAddSingleKey = () => {
    const clean = newKey.trim().replace(/['"]/g, '');
    if (clean.length < 15) {
      alert('A chave deve conter pelo menos 15 caracteres.');
      return;
    }
    if (keyList.includes(clean)) {
      alert('Esta chave já está na lista.');
      return;
    }
    setKeyList(prev => [...prev, clean]);
    setNewKey('');
  };

  const handleAddBulk = () => {
    if (!bulkInput.trim()) return;
    const parts = bulkInput.split(/[\n,\s;]+/);
    const added: string[] = [];
    for (const p of parts) {
      const clean = p.trim().replace(/['"]/g, '');
      if (clean.length >= 15 && !keyList.includes(clean) && !added.includes(clean)) {
        added.push(clean);
      }
    }
    if (added.length === 0) {
      alert('Nenhuma chave válida encontrada.');
      return;
    }
    setKeyList(prev => [...prev, ...added]);
    setBulkInput('');
    setShowBulk(false);
  };

  const handleRemoveKey = (index: number) => {
    setKeyList(prev => prev.filter((_, i) => i !== index));
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(keyList.join('\n'));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveKeys(keyList);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      alert('Erro ao salvar: ' + (e as any).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Deseja restaurar as 13 chaves padrão da Gemini?')) {
      await onResetKeys();
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
              <Key className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-100 flex items-center gap-2">
                Chaves Gemini API
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-amber-300 font-mono">
                  {keyList.length}
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                Rodízio automático em cada cena e descanso em cota 429
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

        {/* Info Banner */}
        <div className="px-5 sm:px-6 py-3 bg-amber-500/[0.04] border-b border-amber-500/10 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            <strong className="text-amber-300">Sem variáveis de ambiente:</strong> As chaves são inseridas diretamente aqui e ficam salvas com segurança no armazenamento permanente do seu navegador (<code className="text-amber-300 bg-white/5 px-1 py-0.5 rounded font-mono text-[10px]">localStorage</code>). <span className="text-emerald-400 font-medium">Elas não somem ao atualizar a tela ou ao hospedar na Vercel.</span> O sistema faz o <strong>rodízio automático</strong> entre elas a cada cena gerada e gerencia limites de cota (429) automaticamente.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Direct Link to Google AI Studio */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-amber-500/10 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Onde pegar sua chave da Gemini gratuitamente?</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Acesse o Google AI Studio &rarr; Toque em <strong>"Create API key"</strong> &rarr; Copie e cole abaixo.
              </p>
            </div>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-full bg-blue-500 hover:bg-blue-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0 shadow-sm cursor-pointer"
            >
              <span>Abrir Google AI Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Add Key Input */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                Adicionar Chaves
              </label>
              <button
                type="button"
                onClick={() => setShowBulk(!showBulk)}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                {showBulk ? 'Chave Única' : 'Colar Lista em Lote'}
              </button>
            </div>

            {!showBulk ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Cole aqui a chave Gemini (AIzaSy... ou AQ.Ab...)"
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSingleKey()}
                  className="flex-1 bg-black/60 border border-white/[0.08] focus:border-amber-400/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleAddSingleKey}
                  disabled={!newKey.trim()}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Inserir
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  placeholder="Cole várias chaves (uma por linha, com vírgula ou espaço)..."
                  value={bulkInput}
                  onChange={e => setBulkInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/[0.08] focus:border-amber-400/80 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none font-mono resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulk(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddBulk}
                    disabled={!bulkInput.trim()}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 text-zinc-950 text-xs font-semibold"
                  >
                    Adicionar Todas
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Key List Display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Chaves Cadastradas ({keyList.length})</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyAll}
                  className="hover:text-amber-300 transition flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  {copySuccess ? 'Copiado!' : 'Copiar Todas'}
                </button>
                {keyList.length > 0 && (
                  <button
                    onClick={() => setKeyList([])}
                    className="text-rose-400 hover:text-rose-300 transition cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            <div className="border border-white/[0.08] rounded-2xl bg-black/40 divide-y divide-white/[0.06] max-h-56 overflow-y-auto">
              {keyList.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  <AlertCircle className="w-7 h-7 text-zinc-600 mx-auto mb-2" />
                  Nenhuma chave configurada. Modo offline com cenas de fallback.
                </div>
              ) : (
                keyList.map((k, index) => {
                  const isStandard = k.startsWith('AIza');
                  const isAQ = k.startsWith('AQ.');
                  const masked = k.length > 12 ? `${k.slice(0, 7)}••••••••${k.slice(-4)}` : k;

                  return (
                    <div
                      key={index}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-white/5 text-zinc-400 flex items-center justify-center font-mono text-[10px] shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-mono text-zinc-200 truncate flex items-center gap-1.5">
                            <span>{masked}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-sans ${
                              isStandard 
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                : (isAQ ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-zinc-800 text-zinc-400')
                            }`}>
                              {isStandard ? 'AIza' : (isAQ ? 'AQ' : 'Key')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(k);
                            alert('Chave copiada!');
                          }}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 active:scale-90 transition cursor-pointer"
                          title="Copiar chave"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveKey(index)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 active:scale-90 transition cursor-pointer"
                          title="Remover chave"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions (Apple Sheet Bottom) */}
        <div className="px-5 sm:px-6 py-4 bg-zinc-950/90 border-t border-white/[0.08] flex items-center justify-between gap-3 safe-bottom">
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Restaurar 13 Padrão
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-white/[0.08] hover:bg-white/5 active:scale-95 text-xs font-medium text-zinc-300 transition cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-500/10"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-zinc-950" />
                  Salvo!
                </>
              ) : isSaving ? (
                'Salvando...'
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
