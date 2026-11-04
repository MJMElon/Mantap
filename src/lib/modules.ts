import type { Access, WorkerSession } from './types';
import type { Lang } from './i18n';

/** Stock items a worker can be given access to (IDs used by the Stock app). */
export const STOCK_SECTIONS: { id: string; icon: string; label: Record<Lang, string> }[] = [
  { id: 'estate_baja', icon: '🌿', label: { en: 'Baja (Fertilizer)', ms: 'Baja' } },
  { id: 'estate_racun', icon: '⚗️', label: { en: 'Racun (Chemical)', ms: 'Racun' } },
  { id: 'estate_anak', icon: '🌱', label: { en: 'Anak Sawit (Oil Palm Seedling)', ms: 'Anak Sawit' } },
  { id: 'mobile_rainfall', icon: '🌧️', label: { en: 'Hujan (Rainfall)', ms: 'Hujan' } },
  { id: 'tools_mobile_cat', icon: '🔧', label: { en: 'Peralatan (Tools)', ms: 'Peralatan' } },
];

const STOCK_DEFAULTS: Record<string, Access> = {
  estate_baja: 'edit', estate_racun: 'edit', estate_anak: 'edit',
  mobile_rainfall: 'edit', tools_mobile_cat: 'edit',
};

export function stockAccess(perms: Record<string, unknown> | undefined, id: string): Access {
  const v = perms?.[id];
  if (v === 'none' || v === 'view' || v === 'edit') return v;
  return STOCK_DEFAULTS[id] ?? 'none';
}

export interface PortalModule {
  id: string;
  icon: string;
  color: string;
  name: Record<Lang, string>;
  desc: Record<Lang, string>;
  /** Where the module lives (relative to the site root). */
  href: string;
  allowed: (w: WorkerSession) => boolean;
}

/** Cards on the worker home. Add a module here to show it to workers. */
export const MODULES: PortalModule[] = [
  {
    id: 'stock',
    icon: '📦',
    color: '#16a34a',
    name: { en: 'Stock', ms: 'Stok' },
    desc: { en: 'Fertilizer, chemical, seedling, rainfall and tools', ms: 'Baja, racun, anak sawit, hujan dan peralatan' },
    href: `${import.meta.env.BASE_URL}stock/`,
    allowed: (w) => STOCK_SECTIONS.some((s) => stockAccess(w.permissions, s.id) !== 'none'),
  },
];
