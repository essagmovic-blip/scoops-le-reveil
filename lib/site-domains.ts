/**
 * Séparation des deux sites servis par le même projet :
 * - « public » : la vitrine SCOOPS LE REVEIL (scoopslereveil.com)
 * - « app »    : AgroFlux, l'espace de gestion interne (scoopslereveil.app)
 * - « any »    : domaine non reconnu (ex. aperçu Vercel) → aucune restriction.
 *
 * En local : http://localhost:3005 = vitrine, http://agroflux.localhost:3005 = AgroFlux.
 * Les listes sont surchargeables par variables d'environnement (séparées par des virgules).
 */
export type SiteKind = 'public' | 'app' | 'any';

function hostList(value: string | undefined, fallback: string[]) {
  const list = (value ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : fallback;
}

const PUBLIC_HOSTS = hostList(process.env.PUBLIC_SITE_HOSTS, [
  'scoopslereveil.com',
  'www.scoopslereveil.com',
  'scoops-le-reveil.vercel.app',
  'localhost',
  '127.0.0.1',
]);
const APP_HOSTS = hostList(process.env.APP_SITE_HOSTS, [
  'scoopslereveil.app',
  'www.scoopslereveil.app',
  'agroflux.localhost',
  'agroflux-reveil.vercel.app',
  'agroflux-scoops.vercel.app',
]);

export function resolveSiteKind(hostHeader: string | null): SiteKind {
  const host = (hostHeader ?? '').toLowerCase().split(':')[0];
  if (APP_HOSTS.includes(host) || host.startsWith('agroflux-') || host.startsWith('agroflux.')) return 'app';
  if (PUBLIC_HOSTS.includes(host)) return 'public';
  return 'any';
}

/** Pages et API accessibles depuis la vitrine. */
const PUBLIC_PAGE_PATHS = ['/', '/contact'];
const PUBLIC_PREFIXES = ['/commande', '/api/public', '/api/contact'];

export function isPublicSitePath(pathname: string) {
  if (PUBLIC_PAGE_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
