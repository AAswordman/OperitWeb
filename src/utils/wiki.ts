export const WIKI_PATH = '/v1/guide/wiki';

export interface WikiPage {
  id: string;
  title: string;
  chapter: string;
  module: string;
  status: string;
  updated: string;
  summary: string;
  sourceCommit: string;
  sourceRepository: string;
  facts: number;
  issue: number | null;
  links: string[];
  artifacts: { name: string; path: string }[];
  original: string;
  originalSha256: string;
  contentSha256: string;
}

export interface WikiManifest {
  schemaVersion: number;
  repository: string;
  revision: string;
  upstreamUpdated: string;
  copyright: string;
  counts: { entries: number; articles: number; facts: number; findings: number; links: number };
  chapters: { title: string; entries: string[] }[];
  pages: WikiPage[];
}

export interface WikiSearchDocument { id: string; title: string; chapter: string; text: string }
export interface WikiSearchResult { page: WikiPage; excerpt: string; score: number }
export interface WikiFinding {
  id: string; page: string; pageTitle: string; sourceCommit: string;
  severity: 'high' | 'warning' | 'suggestion' | 'unspecified'; originalSeverity: string | null;
  category: string; title: string; detail: string; evidence: string;
  confidence: string; file: string; line: number; raw: Record<string, unknown>;
}

export const wikiAssetUrl = (path: string, base = import.meta.env.BASE_URL) => `${base}operit-wiki/${path}`;
export const wikiPagePath = (id: string) => `${WIKI_PATH}/${id}`;

export function sourceReferenceUrl(commit: string, reference: string): string | undefined {
  const match = reference.match(/^([^\s:#?]+):(\d+)(?:[-–](\d+))?$/);
  if (!/^[a-f0-9]{40}$/.test(commit) || !match || Number(match[2]) < 1 || (match[3] && Number(match[3]) < Number(match[2])) || match[1].split('/').some(part => part === '..' || part === '.' || !part)) return undefined;
  return `https://github.com/AAswordman/Operit/blob/${commit}/${match[1].split('/').map(encodeURIComponent).join('/')}#L${match[2]}${match[3] ? `-L${match[3]}` : ''}`;
}

export function searchWiki(pages: WikiPage[], documents: WikiSearchDocument[], query: string): WikiSearchResult[] {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const byId = new Map(documents.map(document => [document.id, document]));
  return pages.flatMap(page => {
    const document = byId.get(page.id);
    const title = page.title.toLocaleLowerCase();
    const text = document?.text || page.summary;
    const haystack = `${title} ${page.id} ${page.chapter} ${text}`.toLocaleLowerCase();
    if (!tokens.every(token => haystack.includes(token))) return [];
    const score = tokens.reduce((value, token) => value + (title.includes(token) ? 100 : page.id.includes(token) ? 50 : 10), 0);
    const position = text.toLocaleLowerCase().indexOf(tokens.find(token => text.toLocaleLowerCase().includes(token)) || tokens[0]);
    const start = Math.max(0, position - 35);
    const excerpt = text.slice(start, start + 150).replace(/[#*`>]/g, '').replaceAll('[', '').replaceAll(']', '').replace(/\s+/g, ' ').trim();
    return [{ page, excerpt, score }];
  }).sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title, 'zh'));
}

export function wikiNeighbors(pages: WikiPage[], id: string) {
  const current = pages.find(page => page.id === id);
  return {
    outgoing: pages.filter(page => current?.links.includes(page.id)),
    incoming: pages.filter(page => page.id !== id && page.links.includes(id)),
  };
}
