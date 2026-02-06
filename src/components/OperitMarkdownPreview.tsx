import React, { type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Image } from 'antd';
import remarkImageGallery from '../remark/remarkImageGallery';
import remarkDetails from '../remark/remarkDetails';
import './MarkdownRenderer.css';

type CodeComponentProps = Omit<ComponentProps<'code'>, 'ref'>;

const urlTransform = (uri: string) => {
  if (uri.startsWith('/') && !uri.startsWith('//')) {
    const baseUrl = import.meta.env.BASE_URL;
    const cleanedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanedBaseUrl}${uri}`;
  }
  return uri;
};

interface OperitMarkdownPreviewProps {
  content: string;
}

const OperitMarkdownPreview: React.FC<OperitMarkdownPreviewProps> = ({ content }) => (
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
          img: ({ node: _node, onClick: _onClick, ...props }) => <Image {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </Image.PreviewGroup>
  </div>
);

export default OperitMarkdownPreview;
