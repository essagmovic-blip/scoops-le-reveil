import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { verifyAdminToken } from '@/lib/admin-session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = cookies();
  const expected = (process.env.ADMIN_USERNAME ?? 'MOVIC').trim().toUpperCase();
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  const token = store.get('agroflux_admin_token')?.value;
  const session = store.get('agroflux_session')?.value;
  if (session !== 'active' || !(await verifyAdminToken(token, secret, expected))) redirect('/connexion?next=/dashboard-admin');
  return <AdminShell>{children}</AdminShell>;
}
