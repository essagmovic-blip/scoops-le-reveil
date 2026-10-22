import { promises as fs } from 'fs';
import path from 'path';

const storePath = path.join(process.cwd(), 'data', 'admin-credentials.json');

type AdminCredentials = { passwordHash?: string; updatedAt?: string };

export async function readAdminPasswordHash() {
  try {
    const record = JSON.parse(await fs.readFile(storePath, 'utf8')) as AdminCredentials;
    return typeof record.passwordHash === 'string' ? record.passwordHash : '';
  } catch {
    return '';
  }
}

export async function writeAdminPasswordHash(passwordHash: string) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify({ passwordHash, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
}
