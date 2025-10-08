import React from 'react';
import { useParams } from 'react-router-dom';
import MarkdownRenderer from '../components/MarkdownRenderer';

const GuideContent: React.FC<{ language: 'zh' | 'en' }> = ({ language }) => {
  const params = useParams();
  const filePath = params.category ? `${params.category}/${params.slug}` : params.slug;
  return <MarkdownRenderer file={filePath || ''} language={language} />;
};

export default GuideContent; 