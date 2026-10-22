import { supabaseAdmin } from './supabase-admin';
import { promises as fs } from 'fs';
import path from 'path';

export type ContactMessageStatus = 'Nouveau' | 'Lu' | 'Traité';
export type ContactMessage = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: ContactMessageStatus;
};

const storePath = path.join(process.cwd(), 'data', 'contact-messages.json');

async function readLocalFallback(): Promise<ContactMessage[]> {
  try { return JSON.parse(await fs.readFile(storePath, 'utf8')) as ContactMessage[]; } catch { return []; }
}
async function writeLocalFallback(messages: ContactMessage[]) {
  try {
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(messages, null, 2), 'utf8');
  } catch {}
}

export async function listContactMessages(): Promise<ContactMessage[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        name: row.full_name,
        email: row.email,
        phone: row.phone || '',
        subject: row.subject,
        message: row.message,
        status: (row.status as ContactMessageStatus) || 'Nouveau',
      }));
    }
  } catch (err) {
    console.error('Error fetching contact_messages from Supabase:', err);
  }
  return readLocalFallback();
}

export async function createContactMessage(input: Omit<ContactMessage, 'id' | 'createdAt' | 'status'>): Promise<ContactMessage> {
  const id = `CONTACT-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const message: ContactMessage = { ...input, id, createdAt, status: 'Nouveau' };

  try {
    const { error } = await supabaseAdmin.from('contact_messages').insert({
      id,
      full_name: input.name,
      email: input.email,
      phone: input.phone || null,
      subject: input.subject,
      message: input.message,
      status: 'Nouveau',
      created_at: createdAt,
    });
    if (error) console.error('Error inserting contact_message into Supabase:', error);
  } catch (err) {
    console.error('Exception inserting contact_message into Supabase:', err);
  }

  // Backup fallback local
  const local = await readLocalFallback();
  await writeLocalFallback([message, ...local]);

  return message;
}

export async function updateContactMessage(id: string, status: ContactMessageStatus): Promise<ContactMessage | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('contact_messages')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      return {
        id: data.id,
        createdAt: data.created_at,
        name: data.full_name,
        email: data.email,
        phone: data.phone || '',
        subject: data.subject,
        message: data.message,
        status: data.status as ContactMessageStatus,
      };
    }
  } catch (err) {
    console.error('Error updating contact_message in Supabase:', err);
  }

  const messages = await readLocalFallback();
  const existing = messages.find((m) => m.id === id);
  if (!existing) return null;
  const updated = { ...existing, status };
  await writeLocalFallback(messages.map((m) => m.id === id ? updated : m));
  return updated;
}
