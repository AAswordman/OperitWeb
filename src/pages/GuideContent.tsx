import React from 'react';
import { useParams } from 'react-router-dom';
import MarkdownRenderer from '../components/MarkdownRenderer';

const GuideContent: React.FC<{ language: 'zh' | 'en' }> = ({ language }) => {
  const params = useParams();
  const slugPath = (params['*'] || '').replace(/^\//, '');
  const filePath = params.category ? `${params.category}/${slugPath}` : slugPath;
  return <MarkdownRenderer file={filePath || ''} language={language} />;
};

export default GuideContent; 