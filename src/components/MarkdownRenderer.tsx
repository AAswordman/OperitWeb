import React, { useState, useEffect, useRef, type ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Spin, Alert, Image, Button, Space, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import './MarkdownRenderer.css';
import remarkImageGallery from '../remark/remarkImageGallery';
import remarkDetails from '../remark/remarkDetails';
import { translations } from '../translations';

// Omit 'ref' from the standard 'code' component props to avoid type conflicts with SyntaxHighlighter
type CodeComponentProps = Omit<ComponentProps<'code'>, 'ref'>;

// Lazy-loaded image component using Intersection Observer
const LazyImage: React.FC<React.ComponentProps<typeof Image>> = (props) => {
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, []);

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
  const t = translations[language].guide;
  const submissionT = translations[language].submission;
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMarkdown = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try to fetch language-specific file first (e.g., en/quick-start.md or zh/quick-start.md)
        const response = await fetch(`${import.meta.env.BASE_URL}content/${language}/${file}.md`);
        
        if (response.ok) {
          const text = await response.text();
          setMarkdown(text);
          setResolvedPath(`content/${language}/${file}.md`);
        } else if (language === 'en') {
          // If English file doesn't exist, fallback to Chinese version
          const fallbackResponse = await fetch(`${import.meta.env.BASE_URL}content/zh/${file}.md`);
          if (fallbackResponse.ok) {
            const text = await fallbackResponse.text();
            setMarkdown(text);
            setResolvedPath(`content/zh/${file}.md`);
          } else {
            throw new Error(`Failed to fetch markdown file: ${file}.md`);
          }
        } else {
          throw new Error(`Failed to fetch markdown file: ${file}.md`);
        }
      } catch (err) {
        console.error(`Failed to load markdown file: ${file}.md`, err);
        setError(t.loadError);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkdown();
  }, [file, language, t.loadError]);

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

  return (
    <div>
      <div className="markdown-edit-bar">
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
      </div>
      <div className="markdown-body">
      <Image.PreviewGroup>
        <ReactMarkdown
          remarkPlugins={[remarkDetails, remarkGfm, remarkImageGallery]}
          rehypePlugins={[rehypeRaw]}
          urlTransform={urlTransform}
          components={{
            code({ inline, className, children, ...props }: CodeComponentProps & { inline?: boolean }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  style={vscDarkPlus as any}
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
            img: ({ node: _node, onClick: _onClick, ...props }) => <LazyImage {...props} />,
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
