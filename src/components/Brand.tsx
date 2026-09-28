import { Link } from 'react-router-dom';

export default function Brand({ onClick }: { onClick?: () => void }) {
  return <Link className="site-brand" to="/" aria-label="Operit" onClick={onClick}>
    <img src="/logo.svg" alt="" width={34} height={34} />
    <span>Operit<span className="site-brand-dot">.</span></span>
  </Link>;
}
