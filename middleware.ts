import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, verifySessionToken } from '@/lib/admin-session';
import { type UnitId } from '@/lib/data';
import { accessRequirementsForPath, hasAccessToRequirements, unitFromPath } from '@/lib/route-access';
import { isPublicSitePath, resolveSiteKind } from '@/lib/site-domains';

const PROTECTED_PREFIXES = ['/selection-unite', '/mon-profil', '/commandes-clients', '/courriers-confidentiels', '/dashboard', '/dashboard-admin', '/poulets', '/chevrerie', '/rh', '/provenderie', '/produits-bio', '/pressoir', '/stocks', '/mouvements', '/factures', '/clients', '/fournisseurs', '/chat', '/achats', '/depenses', '/caisse', '/comptabilite', '/rapports', '/parametres'];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/connexion';
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function redirectToSelection(request: NextRequest, reason = 'denied', unit?: string) {
  const url = request.nextUrl.clone();
  url.pathname = '/selection-unite';
  url.searchParams.set('denied', '1');
  url.searchParams.set('reason', reason);
  if (unit) url.searchParams.set('unit', unit);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const site = resolveSiteKind(request.headers.get('host'));

  // Vitrine (scoopslereveil.com) : seules les pages publiques existent.
  if (site === 'public' && !isPublicSitePath(pathname)) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // AgroFlux (scoopslereveil.app) : on arrive directement sur la connexion.
  if (site === 'app') {
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/connexion';
      return NextResponse.redirect(url);
    }
    if (!pathname.startsWith('/api/') && isPublicSitePath(pathname)) {
      const target = new URL(`${pathname}${request.nextUrl.search}`, process.env.PUBLIC_SITE_URL ?? 'https://scoopslereveil.com');
      return NextResponse.redirect(target);
    }
  }

  if (!isProtectedPath(pathname)) return NextResponse.next();

  const session = request.cookies.get('agroflux_session')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  const expectedAdmin = (process.env.ADMIN_USERNAME ?? 'MOVIC').trim().toUpperCase();

  if (pathname.startsWith('/dashboard-admin')) {
    const adminToken = request.cookies.get('agroflux_admin_token')?.value;
    if (session !== 'active' || !(await verifyAdminToken(adminToken, secret, expectedAdmin))) return redirectToLogin(request);
    return NextResponse.next();
  }

  if (session !== 'active') return redirectToLogin(request);
  const claims = await verifySessionToken(request.cookies.get('agroflux_user_token')?.value, secret);
  if (!claims) return redirectToLogin(request);
  if (pathname === '/mouvements/commandes') {
    if (!claims.admin) return redirectToSelection(request, 'admin');
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard-admin/commandes';
    return NextResponse.redirect(url);
  }
  if (claims.admin) return NextResponse.next();

  if (pathname === '/dashboard/global') {
    return claims.role === 'PDG' || claims.role === 'DG' || claims.role === 'Administratrice'
      ? NextResponse.next()
      : redirectToSelection(request, 'role');
  }
  if (pathname === '/dashboard') {
    const activeUnit = request.cookies.get('agroflux_active_unit')?.value;
    if (activeUnit && activeUnit !== 'global' && claims.allowedUnits.includes(activeUnit)) {
      const dashboardRequirements = accessRequirementsForPath(`/dashboard/${activeUnit}`, activeUnit as UnitId);
      return hasAccessToRequirements(claims.access, dashboardRequirements)
        ? NextResponse.next()
        : redirectToSelection(request, 'access', activeUnit);
    }
    return claims.role === 'PDG' || claims.role === 'DG' || claims.role === 'Administratrice'
      ? NextResponse.next()
      : redirectToSelection(request, 'role');
  }
  if (pathname.startsWith('/parametres/communication')) return redirectToSelection(request, 'admin');
  if (pathname === '/courriers-confidentiels' || pathname.startsWith('/courriers-confidentiels/')) {
    if (!claims.allowedUnits.length) return redirectToSelection(request, 'unit');
    return hasAccessToRequirements(claims.access, ['Courriers confidentiels'], claims.role)
      ? NextResponse.next()
      : redirectToSelection(request, 'access');
  }

  const requestedUnit = unitFromPath(pathname);
  if (requestedUnit && !claims.allowedUnits.includes(requestedUnit)) return redirectToSelection(request, 'unit', requestedUnit);

  const requirements = accessRequirementsForPath(pathname, requestedUnit);
  if (!hasAccessToRequirements(claims.access, requirements, claims.role)) return redirectToSelection(request, 'access', requestedUnit);

  return NextResponse.next();
}

// Toutes les routes sauf les fichiers internes Next.js et les fichiers statiques (images, sons…).
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)'] };
