import { ShowreelItem, ApiKeyItem, PresetsConfig, SceneData, ReelDNA } from '../types';

const DB_NAME = 'motion_reel_studio_db';
const DB_VERSION = 1;
const REELS_STORE = 'reels';
const KEYS_STORAGE_KEY = 'motion_reel_gemini_keys';
const PREFS_STORAGE_KEY = 'motion_reel_user_prefs';
const ACTIVE_REEL_KEY = 'motion_reel_active_id';

export interface UserPreferences {
  prompt: string;
  styleId: number;
  resolutionId: number;
  fps: number;
  accent: string;
  effort: number;
  voice: string;
}

// -------------------------------------------------------------
// IndexedDB Helper for persistent storage (unlimited capacity)
// -------------------------------------------------------------
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB não suportado neste navegador'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(REELS_STORE)) {
        db.createObjectStore(REELS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// -------------------------------------------------------------
// Keys Persistence (localStorage)
// -------------------------------------------------------------
export function getSavedKeys(): string[] {
  try {
    const raw = localStorage.getItem(KEYS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(k => typeof k === 'string' && k.trim().length >= 15);
    }
    return [];
  } catch (e) {
    console.warn('Erro ao ler chaves do localStorage:', e);
    return [];
  }
}

export function saveKeysToStorage(keys: string[]): void {
  try {
    const cleaned = keys
      .map(k => String(k).trim().replace(/['"]/g, ''))
      .filter((k, idx, arr) => k.length >= 15 && arr.indexOf(k) === idx);
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.error('Erro ao salvar chaves no localStorage:', e);
  }
}

export function clearKeysFromStorage(): void {
  try {
    localStorage.removeItem(KEYS_STORAGE_KEY);
  } catch (e) {}
}

// -------------------------------------------------------------
// Preferences Persistence (localStorage)
// -------------------------------------------------------------
export function getSavedPreferences(): Partial<UserPreferences> {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export function savePreferencesToStorage(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {}
}

export function getSavedActiveReelId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_REEL_KEY);
  } catch (e) {
    return null;
  }
}

export function saveActiveReelId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_REEL_KEY, id);
  } catch (e) {}
}

// -------------------------------------------------------------
// Reels Persistence (IndexedDB with localStorage fallback)
// -------------------------------------------------------------
export async function saveReelToDatabase(reel: ShowreelItem): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(REELS_STORE, 'readwrite');
      const store = tx.objectStore(REELS_STORE);
      const req = store.put(reel);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Fallback para localStorage ao salvar reel:', e);
    try {
      // Salva resumo leve no localStorage se IndexedDB falhar
      const key = `reel_item_${reel.id}`;
      localStorage.setItem(key, JSON.stringify({
        ...reel,
        // Limita o tamanho de fallback se for crítico
        htmlContent: reel.htmlContent?.slice(0, 100000)
      }));
      const listRaw = localStorage.getItem('reel_ids_index') || '[]';
      const list: string[] = JSON.parse(listRaw);
      if (!list.includes(reel.id)) {
        list.unshift(reel.id);
        localStorage.setItem('reel_ids_index', JSON.stringify(list.slice(0, 30)));
      }
    } catch (storageErr) {
      console.error('Falha ao salvar no localStorage:', storageErr);
    }
  }
}

export async function getAllSavedReels(): Promise<ShowreelItem[]> {
  try {
    const db = await openDatabase();
    return await new Promise<ShowreelItem[]>((resolve, reject) => {
      const tx = db.transaction(REELS_STORE, 'readonly');
      const store = tx.objectStore(REELS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const results: ShowreelItem[] = req.result || [];
        // Ordena por data decrescente (mais recentes primeiro)
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Erro no IndexedDB ao listar reels, tentando localStorage:', e);
    const reels: ShowreelItem[] = [];
    try {
      const listRaw = localStorage.getItem('reel_ids_index') || '[]';
      const list: string[] = JSON.parse(listRaw);
      for (const id of list) {
        const itemRaw = localStorage.getItem(`reel_item_${id}`);
        if (itemRaw) {
          reels.push(JSON.parse(itemRaw));
        }
      }
    } catch (err) {}
    return reels;
  }
}

export async function getReelById(id: string): Promise<ShowreelItem | null> {
  try {
    const db = await openDatabase();
    return await new Promise<ShowreelItem | null>((resolve, reject) => {
      const tx = db.transaction(REELS_STORE, 'readonly');
      const store = tx.objectStore(REELS_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    try {
      const itemRaw = localStorage.getItem(`reel_item_${id}`);
      return itemRaw ? JSON.parse(itemRaw) : null;
    } catch (err) {
      return null;
    }
  }
}

export async function deleteReelFromDatabase(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(REELS_STORE, 'readwrite');
      const store = tx.objectStore(REELS_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {}

  try {
    localStorage.removeItem(`reel_item_${id}`);
    const listRaw = localStorage.getItem('reel_ids_index') || '[]';
    const list: string[] = JSON.parse(listRaw).filter((x: string) => x !== id);
    localStorage.setItem('reel_ids_index', JSON.stringify(list));
  } catch (e) {}
}

/**
 * Cria ou recupera uma Blob URL para renderizar o reel dentro do iframe com segurança
 */
export function getOrCreateReelBlobUrl(reel: ShowreelItem): string {
  if (reel.htmlContent && typeof window !== 'undefined' && window.URL) {
    const blob = new Blob([reel.htmlContent], { type: 'text/html; charset=utf-8' });
    return URL.createObjectURL(blob);
  }
  return reel.htmlUrl;
}
