const TOKEN_VERSION = 'v1';
export type SessionClaims = { sub: string; role: string; allowedUnits: string[]; access: string[]; assignedBuildings: string[]; admin: boolean; exp: number };

function toBase64Url(value: string) { const bytes = new TextEncoder().encode(value); let binary = ''; bytes.forEach((byte) => { binary += String.fromCharCode(byte); }); return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
function fromBase64Url(value: string) { const normalized = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '='); const binary = atob(normalized); return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))); }
async function signature(value: string, secret: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)); return toBase64Url(String.fromCharCode(...new Uint8Array(bytes))); }
export async function createSessionToken(claims: Omit<SessionClaims, 'exp'>, secret: string, maxAgeSeconds = 60 * 60 * 24 * 7) { const payload: SessionClaims = { ...claims, exp: Date.now() + maxAgeSeconds * 1000 }; const encoded = toBase64Url(JSON.stringify(payload)); return `${TOKEN_VERSION}.${encoded}.${await signature(`${TOKEN_VERSION}.${encoded}`, secret)}`; }
export async function createAdminToken(subject: string, secret: string, maxAgeSeconds = 60 * 60 * 24 * 7) { return createSessionToken({ sub: subject, role: 'Administratrice', allowedUnits: [], access: [], assignedBuildings: [], admin: true }, secret, maxAgeSeconds); }
export async function verifySessionToken(token: string | undefined, secret: string) {
  if (!token || !secret) return null;
  const [version, encoded, provided] = token.split('.');
  if (version !== TOKEN_VERSION || !encoded || !provided) return null;
  try { const expected = await signature(`${version}.${encoded}`, secret); if (expected !== provided) return null; const claims = JSON.parse(fromBase64Url(encoded)) as SessionClaims; return claims.exp >= Date.now() ? { ...claims, access: Array.isArray(claims.access) ? claims.access : [], assignedBuildings: Array.isArray(claims.assignedBuildings) ? claims.assignedBuildings : [] } : null; } catch { return null; }
}
export async function verifyAdminToken(token: string | undefined, secret: string, expectedSubject: string) { const claims = await verifySessionToken(token, secret); return Boolean(claims?.admin && claims.sub === expectedSubject); }
