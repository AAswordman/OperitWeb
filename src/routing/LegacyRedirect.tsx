import { Navigate, useLocation } from 'react-router-dom';
import { resolveLegacyPath } from './paths';
import { SHARED_PATHS } from '../config/products';

export default function LegacyRedirect() {
  const location = useLocation();
  return <Navigate replace to={{
    pathname: resolveLegacyPath(location.pathname) ?? SHARED_PATHS.home,
    search: location.search,
    hash: location.hash,
  }} />;
}
