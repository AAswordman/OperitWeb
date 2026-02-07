import React, { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Button, Col, Input, Row, Space, Tooltip, Typography } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  CheckSquareOutlined,
  LinkOutlined,
  PictureOutlined,
  CodeOutlined,
  FileTextOutlined,
  BlockOutlined,
  FontSizeOutlined,
} from '@ant-design/icons';
import OperitMarkdownPreview from './OperitMarkdownPreview';
import type { OperitEditorMode, OperitViewMode } from '../utils/operitLocalStore';
import { htmlToVisualMarkdown, markdownToVisualHtml } from '../utils/operitVisualMarkdown';
import './OperitMarkdownEditor.css';

const { Text } = Typography;

const normalizeMarkdownValue = (input: string) => input
  .replace(/\r\n?/g, '\n')
  .replace(/\u00A0/g, ' ')
  .trim();

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const LOCAL_IMAGE_PENDING_URI = 'operit-local://pending';

interface OperitMarkdownEditorLabels {
  toolbarBold: string;
  toolbarItalic: string;
  toolbarStrike: string;
  toolbarH1: string;
  toolbarH2: string;
  toolbarH3: string;
  toolbarQuote: string;
  toolbarCode: string;
  toolbarCodeBlock: string;
  toolbarList: string;
  toolbarOrdered: string;
  toolbarChecklist: string;
  toolbarLink: string;
  toolbarImage: string;
  previewEmpty: string;
}

export interface OperitMarkdownEditorHandle {
  insertText: (text: string) => void;
}

interface OperitMarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  mode: OperitEditorMode;
  view: OperitViewMode;
  fontSize: number;
  labels: OperitMarkdownEditorLabels;
  onInsertImage?: () => void | Promise<void>;
  resolveImageUrl?: (uri: string) => string;
}

const OperitMarkdownEditor = React.forwardRef<OperitMarkdownEditorHandle, OperitMarkdownEditorProps>(({
  value,
  onChange,
  placeholder,
  mode,
  view,
  fontSize,
  labels,
  onInsertImage,
  resolveImageUrl,
}, ref) => {
  const textAreaRef = useRef<TextAreaRef>(null);
  const visualEditorRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);
  const syncingVisualInputRef = useRef(false);

  const getTextArea = useCallback(
    () => textAreaRef.current?.resizableTextArea?.textArea,
    [],
  );
  const getEditorElement = useCallback(
    () => (mode === 'visual' ? visualEditorRef.current : getTextArea()),
    [mode, getTextArea],
  );

  const emitVisualChange = useCallback((sourceEditor?: HTMLDivElement | null) => {
    const editor = sourceEditor || visualEditorRef.current;
    if (!editor) return;
    const nextValue = htmlToVisualMarkdown(editor.innerHTML);
    if (!nextValue.trim() && value.trim() && !editor.isConnected) {
      return;
    }
    syncingVisualInputRef.current = true;
    onChange(nextValue);
    requestAnimationFrame(() => {
      syncingVisualInputRef.current = false;
    });
  }, [onChange, value]);

  const insertVisualHtmlAtCursor = useCallback((html: string) => {
    const editor = visualEditorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      editor.insertAdjacentHTML('beforeend', html);
      emitVisualChange();
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      editor.insertAdjacentHTML('beforeend', html);
      emitVisualChange();
      return;
    }

    range.deleteContents();
    const template = document.createElement('template');
    template.innerHTML = html;
    const fragment = template.content;
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);

    if (lastNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastNode);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    }

    emitVisualChange();
  }, [emitVisualChange]);

  const runVisualCommand = useCallback((command: string, commandValue?: string) => {
    const editor = visualEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, commandValue);
    emitVisualChange();
  }, [emitVisualChange]);

  const applyTextChange = useCallback(
    (
      replacement: string,
      rangeStart: number,
      rangeEnd: number,
      selectionStart: number,
      selectionEnd: number,
    ) => {
      const textarea = getTextArea();
      if (!textarea) {
        const nextValue = `${value.slice(0, rangeStart)}${replacement}${value.slice(rangeEnd)}`;
        onChange(nextValue);
        return;
      }
      textarea.focus();
      textarea.setRangeText(replacement, rangeStart, rangeEnd, 'end');
      textarea.setSelectionRange(selectionStart, selectionEnd);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },
    [value, onChange, getTextArea],
  );

  const wrapSelection = useCallback(
    (prefix: string, suffix: string, placeholderText: string) => {
      const textarea = getTextArea();
      const start = textarea?.selectionStart ?? value.length;
      const end = textarea?.selectionEnd ?? value.length;
      const before = value.slice(0, start);
      const selected = value.slice(start, end);
      const content = selected || placeholderText;
      const selectionStart = before.length + prefix.length;
      const selectionEnd = selectionStart + content.length;
      const replacement = `${prefix}${content}${suffix}`;
      applyTextChange(replacement, start, end, selectionStart, selectionEnd);
    },
    [value, applyTextChange, getTextArea],
  );

  const prefixLines = useCallback(
    (prefix: string, ordered?: boolean) => {
      const textarea = getTextArea();
      const start = textarea?.selectionStart ?? value.length;
      const end = textarea?.selectionEnd ?? value.length;
      const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const lineEnd = value.indexOf('\n', end);
      const blockEnd = lineEnd === -1 ? value.length : lineEnd;
      const block = value.slice(lineStart, blockEnd);
      const lines = block.split('\n');
      const updated = lines
        .map((line, index) => {
          if (ordered) {
            const cleaned = line.replace(/^\d+\.\s+/, '');
            return `${index + 1}. ${cleaned}`;
          }
          return `${prefix}${line}`;
        })
        .join('\n');
      const selectionStart = lineStart;
      const selectionEnd = lineStart + updated.length;
      applyTextChange(updated, lineStart, blockEnd, selectionStart, selectionEnd);
    },
    [value, applyTextChange, getTextArea],
  );

  const insertCodeBlock = useCallback(() => {
    wrapSelection('```\n', '\n```', 'code');
  }, [wrapSelection]);

  useEffect(() => {
    if (mode !== 'visual') return;
    const editor = visualEditorRef.current;
    if (!editor || syncingVisualInputRef.current) return;
    const currentMarkdown = normalizeMarkdownValue(htmlToVisualMarkdown(editor.innerHTML));
    const targetMarkdown = normalizeMarkdownValue(value);
    if (currentMarkdown === targetMarkdown) return;
    editor.innerHTML = markdownToVisualHtml(value, { resolveImageUrl });
  }, [mode, view, value, resolveImageUrl]);

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (mode === 'visual') {
        const html = markdownToVisualHtml(text, { resolveImageUrl }) || `<p>${escapeHtml(text).replace(/\n/g, '<br />')}</p>`;
        insertVisualHtmlAtCursor(html);
        return;
      }
      const textarea = getTextArea();
      const start = textarea?.selectionStart ?? value.length;
      const end = textarea?.selectionEnd ?? value.length;
      const selectionStart = start + text.length;
      applyTextChange(text, start, end, selectionStart, selectionStart);
    },
  }), [mode, value, applyTextChange, insertVisualHtmlAtCursor, getTextArea, resolveImageUrl]);

  const panelStyle = {
    height: '70vh',
    minHeight: 360,
    maxHeight: '70vh',
    overflowY: 'auto',
  } as const;

  const syncScroll = useCallback((source: 'editor' | 'preview') => {
    if (view !== 'split' || syncingRef.current) return;
    const editor = getEditorElement();
    const preview = previewRef.current;
    if (!editor || !preview) return;

    const sourceEl = source === 'editor' ? editor : preview;
    const targetEl = source === 'editor' ? preview : editor;

    const maxScroll = sourceEl.scrollHeight - sourceEl.clientHeight;
    const targetMaxScroll = targetEl.scrollHeight - targetEl.clientHeight;
    if (maxScroll <= 0 || targetMaxScroll <= 0) return;

    const ratio = sourceEl.scrollTop / maxScroll;
    syncingRef.current = true;
    targetEl.scrollTop = ratio * targetMaxScroll;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, [view, getEditorElement]);

  const insertChecklistVisual = useCallback(() => {
    insertVisualHtmlAtCursor('<ul><li><input type="checkbox" disabled /> item</li></ul>');
  }, [insertVisualHtmlAtCursor]);

  const insertLinkVisual = useCallback(() => {
    const selection = window.getSelection();
    const hasSelectedText = Boolean(selection?.toString().trim());
    if (hasSelectedText) {
      runVisualCommand('createLink', 'url');
      return;
    }
    insertVisualHtmlAtCursor('<a href="url">text</a>');
  }, [insertVisualHtmlAtCursor, runVisualCommand]);

  const insertImageVisual = useCallback(() => {
    insertVisualHtmlAtCursor(`<img src="${LOCAL_IMAGE_PENDING_URI}" data-operit-src="${LOCAL_IMAGE_PENDING_URI}" alt="image" />`);
  }, [insertVisualHtmlAtCursor]);

  const insertInlineCodeVisual = useCallback(() => {
    const selectedText = window.getSelection()?.toString() || 'code';
    runVisualCommand('insertHTML', `<code>${escapeHtml(selectedText)}</code>`);
  }, [runVisualCommand]);

  const insertCodeBlockVisual = useCallback(() => {
    runVisualCommand('insertHTML', '<pre><code>code</code></pre>');
  }, [runVisualCommand]);

  const renderMarkdownEditor = () => (
    <Input.TextArea
      ref={textAreaRef}
      value={value}
      onChange={event => onChange(event.target.value)}
      onScroll={() => syncScroll('editor')}
      placeholder={placeholder}
      style={{ fontSize, ...panelStyle }}
    />
  );

  const renderVisualEditor = () => (
    <div
      ref={visualEditorRef}
      className="operit-visual-editor markdown-body"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      data-placeholder={placeholder}
      onInput={event => emitVisualChange(event.currentTarget)}
      onScroll={() => syncScroll('editor')}
      style={{ fontSize, ...panelStyle }}
    />
  );

  const renderEditor = () => (mode === 'visual' ? renderVisualEditor() : renderMarkdownEditor());

  const renderPreview = () => (
    <div
      ref={previewRef}
      onScroll={() => syncScroll('preview')}
      style={{
        padding: 12,
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        background: 'var(--card-background)',
        ...panelStyle,
      }}
    >
      {value.trim() ? (
        <OperitMarkdownPreview content={value} resolveImageUrl={resolveImageUrl} />
      ) : (
        <Text type="secondary">{labels.previewEmpty}</Text>
      )}
    </div>
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {mode === 'visual' && (
        <Space wrap>
          <Tooltip title={labels.toolbarBold}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  runVisualCommand('bold');
                  return;
                }
                wrapSelection('**', '**', 'bold');
              }}
              icon={<BoldOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarItalic}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  runVisualCommand('italic');
                  return;
                }
                wrapSelection('*', '*', 'italic');
              }}
              icon={<ItalicOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarStrike}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  runVisualCommand('strikeThrough');
                  return;
                }
                wrapSelection('~~', '~~', 'strike');
              }}
              icon={<StrikethroughOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarH1}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  runVisualCommand('formatBlock', 'h1');
                  return;
                }
                prefixLines('# ');
              }}
              icon={<FontSizeOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarH2}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  runVisualCommand('formatBlock', 'h2');
                  return;
                }
                prefixLines('## ');
              }}
              icon={<FontSizeOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarH3}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  runVisualCommand('formatBlock', 'h3');
                  return;
                }
                prefixLines('### ');
              }}
              icon={<FontSizeOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarQuote}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  runVisualCommand('formatBlock', 'blockquote');
                  return;
                }
                prefixLines('> ');
              }}
              icon={<BlockOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarList}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  runVisualCommand('insertUnorderedList');
                  return;
                }
                prefixLines('- ');
              }}
              icon={<UnorderedListOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarOrdered}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  runVisualCommand('insertOrderedList');
                  return;
                }
                prefixLines('', true);
              }}
              icon={<OrderedListOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarChecklist}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  insertChecklistVisual();
                  return;
                }
                prefixLines('- [ ] ');
              }}
              icon={<CheckSquareOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarCode}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  insertInlineCodeVisual();
                  return;
                }
                wrapSelection('`', '`', 'code');
              }}
              icon={<CodeOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarCodeBlock}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  insertCodeBlockVisual();
                  return;
                }
                insertCodeBlock();
              }}
              icon={<FileTextOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarLink}>
            <Button
              onClick={() => {
                if (mode === 'visual') {
                  insertLinkVisual();
                  return;
                }
                wrapSelection('[', '](url)', 'text');
              }}
              icon={<LinkOutlined />}
            />
          </Tooltip>
          <Tooltip title={labels.toolbarImage}>
            <Button
              onClick={() => {
                if (onInsertImage) {
                  void onInsertImage();
                  return;
                }
                if (mode === 'visual') {
                  insertImageVisual();
                  return;
                }
                wrapSelection('![', `](${LOCAL_IMAGE_PENDING_URI})`, 'image');
              }}
              icon={<PictureOutlined />}
            />
          </Tooltip>
        </Space>
      )}

      {view === 'edit' && renderEditor()}
      {view === 'preview' && renderPreview()}
      {view === 'split' && (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            {renderEditor()}
          </Col>
          <Col xs={24} md={12}>
            {renderPreview()}
          </Col>
        </Row>
      )}
    </Space>
  );
});

export default OperitMarkdownEditor;
