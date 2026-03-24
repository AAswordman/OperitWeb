const SPECIAL_MARKDOWN_ROOTS = new Set(['plugin-tutorial', 'newcontent']);

const normalizeMarkdownValue = (value: string) => (
  String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\.md$/i, '')
);

export const buildMarkdownCandidates = (
  file: string,
  language: 'zh' | 'en',
): string[] => {
  const normalizedFile = normalizeMarkdownValue(file);
  if (!normalizedFile) {
    return [];
  }

  const [root, ...rest] = normalizedFile.split('/');
  if (SPECIAL_MARKDOWN_ROOTS.has(root) && rest.length > 0) {
    const relativePath = rest.join('/');
    const candidates = [`${root}/${language}/${relativePath}.md`];
    if (language === 'en') {
      candidates.push(`${root}/zh/${relativePath}.md`);
    }
    return candidates;
  }

  const candidates = [`content/${language}/${normalizedFile}.md`];
  if (language === 'en') {
    candidates.push(`content/zh/${normalizedFile}.md`);
  }
  return candidates;
};

export const isEditableMarkdownPath = (targetPath: string): boolean => {
  const normalizedPath = String(targetPath || '').trim().replace(/^\/+/, '');
  if (normalizedPath.startsWith('content/')) {
    return true;
  }

  for (const root of SPECIAL_MARKDOWN_ROOTS) {
    if (normalizedPath.startsWith(`${root}/`)) {
      return true;
    }
  }

  return false;
};
