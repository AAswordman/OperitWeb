import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type {
  Root,
  RootContent,
  PhrasingContent,
  ListItem,
  TableCell,
  TableRow,
} from 'mdast';
import remarkDetails from '../remark/remarkDetails';
import remarkImageGallery from '../remark/remarkImageGallery';

const normalizeLineEndings = (value: string) => value.replace(/\r\n?/g, '\n');

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const escapeAttribute = (value: string) => escapeHtml(value).replace(/`/g, '&#96;');

interface MarkdownToVisualHtmlOptions {
  resolveImageUrl?: (uri: string) => string;
}

const renderHtmlNodeValue = (value: string, options?: MarkdownToVisualHtmlOptions) => {
  if (!value) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${value}</div>`, 'text/html');
  const container = doc.body.firstElementChild;
  if (!container) return '';

  const images = container.querySelectorAll('img');
  images.forEach(image => {
    const rawSrc = image.getAttribute('src') || '';
    if (!rawSrc) return;
    image.setAttribute('data-operit-src', rawSrc);
    const resolved = options?.resolveImageUrl?.(rawSrc) || rawSrc;
    image.setAttribute('src', resolved);
  });

  return container.innerHTML;
};

const mapDepthToHeadingTag = (depth: number) => {
  const safeDepth = Number.isFinite(depth) ? Math.min(6, Math.max(1, depth)) : 1;
  return `h${safeDepth}`;
};

const renderPhrasingNode = (node: PhrasingContent, options?: MarkdownToVisualHtmlOptions): string => {
  switch (node.type) {
    case 'text':
      return escapeHtml(node.value || '');
    case 'inlineCode':
      return `<code>${escapeHtml(node.value || '')}</code>`;
    case 'emphasis':
      return `<em>${(node.children || []).map(child => renderPhrasingNode(child, options)).join('')}</em>`;
    case 'strong':
      return `<strong>${(node.children || []).map(child => renderPhrasingNode(child, options)).join('')}</strong>`;
    case 'delete':
      return `<del>${(node.children || []).map(child => renderPhrasingNode(child, options)).join('')}</del>`;
    case 'link': {
      const href = node.url || '';
      const body = (node.children || []).map(child => renderPhrasingNode(child, options)).join('') || escapeHtml(href);
      return `<a href="${escapeAttribute(href)}">${body}</a>`;
    }
    case 'image':
      return buildImageHtml(node.alt || '', node.url || '', options);
    case 'break':
      return '<br />';
    case 'html':
      return renderHtmlNodeValue(node.value || '', options);
    default:
      return '';
  }
};

const renderPhrasingNodes = (nodes: PhrasingContent[], options?: MarkdownToVisualHtmlOptions) => {
  return nodes.map(node => renderPhrasingNode(node, options)).join('');
};

const renderListItemBody = (item: ListItem, options?: MarkdownToVisualHtmlOptions) => {
  const children = item.children || [];
  if (!children.length) return '';

  const fragments: string[] = [];
  for (const child of children) {
    if (child.type === 'paragraph') {
      fragments.push(renderPhrasingNodes(child.children || [], options));
      continue;
    }
    if (child.type === 'list') {
      fragments.push(renderBlockNode(child as RootContent, options));
      continue;
    }
    if (child.type === 'html') {
      fragments.push(renderHtmlNodeValue(child.value || '', options));
      continue;
    }
    fragments.push(renderBlockNode(child as RootContent, options));
  }

  return fragments.join('');
};

const renderTableRow = (row: TableRow, options?: MarkdownToVisualHtmlOptions) => {
  const cells = (row.children || []) as TableCell[];
  return cells
    .map(cell => `<td>${renderPhrasingNodes((cell.children || []) as PhrasingContent[], options)}</td>`)
    .join('');
};

const renderBlockNode = (node: RootContent, options?: MarkdownToVisualHtmlOptions): string => {
  switch (node.type) {
    case 'paragraph': {
      const children = (node.children || []) as PhrasingContent[];
      const imageChildren = children.filter(child => child.type === 'image') as PhrasingContent[];
      const nonWhitespaceChildren = children.filter(child => {
        if (child.type !== 'text') return true;
        return (child.value || '').trim().length > 0;
      });
      if (imageChildren.length > 1 && imageChildren.length === nonWhitespaceChildren.length) {
        const gallery = imageChildren
          .map(child => `<div class="image-container">${renderPhrasingNode(child, options)}</div>`)
          .join('');
        return `<div class="image-gallery">${gallery}</div>`;
      }
      const body = renderPhrasingNodes(children, options);
      if (!body.trim()) return '';
      if (imageChildren.length === 1 && imageChildren.length === nonWhitespaceChildren.length) {
        return `<p class="paragraph-with-image">${body}</p>`;
      }
      return `<p>${body}</p>`;
    }
    case 'heading': {
      const tag = mapDepthToHeadingTag(node.depth || 1);
      const body = renderPhrasingNodes((node.children || []) as PhrasingContent[], options);
      return `<${tag}>${body}</${tag}>`;
    }
    case 'blockquote': {
      const body = (node.children || []).map(child => renderBlockNode(child as RootContent, options)).join('');
      return `<blockquote>${body || '<p><br /></p>'}</blockquote>`;
    }
    case 'code': {
      const languageClass = node.lang ? ` class="language-${escapeAttribute(node.lang)}"` : '';
      return `<pre><code${languageClass}>${escapeHtml(node.value || '')}</code></pre>`;
    }
    case 'list': {
      const listTag = node.ordered ? 'ol' : 'ul';
      const items = (node.children || [])
        .map(item => `<li>${renderListItemBody(item as ListItem, options)}</li>`)
        .join('');
      return `<${listTag}>${items}</${listTag}>`;
    }
    case 'thematicBreak':
      return '<hr />';
    case 'table': {
      const rows = node.children || [];
      if (!rows.length) return '';
      const head = rows[0] as TableRow;
      const headCells = ((head.children || []) as TableCell[])
        .map(cell => `<th>${renderPhrasingNodes((cell.children || []) as PhrasingContent[], options)}</th>`)
        .join('');
      const bodyRows = rows.slice(1)
        .map(row => `<tr>${renderTableRow(row as TableRow, options)}</tr>`)
        .join('');
      const tbody = bodyRows ? `<tbody>${bodyRows}</tbody>` : '';
      return `<table><thead><tr>${headCells}</tr></thead>${tbody}</table>`;
    }
    case 'html':
      return renderHtmlNodeValue(node.value || '', options);
    default:
      return '';
  }
};

const markdownToVisualHtmlWithRemark = (markdown: string, options?: MarkdownToVisualHtmlOptions) => {
  const normalized = normalizeLineEndings(markdown || '');
  if (!normalized.trim()) return '';

  const processor = unified()
    .use(remarkParse)
    .use(remarkDetails)
    .use(remarkGfm)
    .use(remarkImageGallery);

  const tree = processor.parse(normalized) as Root;
  const transformed = processor.runSync(tree) as Root;
  return (transformed.children || [])
    .map(node => renderBlockNode(node as RootContent, options))
    .join('');
};

const buildImageHtml = (
  alt: string,
  rawSrc: string,
  options?: MarkdownToVisualHtmlOptions,
) => {
  const resolved = options?.resolveImageUrl?.(rawSrc) || rawSrc;
  return `<img alt="${escapeAttribute(alt)}" src="${escapeAttribute(resolved)}" data-operit-src="${escapeAttribute(rawSrc)}" />`;
};

export const markdownToVisualHtml = (markdown: string, options?: MarkdownToVisualHtmlOptions): string => {
  return markdownToVisualHtmlWithRemark(markdown, options);
};

const normalizeText = (value: string) => value.replace(/\u00A0/g, ' ');

const serializeInlineNodes = (nodes: ChildNode[]): string => nodes.map(node => {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeText(node.textContent || '').replace(/\s+/g, ' ');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'br') return '\n';
  if (tagName === 'strong' || tagName === 'b') return `**${serializeInlineNodes(Array.from(element.childNodes))}**`;
  if (tagName === 'em' || tagName === 'i') return `*${serializeInlineNodes(Array.from(element.childNodes))}*`;
  if (tagName === 'del' || tagName === 's' || tagName === 'strike') return `~~${serializeInlineNodes(Array.from(element.childNodes))}~~`;

  if (tagName === 'code') {
    if (element.parentElement?.tagName.toLowerCase() === 'pre') {
      return normalizeText(element.textContent || '');
    }
    return `\`${normalizeText(element.textContent || '')}\``;
  }

  if (tagName === 'a') {
    const href = element.getAttribute('href') || '';
    const label = serializeInlineNodes(Array.from(element.childNodes)).trim() || href;
    return `[${label}](${href})`;
  }

  if (tagName === 'img') {
    const src = element.getAttribute('data-operit-src') || element.getAttribute('src') || '';
    const alt = element.getAttribute('alt') || '';
    return `![${alt}](${src})`;
  }

  if (tagName === 'input') {
    const inputElement = element as HTMLInputElement;
    if (inputElement.type === 'checkbox') {
      return inputElement.checked ? '[x]' : '[ ]';
    }
  }

  return serializeInlineNodes(Array.from(element.childNodes));
}).join('');

const serializeList = (listElement: HTMLElement, ordered: boolean, depth = 0): string => {
  const lines: string[] = [];
  const listItems = Array.from(listElement.children).filter(child => child.tagName.toLowerCase() === 'li') as HTMLElement[];
  let order = 1;

  listItems.forEach(item => {
    const nestedLists = Array.from(item.children).filter(child => {
      const tag = child.tagName.toLowerCase();
      return tag === 'ul' || tag === 'ol';
    }) as HTMLElement[];

    const contentClone = item.cloneNode(true) as HTMLElement;
    Array.from(contentClone.children).forEach(child => {
      const tag = child.tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') {
        child.remove();
      }
    });

    const checkbox = contentClone.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    const checkboxPrefix = checkbox ? `${checkbox.checked ? '[x]' : '[ ]'} ` : '';
    if (checkbox) {
      checkbox.remove();
    }

    const marker = ordered ? `${order}.` : '-';
    const indent = '  '.repeat(depth);
    const content = serializeInlineNodes(Array.from(contentClone.childNodes)).trim();
    lines.push(`${indent}${marker} ${checkboxPrefix}${content}`.trimEnd());

    nestedLists.forEach(nested => {
      const nestedOrdered = nested.tagName.toLowerCase() === 'ol';
      const nestedMarkdown = serializeList(nested, nestedOrdered, depth + 1);
      if (nestedMarkdown) {
        lines.push(nestedMarkdown);
      }
    });

    order += 1;
  });

  return lines.join('\n');
};

const serializeTable = (table: HTMLElement): string => {
  const rows = Array.from(table.querySelectorAll('tr')).map(row => {
    const cells = Array.from(row.querySelectorAll('th, td')) as HTMLElement[];
    return cells.map(cell => serializeInlineNodes(Array.from(cell.childNodes)).trim().replace(/\|/g, '\\|'));
  }).filter(row => row.length > 0);

  if (!rows.length) return '';

  const header = rows[0];
  const bodyRows = rows.slice(1);
  const divider = header.map(() => '---');

  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
    ...bodyRows.map(row => `| ${row.join(' | ')} |`),
  ];

  return lines.join('\n');
};

const serializeBlockNodes = (nodes: ChildNode[]): string => nodes.map(node => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeText(node.textContent || '').trim();
    return text ? `${text}\n\n` : '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'p') {
    const text = serializeInlineNodes(Array.from(element.childNodes)).trim();
    return text ? `${text}\n\n` : '';
  }

  if (/^h[1-6]$/.test(tagName)) {
    const level = Number(tagName[1]);
    const text = serializeInlineNodes(Array.from(element.childNodes)).trim();
    return text ? `${'#'.repeat(level)} ${text}\n\n` : '';
  }

  if (tagName === 'blockquote') {
    const body = serializeBlockNodes(Array.from(element.childNodes)).trim();
    if (!body) return '';
    const lines = body.split('\n').map(line => (line ? `> ${line}` : '>'));
    return `${lines.join('\n')}\n\n`;
  }

  if (tagName === 'pre') {
    const codeElement = element.querySelector('code');
    const rawCode = normalizeText(codeElement?.textContent || element.textContent || '').replace(/\n$/, '');
    const className = codeElement?.getAttribute('class') || '';
    const language = /language-([\w-]+)/.exec(className)?.[1] || '';
    return `\`\`\`${language}\n${rawCode}\n\`\`\`\n\n`;
  }

  if (tagName === 'ul') {
    const listMarkdown = serializeList(element, false);
    return listMarkdown ? `${listMarkdown}\n\n` : '';
  }

  if (tagName === 'ol') {
    const listMarkdown = serializeList(element, true);
    return listMarkdown ? `${listMarkdown}\n\n` : '';
  }

  if (tagName === 'table') {
    const tableMarkdown = serializeTable(element);
    return tableMarkdown ? `${tableMarkdown}\n\n` : '';
  }

  if (tagName === 'hr') {
    return '---\n\n';
  }

  if (tagName === 'img') {
    const src = element.getAttribute('data-operit-src') || element.getAttribute('src') || '';
    const alt = element.getAttribute('alt') || '';
    return `![${alt}](${src})\n\n`;
  }

  if (tagName === 'details') {
    const summary = element.querySelector(':scope > summary')?.textContent?.trim() || '';
    const contentElement = element.querySelector(':scope > .markdown-details-content') as HTMLElement | null;
    const bodyMarkdown = contentElement
      ? serializeBlockNodes(Array.from(contentElement.childNodes)).trim()
      : '';
    const body = bodyMarkdown ? `\n${bodyMarkdown}\n` : '\n';
    return `[details="${summary}"]${body}[/details]\n\n`;
  }

  if (tagName === 'br') {
    return '\n';
  }

  const fallback = serializeInlineNodes(Array.from(element.childNodes)).trim();
  return fallback ? `${fallback}\n\n` : '';
}).join('');

export const htmlToVisualMarkdown = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstElementChild;
  if (!container) return '';

  return serializeBlockNodes(Array.from(container.childNodes))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
