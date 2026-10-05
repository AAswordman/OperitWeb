import React from 'react';
import { useParams } from 'react-router-dom';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { PRODUCTS } from '../config/products';

const GuideNewContent: React.FC<{ language: 'zh' | 'en' }> = ({ language }) => {
  const { slug } = useParams();
  const category = 'beginner-tutorial';
  const file = category && slug ? `${PRODUCTS.v1.markdownRoot}/${category}/${slug}` : `${PRODUCTS.v1.markdownRoot}/index`;
  return <MarkdownRenderer file={file} language={language} />;
};

export default GuideNewContent;
