import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_PUBLIC_SITE_CONTENT, type PublicSiteContent } from '@/lib/public-site';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_content')
      .select('content')
      .eq('id', 'default')
      .maybeSingle();

    if (!error && data?.content) {
      return NextResponse.json({ content: data.content });
    }
  } catch (err) {
    console.error('Error fetching site_content from Supabase:', err);
  }

  return NextResponse.json({ content: DEFAULT_PUBLIC_SITE_CONTENT });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { content: PublicSiteContent };
    if (!body?.content) {
      return NextResponse.json({ error: 'Contenu manquant' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('site_content').upsert({
      id: 'default',
      content: body.content,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error saving site_content in Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}
