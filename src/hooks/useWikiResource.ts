import { useEffect, useState } from 'react';
import { wikiAssetUrl } from '../utils/wiki';

const requests = new Map<string, Promise<unknown>>();
export function loadWikiJson<T>(path: string): Promise<T> {
  let request = requests.get(path);
  if (!request) {
    request = fetch(wikiAssetUrl(path)).then(async response => {
      if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error(`Wiki resource unavailable: ${path} (${response.status})`);
      return response.json();
    }).catch(error => { requests.delete(path); throw error; });
    requests.set(path, request);
  }
  return request as Promise<T>;
}

export function useWikiResource<T>(path: string | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ path: string; attempt: number; data?: T; error?: string }>();
  useEffect(() => {
    if (!path) return;
    let active = true;
    void loadWikiJson<T>(path).then(data => {
      if (active) setResult({ path, attempt, data });
    }).catch((error: unknown) => {
      if (active) setResult({ path, attempt, error: error instanceof Error ? error.message : String(error) });
    });
    return () => { active = false; };
  }, [path, attempt]);
  const current = result?.path === path && result?.attempt === attempt ? result : undefined;
  return { data: current?.data, error: current?.error, loading: !!path && !current, retry: () => setAttempt(value => value + 1) };
}
