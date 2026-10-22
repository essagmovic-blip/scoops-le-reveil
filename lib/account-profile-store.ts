import { promises as fs } from 'fs';
import path from 'path';

const storePath = path.join(process.cwd(), 'data', 'account-profiles.json');

type StoredProfile = { phone: string; profilePhoto: string; updatedAt: string };

async function readProfiles() {
  try {
    return JSON.parse(await fs.readFile(storePath, 'utf8')) as Record<string, StoredProfile>;
  } catch {
    return {};
  }
}

export async function readAccountProfile(id: string): Promise<StoredProfile> {
  const profiles = await readProfiles();
  const profile = profiles[id];
  return profile ? { phone: profile.phone ?? '', profilePhoto: profile.profilePhoto ?? '', updatedAt: profile.updatedAt ?? '' } : { phone: '', profilePhoto: '', updatedAt: '' };
}

export async function writeAccountProfile(id: string, patch: Partial<Pick<StoredProfile, 'phone' | 'profilePhoto'>>) {
  const profiles = await readProfiles();
  profiles[id] = { ...profiles[id], phone: patch.phone ?? profiles[id]?.phone ?? '', profilePhoto: patch.profilePhoto ?? profiles[id]?.profilePhoto ?? '', updatedAt: new Date().toISOString() };
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(profiles, null, 2), 'utf8');
  return profiles[id];
}
