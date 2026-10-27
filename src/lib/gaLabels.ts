/** Traduce los valores más comunes que GA4 devuelve en inglés. */
const MAP: Record<string, string> = {
  'Organic Search': 'Búsqueda orgánica',
  Direct: 'Directo',
  Referral: 'Referencias',
  'Organic Social': 'Redes sociales',
  'Paid Search': 'Búsqueda pagada',
  'Paid Social': 'Redes pagadas',
  Email: 'Correo',
  Display: 'Display',
  'Organic Video': 'Video orgánico',
  'Paid Video': 'Video pagado',
  Affiliates: 'Afiliados',
  'Cross-network': 'Varias redes',
  Unassigned: 'Sin asignar',
  desktop: 'Escritorio',
  mobile: 'Móvil',
  tablet: 'Tablet',
  smart_tv: 'Smart TV',
  '(not set)': '(sin dato)',
};
export const gaLabel = (v: string) => MAP[v] ?? v;
