import { Link } from 'react-router-dom';
import { useI18n, type TextKey } from '../../lib/i18n';

const TILES: { to: string; icon: string; color: string; title: TextKey; sub: TextKey }[] = [
  { to: '/portal/workers', icon: '👷', color: '#16a34a', title: 'tile_workers', sub: 'tile_workers_sub' },
  { to: '/portal/access', icon: '🔐', color: '#2563eb', title: 'tile_access', sub: 'tile_access_sub' },
  { to: '/portal/mobile', icon: '📱', color: '#f97316', title: 'tile_mobile', sub: 'tile_mobile_sub' },
];

/** Web portal home: the three tiles. */
export function PortalHomePage() {
  const { t } = useI18n();
  return (
    <div className="tiles">
      {TILES.map((x) => (
        <Link key={x.to} to={x.to} className="tile">
          <span className="tile-icon" style={{ background: `${x.color}1f` }}>{x.icon}</span>
          <span className="tile-title">{t(x.title)}</span>
          <span className="tile-sub">{t(x.sub)}</span>
        </Link>
      ))}
    </div>
  );
}
