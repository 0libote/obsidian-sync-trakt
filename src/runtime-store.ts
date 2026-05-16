import type { App } from "obsidian";
import { EMPTY_HISTORY_STATE, type HistoryState, type TmdbCache } from "./types";

export const RUNTIME_STORAGE_SCHEMA_VERSION = 1 as const;
const RUNTIME_DB_NAME = "sync-trakt-runtime";
const RUNTIME_STORE_NAME = "runtime";
export const RUNTIME_STORAGE_KEY_PREFIX = "sync-trakt:runtime:v1";

export interface RuntimeStoragePayload {
  schemaVersion: typeof RUNTIME_STORAGE_SCHEMA_VERSION;
  tmdbCache: TmdbCache;
  historyState: HistoryState;
}

type RuntimeBackend = "indexeddb" | "localStorage";
type RuntimeCarrier = {
  tmdbCache?: TmdbCache;
  historyState?: Partial<HistoryState>;
};

function vaultName(app: App): string {
  const maybeVault = app.vault as unknown as { getName?: () => string };
  const name = maybeVault.getName?.() || "default-vault";
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export function runtimeStorageKey(app: App): string {
  return `${RUNTIME_STORAGE_KEY_PREFIX}:${vaultName(app)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isRuntimeStoragePayload(
  value: unknown,
): value is RuntimeStoragePayload {
  if (!isObject(value)) return false;
  return (
    value.schemaVersion === RUNTIME_STORAGE_SCHEMA_VERSION &&
    isObject(value.tmdbCache) &&
    isObject(value.historyState)
  );
}

export function syncedPayloadContainsRuntimeData(
  synced: RuntimeCarrier | null | undefined,
): boolean {
  if (!synced) return false;
  const tmdbEntries = Object.keys(synced.tmdbCache ?? {}).length;
  const history = synced.historyState;
  if (!history) return tmdbEntries > 0;
  return (
    tmdbEntries > 0 ||
    Object.keys(history.byMovie ?? {}).length > 0 ||
    Object.keys(history.byShow ?? {}).length > 0 ||
    (history.knownEventIds ?? []).length > 0 ||
    !!history.lastIncrementalSyncAt ||
    !!history.lastFullRefreshAt
  );
}

export function buildSlimSyncedHistoryState(state: HistoryState): HistoryState {
  return {
    ...EMPTY_HISTORY_STATE,
    lastDailyNoteSyncedAt: state.lastDailyNoteSyncedAt || "",
    lastAuthoritativeFullRefreshAt: state.lastAuthoritativeFullRefreshAt,
    lastReleaseNoticeVersion: state.lastReleaseNoticeVersion,
  };
}

export function mergeSyncedHistoryFields(
  runtimeHistory: Partial<HistoryState>,
  syncedHistory?: Partial<HistoryState>,
): HistoryState {
  return {
    ...EMPTY_HISTORY_STATE,
    ...runtimeHistory,
    lastDailyNoteSyncedAt:
      syncedHistory?.lastDailyNoteSyncedAt ??
      runtimeHistory.lastDailyNoteSyncedAt ??
      "",
    lastAuthoritativeFullRefreshAt:
      syncedHistory?.lastAuthoritativeFullRefreshAt ??
      runtimeHistory.lastAuthoritativeFullRefreshAt,
    lastReleaseNoticeVersion:
      syncedHistory?.lastReleaseNoticeVersion ??
      runtimeHistory.lastReleaseNoticeVersion,
  };
}

function idbAvailable(): boolean {
  return typeof globalThis.indexedDB !== "undefined";
}

function idbError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(RUNTIME_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RUNTIME_STORE_NAME)) {
        db.createObjectStore(RUNTIME_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(idbError(request.error, "IndexedDB open failed"));
  });
}

async function idbRead(key: string): Promise<unknown> {
  if (!idbAvailable()) return null;
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(RUNTIME_STORE_NAME, "readonly");
      const store = tx.objectStore(RUNTIME_STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () =>
        reject(idbError(request.error, "IndexedDB read failed"));
    });
  } finally {
    db.close();
  }
}

async function idbWrite(key: string, payload: RuntimeStoragePayload): Promise<void> {
  if (!idbAvailable()) throw new Error("IndexedDB is unavailable");
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RUNTIME_STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(idbError(tx.error, "IndexedDB write failed"));
      tx.onabort = () => reject(idbError(tx.error, "IndexedDB write aborted"));
      tx.objectStore(RUNTIME_STORE_NAME).put(payload, key);
    });
  } finally {
    db.close();
  }
}

async function idbDelete(key: string): Promise<void> {
  if (!idbAvailable()) throw new Error("IndexedDB is unavailable");
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RUNTIME_STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(idbError(tx.error, "IndexedDB delete failed"));
      tx.onabort = () => reject(idbError(tx.error, "IndexedDB delete aborted"));
      tx.objectStore(RUNTIME_STORE_NAME).delete(key);
    });
  } finally {
    db.close();
  }
}

export class RuntimeStore {
  private app: App;
  private key: string;
  private lastBackend: RuntimeBackend | null = null;

  constructor(app: App, key = runtimeStorageKey(app)) {
    this.app = app;
    this.key = key;
  }

  get storageKey(): string {
    return this.key;
  }

  get backend(): RuntimeBackend | null {
    return this.lastBackend;
  }

  async load(): Promise<RuntimeStoragePayload | null> {
    try {
      const fromIdb = await idbRead(this.key);
      if (isRuntimeStoragePayload(fromIdb)) {
        this.lastBackend = "indexeddb";
        return fromIdb;
      }
    } catch (e) {
      console.warn("[Traktr] Failed to load runtime cache from IndexedDB:", e);
    }

    const localValue = this.app.loadLocalStorage(this.key) as unknown;
    if (isRuntimeStoragePayload(localValue)) {
      this.lastBackend = "localStorage";
      return localValue;
    }
    return null;
  }

  async save(payload: RuntimeStoragePayload): Promise<void> {
    if (idbAvailable()) {
      try {
        await idbWrite(this.key, payload);
        this.lastBackend = "indexeddb";
        return;
      } catch (e) {
        console.warn(
          "[Traktr] Failed to save runtime cache to IndexedDB; falling back to localStorage:",
          e,
        );
      }
    }

    this.app.saveLocalStorage(this.key, payload);
    this.lastBackend = "localStorage";
  }

  async clear(): Promise<void> {
    if (idbAvailable()) {
      try {
        await idbDelete(this.key);
      } catch (e) {
        console.warn("[Traktr] Failed to clear runtime cache from IndexedDB:", e);
      }
    }
    this.app.saveLocalStorage(this.key, null);
    this.lastBackend = null;
  }
}
