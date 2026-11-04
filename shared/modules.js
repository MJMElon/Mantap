/* Mantap Worker Portal — module list.
   Each module is one card on the worker's home screen.
   To add a module later: add an entry here and put its pages in its own folder. */

// Stock module access items (same IDs and defaults the Stock app uses for estate workers).
window.STOCK_SECTIONS = [
  { id: 'estate_baja',      icon: '🌿', en: 'Baja (Fertilizer)',              ms: 'Baja' },
  { id: 'estate_racun',     icon: '⚗️', en: 'Racun (Chemical)',               ms: 'Racun' },
  { id: 'estate_anak',      icon: '🌱', en: 'Anak Sawit (Oil Palm Seedling)', ms: 'Anak Sawit' },
  { id: 'mobile_rainfall',  icon: '🌧️', en: 'Hujan (Rainfall)',               ms: 'Hujan' },
  { id: 'tools_mobile_cat', icon: '🔧', en: 'Peralatan (Tools)',              ms: 'Peralatan' },
];
window.STOCK_DEFAULTS = {
  estate_baja: 'edit', estate_racun: 'edit', estate_anak: 'edit',
  mobile_rainfall: 'edit', tools_mobile_cat: 'edit',
};

function stockAccess(perms, id) {
  perms = perms || {};
  return Object.prototype.hasOwnProperty.call(perms, id) ? perms[id] : (STOCK_DEFAULTS[id] || 'none');
}

window.MODULES = [
  {
    id: 'stock',
    icon: '📦',
    color: '#16a34a',
    name: { en: 'Stock', ms: 'Stok' },
    desc: { en: 'Fertilizer, chemical, seedling, rainfall and tools', ms: 'Baja, racun, anak sawit, hujan dan peralatan' },
    url: 'stock/',
    // Visible when the worker can use at least one Stock item.
    allowed: (user) => STOCK_SECTIONS.some(s => stockAccess(user.permissions, s.id) !== 'none'),
  },
];
