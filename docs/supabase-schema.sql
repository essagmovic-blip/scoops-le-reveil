-- ========================================================
-- SCHEMA SUPABASE POUR SCOOPS LE REVEIL & AGROFLUX
-- Copiez et collez l'ensemble de ce script dans l'onglet SQL Editor de Supabase
-- ========================================================

-- 1. Contenu du site vitrine (scoopslereveil.com)
CREATE TABLE IF NOT EXISTS public.site_content (
  id TEXT PRIMARY KEY DEFAULT 'default',
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Annonces et événements publics
CREATE TABLE IF NOT EXISTS public.public_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  location TEXT,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  badge TEXT,
  featured BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Brouillon',
  images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Vidéos promotionnelles
CREATE TABLE IF NOT EXISTS public.promo_videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Commandes clients (créées depuis la vitrine, gérées dans AgroFlux)
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  unit_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  delivery_address TEXT NOT NULL,
  requested_date TEXT,
  note TEXT,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'À payer',
  status TEXT NOT NULL DEFAULT 'Reçue',
  qr_payload TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ,
  prepared_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  departed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_comment TEXT,
  delivered_by TEXT,
  stock_deducted_at TIMESTAMPTZ,
  invoice_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Messages de contact (reçus depuis scoopslereveil.com/contact)
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'Nouveau',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Rapports de service RH
CREATE TABLE IF NOT EXISTS public.service_reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  author_id TEXT,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Documents RH
CREATE TABLE IF NOT EXISTS public.hr_documents (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  type TEXT NOT NULL,
  reference TEXT,
  note TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INT NOT NULL,
  stored_name TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Courriers confidentiels
CREATE TABLE IF NOT EXISTS public.confidential_correspondence (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  recipient_unit TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  read_by JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- POLITIQUES DE SÉCURITÉ (RLS)
-- ========================================================

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confidential_correspondence ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour la vitrine
CREATE POLICY "Lecture publique site_content" ON public.site_content FOR SELECT USING (true);
CREATE POLICY "Lecture publique public_events" ON public.public_events FOR SELECT USING (status = 'Publié');
CREATE POLICY "Lecture publique promo_videos" ON public.promo_videos FOR SELECT USING (active = true);
CREATE POLICY "Suivi commande client par code" ON public.customer_orders FOR SELECT USING (true);

-- Création publique depuis la vitrine (commandes & messages contact)
CREATE POLICY "Passation commande publique" ON public.customer_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Envoi message contact public" ON public.contact_messages FOR INSERT WITH CHECK (true);

-- Les opérations d'administration internes passent par la clé secrète (service_role) qui outrepasse automatiquement le RLS en toute sécurité.
