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
      const blockNodes = Array.from(node.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.offsetHeight > 0,
      );
      const preferredChunkHeight = 1250;
      const minChunkHeight = 900;
      const hardChunkHeight = 1600;
      const minimumTailHeight = 600;
      const isHeadingTag = (tagName: string) => /^H[1-6]$/i.test(tagName);
      const blockRanges = blockNodes.map((child) => {
        const style = window.getComputedStyle(child);
        const marginTop = Number.parseFloat(style.marginTop || '0') || 0;
        const marginBottom = Number.parseFloat(style.marginBottom || '0') || 0;
        const top = Math.max(0, child.offsetTop - marginTop);
        const bottom = child.offsetTop + child.offsetHeight + marginBottom;
        const tagName = child.tagName.toUpperCase();
        return {
          top,
          bottom,
          tagName,
          isHeading: isHeadingTag(tagName),
          containsImage: Boolean(child.querySelector('img')),
        };
      });
      const sectionRanges: Array<{
        startIndex: number;
        endIndex: number;
        top: number;
        bottom: number;
        containsImage: boolean;
      }> = [];

      if (blockRanges.length > 0) {
        let sectionStart = 0;
        for (let index = 1; index <= blockRanges.length; index += 1) {
          const reachedEnd = index >= blockRanges.length;
          const startsNewSection = !reachedEnd && blockRanges[index].isHeading;

          if (reachedEnd || startsNewSection) {
            const blocks = blockRanges.slice(sectionStart, index);
            sectionRanges.push({
              startIndex: sectionStart,
              endIndex: index - 1,
              top: blocks[0].top,
              bottom: blocks[blocks.length - 1].bottom,
              containsImage: blocks.some((block) => block.containsImage),
            });
            sectionStart = index;
          }
        }
      }

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

      const chunkRanges: Array<{ startIndex: number; endIndex: number }> = [];
      if (sectionRanges.length === 0) {
        chunkRanges.push({ startIndex: 0, endIndex: -1 });
      } else {
        let startSectionIndex = 0;

        while (startSectionIndex < sectionRanges.length) {
          const startTop = startSectionIndex === 0 ? 0 : sectionRanges[startSectionIndex].top;
          let endSectionIndex = startSectionIndex;
          let bestBreakSectionIndex = -1;

          for (let index = startSectionIndex; index < sectionRanges.length; index += 1) {
            const currentSection = sectionRanges[index];
            const nextSection = sectionRanges[index + 1];
            const currentHeight = currentSection.bottom - startTop;
            const nextProjectedHeight = nextSection ? nextSection.bottom - startTop : currentHeight;
            const isPreferredBreak = !nextSection || currentSection.containsImage;

            if (isPreferredBreak && currentHeight >= minChunkHeight) {
              bestBreakSectionIndex = index;
            }

            const shouldBreakAtPreferred = currentHeight >= preferredChunkHeight && bestBreakSectionIndex >= startSectionIndex;
            const shouldPreventOvershoot = Boolean(nextSection) && nextProjectedHeight > hardChunkHeight;

            if (shouldBreakAtPreferred || shouldPreventOvershoot) {
              endSectionIndex = bestBreakSectionIndex >= startSectionIndex ? bestBreakSectionIndex : index;
              break;
            }

            endSectionIndex = index;
          }

          chunkRanges.push({
            startIndex: sectionRanges[startSectionIndex].startIndex,
            endIndex: sectionRanges[endSectionIndex].endIndex,
          });
          startSectionIndex = endSectionIndex + 1;
        }

        if (chunkRanges.length > 1) {
          const lastChunk = chunkRanges[chunkRanges.length - 1];
          const lastChunkStart = blockRanges[lastChunk.startIndex]?.top ?? 0;
          const lastChunkEnd = blockRanges[lastChunk.endIndex]?.bottom ?? lastChunkStart;
          if (lastChunkEnd - lastChunkStart < minimumTailHeight) {
            chunkRanges[chunkRanges.length - 2].endIndex = lastChunk.endIndex;
            chunkRanges.pop();
          }
        }
      }

      const baseName = (resolvedPath?.split('/').pop() || 'guide-screenshot.md').replace(/\.md$/i, '');
      const exportRoot = document.createElement('div');
      exportRoot.className = 'markdown-export-stage';
      document.body.appendChild(exportRoot);
      const zip = new JSZip();

      try {
        for (let index = 0; index < chunkRanges.length; index += 1) {
          const chunkRange = chunkRanges[index];
          const exportNode = document.createElement('div');
          exportNode.className = 'markdown-body markdown-body-screenshot markdown-body-export';
          exportNode.style.width = `${node.clientWidth}px`;
          exportNode.style.maxWidth = 'none';
          exportNode.style.background = '#ffffff';

          if (chunkRange.endIndex >= 0) {
            for (let blockIndex = chunkRange.startIndex; blockIndex <= chunkRange.endIndex; blockIndex += 1) {
              exportNode.appendChild(blockNodes[blockIndex].cloneNode(true));
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
