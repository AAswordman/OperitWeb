import React, { useState, useEffect, useRef, type ComponentProps } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Spin, Alert, Image, Button, Space, Typography } from 'antd';
import { DownloadOutlined, EditOutlined } from '@ant-design/icons';
import './MarkdownRenderer.css';
import remarkImageGallery from '../remark/remarkImageGallery';
import remarkDetails from '../remark/remarkDetails';
import { translations } from '../translations';
import { buildMarkdownCandidates } from '../utils/markdownPaths';

// Omit 'ref' from the standard 'code' component props to avoid type conflicts with SyntaxHighlighter
type CodeComponentProps = Omit<ComponentProps<'code'>, 'ref'>;
type SyntaxTheme = NonNullable<SyntaxHighlighterProps['style']>;
const syntaxTheme = vscDarkPlus as unknown as SyntaxTheme;

// Lazy-loaded image component using Intersection Observer
const LazyImage: React.FC<React.ComponentProps<typeof Image> & { eager?: boolean }> = ({ eager = false, ...props }) => {
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eager) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before the image enters viewport
      }
    );

    const currentRef = imgRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [eager]);

  return (
    <div ref={imgRef} className="lazy-image-wrapper">
      {isInView ? (
        <Image {...props} />
      ) : (
        <div className="lazy-image-placeholder">
          <Spin size="small" />
        </div>
      )}
    </div>
  );
};

interface MarkdownRendererProps {
  file: string;
  language: 'zh' | 'en';
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ file, language }) => {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedPath, setResolvedPath] = useState<string | null>(null);
  const [imagesReady, setImagesReady] = useState(false);
  const [downloadingChunks, setDownloadingChunks] = useState(false);
  const t = translations[language].guide;
  const submissionT = translations[language].submission;
  const navigate = useNavigate();
  const location = useLocation();
  const screenshotMode = new URLSearchParams(location.search).get('mode') === 'screenshot';
  const markdownBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMarkdown = async () => {
      setLoading(true);
      setError(null);
      setResolvedPath(null);
      setImagesReady(false);
      try {
        const candidates = buildMarkdownCandidates(file, language);

        for (const candidate of candidates) {
          const response = await fetch(`${import.meta.env.BASE_URL}${candidate}`);
          if (response.ok) {
            const text = await response.text();
            setMarkdown(text);
            setResolvedPath(candidate);
            return;
          }
        }

        throw new Error(`Failed to fetch markdown file: ${file}.md`);
      } catch (err) {
        console.error(`Failed to load markdown file: ${file}.md`, err);
        setError(t.loadError);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkdown();
  }, [file, language, t.loadError]);

  useEffect(() => {
    if (!screenshotMode || loading || !markdown) {
      return;
    }

    const container = markdownBodyRef.current;
    if (!container) {
      return;
    }

    const images = Array.from(container.querySelectorAll('img'));
    if (images.length === 0) {
      setImagesReady(true);
      return;
    }

    setImagesReady(false);
    let cancelled = false;

    const waitForImage = (img: HTMLImageElement) => (
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          })
    );

    Promise.all(images.map(waitForImage)).then(() => {
      if (!cancelled) {
        setImagesReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loading, markdown, screenshotMode]);

  const urlTransform = (uri: string) => {
    // Prepend the base URL to absolute paths to fix image loading on GitHub Pages.
    if (uri.startsWith('/') && !uri.startsWith('//')) {
      const baseUrl = import.meta.env.BASE_URL;
      const cleanedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      return `${cleanedBaseUrl}${uri}`;
    }
    return uri;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert message={t.errorTitle} description={error} type="error" showIcon />;
  }

  const handleEdit = () => {
    if (!resolvedPath) return;
    navigate(`/operit-submission-edit?path=${encodeURIComponent(resolvedPath)}`);
  };

  const handleDownloadChunkedImages = async () => {
    if (!markdownBodyRef.current || downloadingChunks || !imagesReady) {
      return;
    }

    setDownloadingChunks(true);
    try {
      if ('fonts' in document) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

      const node = markdownBodyRef.current;
      const { default: html2canvas } = await import('html2canvas');
      const { default: JSZip } = await import('jszip');
      const preferredChunkHeight = 1250;
      const minChunkHeight = 900;
      const hardChunkHeight = 1600;
      const minimumTailHeight = 600;
      const tableSplitTargetHeight = 900;
      const isHeadingTag = (tagName: string) => /^H[1-6]$/i.test(tagName);
      const blockNodes = Array.from(node.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.offsetHeight > 0,
      );
      const exportRoot = document.createElement('div');
      exportRoot.className = 'markdown-export-stage';
      document.body.appendChild(exportRoot);

      const createExportContainer = () => {
        const container = document.createElement('div');
        container.className = 'markdown-body markdown-body-screenshot markdown-body-export';
        container.style.width = `${node.clientWidth}px`;
        container.style.maxWidth = 'none';
        container.style.background = '#ffffff';
        return container;
      };

      const getOuterHeight = (child: HTMLElement) => {
        const style = window.getComputedStyle(child);
        const marginTop = Number.parseFloat(style.marginTop || '0') || 0;
        const marginBottom = Number.parseFloat(style.marginBottom || '0') || 0;
        return Math.ceil(marginTop + child.offsetHeight + marginBottom);
      };

      const measureExportBlockHeight = (createNode: () => HTMLElement) => {
        const container = createExportContainer();
        container.appendChild(createNode());
        exportRoot.appendChild(container);
        const measuredHeight = Math.ceil(Math.max(
          container.scrollHeight,
          container.getBoundingClientRect().height,
        ));
        container.remove();
        return measuredHeight;
      };

      type ExportBlock = {
        createNode: () => HTMLElement;
        estimatedHeight: number;
        containsImage: boolean;
        isHeading: boolean;
        tagName: string;
      };

      const createRegularExportBlock = (child: HTMLElement): ExportBlock => {
        const tagName = child.tagName.toUpperCase();
        return {
          createNode: () => child.cloneNode(true) as HTMLElement,
          estimatedHeight: getOuterHeight(child),
          containsImage: Boolean(child.querySelector('img')),
          isHeading: isHeadingTag(tagName),
          tagName,
        };
      };

      const waitForImages = async (container: HTMLElement) => {
        const images = Array.from(container.querySelectorAll('img'));
        await Promise.all(images.map((img) => (
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                const done = () => resolve();
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
              })
        )));
      };

      const buildSplitTableBlocks = (table: HTMLTableElement): ExportBlock[] => {
        const headerRows = table.tHead
          ? Array.from(table.tHead.rows)
          : (table.rows.length > 0 ? [table.rows[0]] : []);
        const bodyRows = table.tHead
          ? Array.from(table.tBodies).flatMap((tbody) => Array.from(tbody.rows))
          : Array.from(table.rows).slice(headerRows.length);

        if (bodyRows.length < 2) {
          return [createRegularExportBlock(table)];
        }

        const buildTableSegment = (startRowIndex: number, endRowIndex: number, includeFooter: boolean) => () => {
          const tableClone = table.cloneNode(false) as HTMLTableElement;

          if (table.caption) {
            tableClone.appendChild(table.caption.cloneNode(true));
          }

          Array.from(table.children).forEach((child) => {
            if (child.tagName.toUpperCase() === 'COLGROUP') {
              tableClone.appendChild(child.cloneNode(true));
            }
          });

          if (table.tHead) {
            tableClone.appendChild(table.tHead.cloneNode(true));
          } else if (headerRows.length > 0) {
            const thead = document.createElement('thead');
            headerRows.forEach((row) => {
              thead.appendChild(row.cloneNode(true));
            });
            tableClone.appendChild(thead);
          }

          const tbody = document.createElement('tbody');
          bodyRows.slice(startRowIndex, endRowIndex).forEach((row) => {
            tbody.appendChild(row.cloneNode(true));
          });
          tableClone.appendChild(tbody);

          if (includeFooter && table.tFoot) {
            tableClone.appendChild(table.tFoot.cloneNode(true));
          }

          return tableClone;
        };

        const rowHeights = bodyRows.map((row) => Math.ceil(
          row.getBoundingClientRect().height || row.offsetHeight || 0,
        ));
        const segmentBlocks: ExportBlock[] = [];
        let startRowIndex = 0;

        while (startRowIndex < bodyRows.length) {
          let endRowIndex = startRowIndex;
          let currentHeight = 0;

          while (endRowIndex < bodyRows.length) {
            const nextRowHeight = rowHeights[endRowIndex] || 0;
            if (currentHeight > 0 && currentHeight + nextRowHeight > tableSplitTargetHeight) {
              break;
            }
            currentHeight += nextRowHeight;
            endRowIndex += 1;
          }

          if (endRowIndex === startRowIndex) {
            endRowIndex += 1;
          }

          const includeFooter = Boolean(table.tFoot) && endRowIndex >= bodyRows.length;
          const createNode = buildTableSegment(startRowIndex, endRowIndex, includeFooter);

          segmentBlocks.push({
            createNode,
            estimatedHeight: measureExportBlockHeight(createNode),
            containsImage: bodyRows
              .slice(startRowIndex, endRowIndex)
              .some((row) => Boolean(row.querySelector('img'))),
            isHeading: false,
            tagName: 'TABLE',
          });

          startRowIndex = endRowIndex;
        }

        return segmentBlocks.length > 1 ? segmentBlocks : [createRegularExportBlock(table)];
      };

      const exportBlocks = blockNodes.flatMap((child) => {
        if (child instanceof HTMLTableElement && getOuterHeight(child) > tableSplitTargetHeight) {
          return buildSplitTableBlocks(child);
        }
        return [createRegularExportBlock(child)];
      });

      const chunkRanges: Array<{ startIndex: number; endIndex: number }> = [];
      const getChunkHeight = (startIndex: number, endIndex: number) => exportBlocks
        .slice(startIndex, endIndex + 1)
        .reduce((sum, block) => sum + block.estimatedHeight, 0);

      if (exportBlocks.length === 0) {
        chunkRanges.push({ startIndex: 0, endIndex: -1 });
      } else {
        let chunkStart = 0;
        let chunkHeight = 0;

        for (let index = 0; index < exportBlocks.length; index += 1) {
          const block = exportBlocks[index];

          if (index > chunkStart && block.isHeading && chunkHeight >= minChunkHeight) {
            chunkRanges.push({ startIndex: chunkStart, endIndex: index - 1 });
            chunkStart = index;
            chunkHeight = 0;
          }

          if (index > chunkStart && chunkHeight + block.estimatedHeight > hardChunkHeight) {
            chunkRanges.push({ startIndex: chunkStart, endIndex: index - 1 });
            chunkStart = index;
            chunkHeight = 0;
          }

          chunkHeight += block.estimatedHeight;

          const nextBlock = exportBlocks[index + 1];
          const nextStartsSection = Boolean(nextBlock?.isHeading);
          const shouldBreakAfterBlock = !block.isHeading && chunkHeight >= preferredChunkHeight && (
            nextStartsSection
            || block.tagName === 'TABLE'
            || block.containsImage
            || chunkHeight >= hardChunkHeight * 0.85
          );

          if (shouldBreakAfterBlock) {
            chunkRanges.push({ startIndex: chunkStart, endIndex: index });
            chunkStart = index + 1;
            chunkHeight = 0;
          }
        }

        if (chunkStart < exportBlocks.length) {
          chunkRanges.push({ startIndex: chunkStart, endIndex: exportBlocks.length - 1 });
        }

        if (chunkRanges.length > 1 && chunkRanges[chunkRanges.length - 1].endIndex >= 0) {
          const lastChunk = chunkRanges[chunkRanges.length - 1];
          const lastChunkHeight = getChunkHeight(lastChunk.startIndex, lastChunk.endIndex);
          if (lastChunkHeight < minimumTailHeight) {
            chunkRanges[chunkRanges.length - 2].endIndex = lastChunk.endIndex;
            chunkRanges.pop();
          }
        }
      }

      const baseName = (resolvedPath?.split('/').pop() || 'guide-screenshot.md').replace(/\.md$/i, '');
      const zip = new JSZip();

      try {
        for (let index = 0; index < chunkRanges.length; index += 1) {
          const chunkRange = chunkRanges[index];
          const exportNode = createExportContainer();

          if (chunkRange.endIndex >= 0) {
            for (let blockIndex = chunkRange.startIndex; blockIndex <= chunkRange.endIndex; blockIndex += 1) {
              exportNode.appendChild(exportBlocks[blockIndex].createNode());
            }
          } else {
            exportNode.appendChild(node.cloneNode(true));
          }

          exportRoot.appendChild(exportNode);
          await waitForImages(exportNode);
          await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

          const exportHeight = Math.ceil(Math.max(
            exportNode.scrollHeight,
            exportNode.getBoundingClientRect().height,
          ));
          const exportWidth = Math.ceil(Math.max(exportNode.scrollWidth, exportNode.clientWidth));
          const canvas = await html2canvas(exportNode, {
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            scale: 1,
            width: exportWidth,
            height: exportHeight,
            windowWidth: Math.max(window.innerWidth, exportWidth),
            windowHeight: Math.max(window.innerHeight, exportHeight),
            scrollX: 0,
            scrollY: 0,
            onclone: (_document, clonedNode) => {
              const element = clonedNode as HTMLElement;
              element.style.overflow = 'visible';
              element.style.maxWidth = 'none';
              element.style.height = 'auto';
              element.style.background = '#ffffff';
            },
          });

          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/png');
          });
          if (!blob) {
            throw new Error('Failed to create image blob');
          }

          zip.file(`${baseName}-${String(index + 1).padStart(2, '0')}.png`, blob);
          exportNode.remove();
          await new Promise((resolve) => window.setTimeout(resolve, 150));
        }
      } finally {
        exportRoot.remove();
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      const objectUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${baseName}-chunks.zip`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      console.error('Failed to download chunked guide images', downloadError);
    } finally {
      setDownloadingChunks(false);
    }
  };

  return (
    <div className={screenshotMode ? 'markdown-renderer-root screenshot-mode' : 'markdown-renderer-root'}>
      {screenshotMode && (
        <div className="markdown-screenshot-toolbar">
          <Space wrap align="center">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadChunkedImages}
              loading={downloadingChunks}
              disabled={!imagesReady}
            >
              下载分块图片
            </Button>
            <Typography.Text type="secondary" className="markdown-screenshot-status">
              {imagesReady ? '图片已全部加载，将按块自动分片并打包为 zip。' : '正在加载整页图片资源...'}
            </Typography.Text>
          </Space>
        </div>
      )}
      {!screenshotMode && <div className="markdown-edit-bar">
        <Space wrap>
          <Button type="primary" icon={<EditOutlined />} onClick={handleEdit} disabled={!resolvedPath}>
            {submissionT.editButton}
          </Button>
          <Typography.Text type="secondary">{submissionT.editHint}</Typography.Text>
        </Space>
        {resolvedPath && (
          <Typography.Text type="secondary" className="markdown-edit-path">
            {resolvedPath}
          </Typography.Text>
        )}
      </div>}
      <div
        ref={markdownBodyRef}
        className={screenshotMode ? 'markdown-body markdown-body-screenshot' : 'markdown-body'}
      >
      <Image.PreviewGroup>
        <ReactMarkdown
          remarkPlugins={[remarkDetails, remarkGfm, remarkImageGallery]}
          rehypePlugins={[rehypeRaw]}
          urlTransform={urlTransform}
          components={{
            code({ inline, className, children, style, ...props }: CodeComponentProps & { inline?: boolean }) {
              void style;
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  style={syntaxTheme}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            img: ({ node, onClick, ...props }) => {
              void node;
              void onClick;
              return <LazyImage {...props} eager={screenshotMode} preview={!screenshotMode} />;
            },
            p: ({ node, children, ...props }) => {
              const hasImage = node?.children.some(
                (child) => (child as { type?: string; tagName?: string }).type === 'element' && (child as { tagName?: string }).tagName === 'img'
              );

              if (hasImage) {
                return (
                  <div className="paragraph-with-image" {...props}>
                    {children}
                  </div>
                );
              }
              return <p {...props}>{children}</p>;
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </Image.PreviewGroup>
      </div>
    </div>
  );
};

export default MarkdownRenderer; 
