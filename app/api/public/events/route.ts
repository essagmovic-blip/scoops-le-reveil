import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { PublicEvent } from '@/lib/public-events';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === '1';

    let query = supabaseAdmin.from('public_events').select('*');
    if (!all) {
      query = query.eq('status', 'Publié');
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data) {
      const events: PublicEvent[] = data.map((row) => ({
        id: row.id,
        title: row.title,
        type: row.category || 'Actualité',
        status: row.status || 'Brouillon',
        date: row.date || '',
        location: row.location || '',
        excerpt: row.summary || '',
        body: row.content || '',
        images: row.images || [],
        ctaLabel: row.badge || '',
        ctaUrl: '',
        featured: !!row.featured,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      return NextResponse.json({ events });
    }
  } catch (err) {
    console.error('Error fetching public_events from Supabase:', err);
  }

  return NextResponse.json({ events: [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { event: PublicEvent };
    if (!body?.event) return NextResponse.json({ error: 'Événement manquant' }, { status: 400 });

    const item = body.event;
    const { error } = await supabaseAdmin.from('public_events').upsert({
      id: item.id,
      title: item.title,
      category: item.type,
      date: item.date,
      location: item.location || null,
      summary: item.excerpt,
      content: item.body,
      badge: item.ctaLabel || null,
      featured: item.featured,
      status: item.status,
      images: item.images,
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

    const { error } = await supabaseAdmin.from('public_events').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}
