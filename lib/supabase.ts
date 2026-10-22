import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ktlumornhwfuftoqrhxe.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'build-time-dummy-key';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
