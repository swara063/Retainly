const envAny = (import.meta as any).env || {};

function normalizeApiBase(rawBase: unknown) {
  const base = String(rawBase || '').trim();
  if (!base) return 'http://localhost:8000/api';
  if (base.endsWith('/api')) return base;
  if (base.endsWith('/api/')) return base.slice(0, -1);
  return `${base.replace(/\/+$/, '')}/api`;
}

export const API_BASE: string = normalizeApiBase(envAny.VITE_API_BASE_URL || envAny.VITE_API_BASE);
export const DEFAULT_BACKEND_ORIGIN = baseUrlFromApi(API_BASE);

export function baseUrlFromApi(apiBase: string) {
  const s = String(apiBase);
  if (s.endsWith('/api')) return s.slice(0, -4) || '/';
  if (s.endsWith('/api/')) return s.slice(0, -5) || '/';
  return s;
}

function isProbablyUnreachableError(e: unknown) {
  return e instanceof TypeError || /failed to fetch|networkerror/i.test(String((e as any)?.message || e));
}

export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (isProbablyUnreachableError(e)) throw new Error(`Backend not reachable at ${DEFAULT_BACKEND_ORIGIN}`);
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.detail || (data as any)?.message || `${res.status} ${res.statusText}`);
  return data as T;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function uploadCsvWithProgress(file: File, onProgress: (pct: number) => void): Promise<any> {
  return await new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/datasets/upload`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      onProgress(Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100))));
    };
    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      const resp = xhr.response || {};
      if (!ok) return reject(new Error(resp?.detail || `Upload failed (${xhr.status})`));
      resolve(resp);
    };
    xhr.onerror = () => reject(new Error(`Backend not reachable at ${DEFAULT_BACKEND_ORIGIN}`));
    xhr.send(body);
  });
}
