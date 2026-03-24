import React from 'react';
import { useParams } from 'react-router-dom';
import MarkdownRenderer from '../components/MarkdownRenderer';

const GuideNewContent: React.FC<{ language: 'zh' | 'en' }> = ({ language }) => {
  const { category, slug } = useParams();
  const file = category && slug ? `newcontent/${category}/${slug}` : 'newcontent/index';
  return <MarkdownRenderer file={file} language={language} />;
};

export default GuideNewContent;
