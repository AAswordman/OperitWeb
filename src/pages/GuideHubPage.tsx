import VersionHubPage from './VersionHubPage';
import type { Language } from '../config/products';

export default function GuideHubPage({ language }: { darkMode: boolean; language: Language }) {
  return <VersionHubPage language={language} section="guide" />;
}
