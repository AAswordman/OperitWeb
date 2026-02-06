import React, { useCallback, useImperativeHandle, useRef } from 'react';
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

const { Text } = Typography;

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
}

const OperitMarkdownEditor = React.forwardRef<OperitMarkdownEditorHandle, OperitMarkdownEditorProps>(({
  value,
  onChange,
  placeholder,
  mode,
  view,
  fontSize,
  labels,
}, ref) => {
  const textAreaRef = useRef<TextAreaRef>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);

  const getTextArea = () => textAreaRef.current?.resizableTextArea?.textArea;

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
    [value, onChange],
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
    [value, applyTextChange],
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
    [value, applyTextChange],
  );

  const insertCodeBlock = useCallback(() => {
    wrapSelection('```\n', '\n```', 'code');
  }, [wrapSelection]);

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      const textarea = getTextArea();
      const start = textarea?.selectionStart ?? value.length;
      const end = textarea?.selectionEnd ?? value.length;
      const selectionStart = start + text.length;
      applyTextChange(text, start, end, selectionStart, selectionStart);
    },
  }), [value, applyTextChange]);

  const panelStyle = {
    height: '70vh',
    minHeight: 360,
    maxHeight: '70vh',
    overflowY: 'auto',
  } as const;

  const syncScroll = useCallback((source: 'editor' | 'preview') => {
    if (view !== 'split' || syncingRef.current) return;
    const editor = getTextArea();
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
  }, [view]);

  const renderEditor = () => (
    <Input.TextArea
      ref={textAreaRef}
      value={value}
      onChange={event => onChange(event.target.value)}
      onScroll={() => syncScroll('editor')}
      placeholder={placeholder}
      style={{ fontSize, ...panelStyle }}
    />
  );

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
        <OperitMarkdownPreview content={value} />
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
            <Button onClick={() => wrapSelection('**', '**', 'bold')} icon={<BoldOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarItalic}>
            <Button onClick={() => wrapSelection('*', '*', 'italic')} icon={<ItalicOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarStrike}>
            <Button onClick={() => wrapSelection('~~', '~~', 'strike')} icon={<StrikethroughOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarH1}>
            <Button onClick={() => prefixLines('# ')} icon={<FontSizeOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarH2}>
            <Button onClick={() => prefixLines('## ')} icon={<FontSizeOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarH3}>
            <Button onClick={() => prefixLines('### ')} icon={<FontSizeOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarQuote}>
            <Button onClick={() => prefixLines('> ')} icon={<BlockOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarList}>
            <Button onClick={() => prefixLines('- ')} icon={<UnorderedListOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarOrdered}>
            <Button onClick={() => prefixLines('', true)} icon={<OrderedListOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarChecklist}>
            <Button onClick={() => prefixLines('- [ ] ')} icon={<CheckSquareOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarCode}>
            <Button onClick={() => wrapSelection('`', '`', 'code')} icon={<CodeOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarCodeBlock}>
            <Button onClick={insertCodeBlock} icon={<FileTextOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarLink}>
            <Button onClick={() => wrapSelection('[', '](url)', 'text')} icon={<LinkOutlined />} />
          </Tooltip>
          <Tooltip title={labels.toolbarImage}>
            <Button onClick={() => wrapSelection('![', '](url)', 'alt')} icon={<PictureOutlined />} />
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
