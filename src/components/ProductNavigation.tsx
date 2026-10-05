import { Link, NavLink } from 'react-router-dom';
import { AppstoreOutlined, SwapOutlined } from '@ant-design/icons';
import { PRODUCTS, SHARED_PATHS } from '../config/products';
import type { Language, ProductDefinition } from '../config/products';
import './ProductNavigation.css';

export default function ProductNavigation({ product, language }: { product: ProductDefinition; language: Language }) {
  const zh = language === 'zh';
  const other = PRODUCTS[product.id === 'v1' ? 'v2' : 'v1'];
  return <nav className="product-navigation" aria-label={zh ? `${product.name} 导航` : `${product.name} navigation`}>
    <div className="product-navigation-inner">
      <Link className="product-navigation-name" to={product.homePath}>{product.name}<span>{product.status[language]}</span></Link>
      <div className="product-navigation-links">
        <NavLink end to={product.homePath}>{zh ? '概览' : 'Overview'}</NavLink>
        <NavLink to={product.downloadPath}>{zh ? '下载' : 'Download'}</NavLink>
        <NavLink to={product.guidePath}>{zh ? '使用教程' : 'Guides'}</NavLink>
        <Link to={SHARED_PATHS.market}><AppstoreOutlined />{zh ? '共享插件市场' : 'Shared market'}</Link>
      </div>
      <Link className="product-navigation-switch" to={other.homePath}><SwapOutlined /><span>{other.name}</span></Link>
    </div>
  </nav>;
}
