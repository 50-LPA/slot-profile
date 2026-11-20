import { normalizeStatement } from './model.js';

const KEY = 'statement-builder.v1';
let memory = [];
let persistent = true;

/** Saved statements live in this browser's localStorage. Falls back to memory if storage is blocked. */
export function loadAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    memory = Array.isArray(raw) ? raw.map(normalizeStatement).filter(Boolean) : [];
  } catch {
    persistent = false;
  }
  return memory;
}

/**
 * Persists statements to localStorage with QuotaExceeded safeguards.
 * If total payload approaches browser quota (5 MB), prunes older statements
 * to protect the current active statement without crashing.
 */
export function saveAll(list) {
  memory = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    persistent = true;
  } catch (err) {
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014;

    if (isQuota && Array.isArray(list) && list.length > 1) {
      try {
        // Sort by recency and keep only the latest 2 statements to stay within quota
        const sorted = [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        localStorage.setItem(KEY, JSON.stringify(sorted.slice(0, 2)));
        persistent = true;
        return persistent;
      } catch {
        persistent = false;
      }
    } else {
      persistent = false;
    }
  }
  return persistent;
}

export const isPersistent = () => persistent;
