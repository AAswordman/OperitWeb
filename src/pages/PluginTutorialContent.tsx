import React from 'react';
import { useParams } from 'react-router-dom';
import MarkdownRenderer from '../components/MarkdownRenderer';

const PluginTutorialContent: React.FC<{ language: 'zh' | 'en' }> = ({ language }) => {
  const { slug } = useParams();
  const file = slug ? `plugin-tutorial/${slug}` : 'plugin-tutorial/index';
  return <MarkdownRenderer file={file} language={language} />;
};

export default PluginTutorialContent;
