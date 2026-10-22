import { promises as fs } from 'fs';
import path from 'path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export type ConfidentialMessageStatus = 'Non lu' | 'Lu';
export type ConfidentialAttachment = { id: string; fileName: string; mimeType: string; size: number };
export type ConfidentialAttachmentInput = { fileName: string; mimeType: string; data: string };
export type ConfidentialMessage = { id: string; createdAt: string; senderId: string; senderName: string; recipientId: string; recipientName: string; subject: string; body: string; attachments: ConfidentialAttachment[]; status: ConfidentialMessageStatus; readAt: string };
type StoredAttachment = ConfidentialAttachment & { contentEncrypted: string };
type StoredMessage = Omit<ConfidentialMessage, 'subject' | 'body' | 'attachments'> & { subjectEncrypted: string; bodyEncrypted: string; attachments?: StoredAttachment[] };
const storePath = path.join(process.cwd(), 'data', 'confidential-correspondence.json');

function key() { return createHash('sha256').update(process.env.CONFIDENTIAL_MAIL_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? 'agroflux-confidential-mail').digest(); }
function encrypt(value: string) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv); const content = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${content.toString('base64')}`; }
function decrypt(value: string) { const [ivValue, tagValue, contentValue] = value.split('.'); const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivValue, 'base64')); decipher.setAuthTag(Buffer.from(tagValue, 'base64')); return Buffer.concat([decipher.update(Buffer.from(contentValue, 'base64')), decipher.final()]).toString('utf8'); }
async function writeMessages(messages: StoredMessage[]) { await fs.mkdir(path.dirname(storePath), { recursive: true }); await fs.writeFile(storePath, JSON.stringify(messages, null, 2), 'utf8'); }
async function readMessages(): Promise<StoredMessage[]> { try { return JSON.parse(await fs.readFile(storePath, 'utf8')) as StoredMessage[]; } catch { return []; } }
function safeFileName(value: string) { return value.replace(/[\\/\r\n"]/g, '_').trim().slice(0, 180) || 'piece-jointe'; }
function decodeDataUrl(data: string) { const match = data.match(/^data:([^;]+);base64,([a-z0-9+/=]+)$/i); if (!match) return null; const bytes = Buffer.from(match[2], 'base64'); return { mimeType: match[1], bytes }; }
function attachmentMetadata(attachment: StoredAttachment): ConfidentialAttachment { return { id: attachment.id, fileName: attachment.fileName, mimeType: attachment.mimeType, size: attachment.size }; }

function publicMessage(message: StoredMessage): ConfidentialMessage {
  return { id: message.id, createdAt: message.createdAt, senderId: message.senderId, senderName: message.senderName, recipientId: message.recipientId, recipientName: message.recipientName, subject: decrypt(message.subjectEncrypted), body: decrypt(message.bodyEncrypted), attachments: (message.attachments ?? []).map(attachmentMetadata), status: message.status, readAt: message.readAt };
}

export async function listConfidentialMessagesFor(userId: string) {
  const messages = await readMessages();
  return messages.filter((message) => message.senderId === userId || message.recipientId === userId).map(publicMessage);
}

export async function createConfidentialMessage(input: Omit<ConfidentialMessage, 'id' | 'createdAt' | 'status' | 'readAt' | 'attachments'> & { attachments?: ConfidentialAttachmentInput[] }) {
  const messages = await readMessages();
  const now = new Date().toISOString();
  const attachments = (input.attachments ?? []).map((attachment, index) => {
    const decoded = decodeDataUrl(attachment.data);
    if (!decoded) throw new Error('Format de pièce jointe invalide.');
    if (decoded.bytes.length > 5 * 1024 * 1024) throw new Error('Une pièce jointe dépasse 5 Mo.');
    return { id: `PJ-${Date.now()}-${index}-${randomBytes(2).toString('hex')}`, fileName: safeFileName(attachment.fileName), mimeType: decoded.mimeType || attachment.mimeType || 'application/octet-stream', size: decoded.bytes.length, contentEncrypted: encrypt(attachment.data) } satisfies StoredAttachment;
  });
  if (attachments.length > 5) throw new Error('Le courrier ne peut pas contenir plus de 5 pièces jointes.');
  if (attachments.reduce((sum, attachment) => sum + attachment.size, 0) > 10 * 1024 * 1024) throw new Error('La taille totale des pièces jointes dépasse 10 Mo.');
  const stored: StoredMessage = { id: `COURRIER-${Date.now()}-${randomBytes(3).toString('hex')}`, createdAt: now, senderId: input.senderId, senderName: input.senderName, recipientId: input.recipientId, recipientName: input.recipientName, subjectEncrypted: encrypt(input.subject), bodyEncrypted: encrypt(input.body), attachments, status: 'Non lu', readAt: '' };
  await writeMessages([stored, ...messages]);
  return publicMessage(stored);
}

export async function markConfidentialMessageRead(id: string, userId: string) {
  const messages = await readMessages();
  const existing = messages.find((message) => message.id === id);
  if (!existing || existing.recipientId !== userId) return null;
  const record = { ...existing, status: 'Lu' as const, readAt: new Date().toISOString() };
  await writeMessages(messages.map((message) => message.id === id ? record : message));
  return publicMessage(record);
}

export async function readConfidentialAttachment(messageId: string, attachmentId: string, userId: string) {
  const messages = await readMessages();
  const message = messages.find((item) => item.id === messageId && (item.senderId === userId || item.recipientId === userId));
  const attachment = message?.attachments?.find((item) => item.id === attachmentId);
  if (!attachment) return null;
  const decoded = decodeDataUrl(decrypt(attachment.contentEncrypted));
  if (!decoded) return null;
  return { ...attachmentMetadata(attachment), bytes: new Uint8Array(decoded.bytes) };
}
