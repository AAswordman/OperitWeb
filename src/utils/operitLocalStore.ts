export type OperitEditorMode = 'visual' | 'markdown';
export type OperitViewMode = 'edit' | 'split' | 'preview';

export interface OperitProfile {
  authorName: string;
  authorEmail: string;
  editorMode: OperitEditorMode;
  viewMode: OperitViewMode;
  fontSize: number;
}

export interface OperitDraft {
  target_path: string;
  title: string;
  content: string;
  author_name: string;
  author_email: string;
  updated_at: string;
}

export interface OperitHistoryEntry {
  id: string;
  status: string;
  created_at: string;
  title: string;
  target_path: string;
  language: string;
}

export interface OperitProgressEntry {
  status: 'edited' | 'submitted';
  updated_at: string;
  title: string;
}

export interface OperitTemplate {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

const PROFILE_KEY = 'operit_submission_profile';
const HISTORY_KEY = 'operit_submission_history';
const PROGRESS_KEY = 'operit_submission_progress';
const TEMPLATE_KEY = 'operit_submission_templates';
const DRAFT_PREFIX = 'operit_submission_draft:';

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

export const getOperitProfile = (): OperitProfile => {
  const fallback: OperitProfile = {
    authorName: '',
    authorEmail: '',
    editorMode: 'visual',
    viewMode: 'split',
    fontSize: 14,
  };
  return safeParse<OperitProfile>(localStorage.getItem(PROFILE_KEY), fallback);
};

export const saveOperitProfile = (profile: OperitProfile) => {
  const payload = safeStringify(profile);
  if (!payload) return;
  localStorage.setItem(PROFILE_KEY, payload);
};

export const getOperitHistory = (): OperitHistoryEntry[] => {
  const data = safeParse<OperitHistoryEntry[]>(localStorage.getItem(HISTORY_KEY), []);
  return Array.isArray(data) ? data : [];
};

export const saveOperitHistory = (items: OperitHistoryEntry[]) => {
  const payload = safeStringify(items);
  if (!payload) return;
  localStorage.setItem(HISTORY_KEY, payload);
};

export const getOperitProgress = (): Record<string, OperitProgressEntry> => {
  const data = safeParse<Record<string, OperitProgressEntry>>(localStorage.getItem(PROGRESS_KEY), {});
  return data && typeof data === 'object' ? data : {};
};

export const saveOperitProgress = (progress: Record<string, OperitProgressEntry>) => {
  const payload = safeStringify(progress);
  if (!payload) return;
  localStorage.setItem(PROGRESS_KEY, payload);
};

export const setOperitProgressEntry = (targetPath: string, entry: OperitProgressEntry) => {
  if (!targetPath) return;
  const progress = getOperitProgress();
  progress[targetPath] = entry;
  saveOperitProgress(progress);
};

export const getOperitTemplates = (): OperitTemplate[] => {
  const data = safeParse<OperitTemplate[]>(localStorage.getItem(TEMPLATE_KEY), []);
  return Array.isArray(data) ? data : [];
};

export const saveOperitTemplates = (items: OperitTemplate[]) => {
  const payload = safeStringify(items);
  if (!payload) return;
  localStorage.setItem(TEMPLATE_KEY, payload);
};

export const getOperitDraft = (targetPath: string) => {
  if (!targetPath) return null;
  const key = `${DRAFT_PREFIX}${targetPath}`;
  return safeParse<OperitDraft | null>(localStorage.getItem(key), null);
};

export const saveOperitDraft = (draft: OperitDraft) => {
  if (!draft?.target_path) return;
  const payload = safeStringify(draft);
  if (!payload) return;
  localStorage.setItem(`${DRAFT_PREFIX}${draft.target_path}`, payload);
};

export const deleteOperitDraft = (targetPath: string) => {
  if (!targetPath) return;
  localStorage.removeItem(`${DRAFT_PREFIX}${targetPath}`);
};

export const listOperitDrafts = (): OperitDraft[] => {
  const drafts: OperitDraft[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(DRAFT_PREFIX)) continue;
    const draft = safeParse<OperitDraft | null>(localStorage.getItem(key), null);
    if (draft?.target_path) {
      drafts.push(draft);
    }
  }
  return drafts.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
};

export const exportOperitLocalData = () => ({
  profile: getOperitProfile(),
  history: getOperitHistory(),
  progress: getOperitProgress(),
  templates: getOperitTemplates(),
  drafts: listOperitDrafts(),
});

export const importOperitLocalData = (data: {
  profile?: OperitProfile;
  history?: OperitHistoryEntry[];
  progress?: Record<string, OperitProgressEntry>;
  templates?: OperitTemplate[];
  drafts?: OperitDraft[];
}) => {
  if (data.profile) saveOperitProfile(data.profile);
  if (data.history) saveOperitHistory(data.history);
  if (data.progress) saveOperitProgress(data.progress);
  if (data.templates) saveOperitTemplates(data.templates);
  if (data.drafts) {
    data.drafts.forEach(saveOperitDraft);
  }
};

export const clearOperitLocalData = () => {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(PROGRESS_KEY);
  localStorage.removeItem(TEMPLATE_KEY);
  const draftKeys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(DRAFT_PREFIX)) {
      draftKeys.push(key);
    }
  }
  draftKeys.forEach(key => localStorage.removeItem(key));
};
