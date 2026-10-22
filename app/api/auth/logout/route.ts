import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  for (const name of ['agroflux_user_token', 'agroflux_user_id']) response.cookies.set(name, '', { httpOnly: name === 'agroflux_user_token', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: new Date(0), path: '/' });
  response.cookies.set('agroflux_admin_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(0),
    path: '/',
  });
  response.cookies.set('agroflux_user', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(0),
    path: '/',
  });
  for (const name of ['agroflux_user_name', 'agroflux_is_admin', 'agroflux_allowed_units', 'agroflux_access', 'agroflux_assigned_buildings', 'agroflux_role']) response.cookies.set(name, '', { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: new Date(0), path: '/' });
  response.cookies.set('agroflux_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(0),
    path: '/',
  });
  return response;
}
