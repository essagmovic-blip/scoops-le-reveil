import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

export type HRDocumentFile = { id: string; employeeId: string; employeeName: string; type: string; reference: string; note: string; fileName: string; mimeType: string; size: number; storedName: string; uploadedAt: string };
const root = path.join(process.cwd(), 'data', 'hr-documents');
const metadataPath = path.join(root, 'metadata.json');
async function readMetadata(): Promise<HRDocumentFile[]> { try { return JSON.parse(await fs.readFile(metadataPath, 'utf8')) as HRDocumentFile[]; } catch { return []; } }
async function writeMetadata(records: HRDocumentFile[]) { await fs.mkdir(root, { recursive: true }); await fs.writeFile(metadataPath, JSON.stringify(records, null, 2), 'utf8'); }
function safeName(value: string) { return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120); }
export async function listHRDocumentFiles() { return readMetadata(); }
export async function findHRDocumentFile(id: string) { return (await readMetadata()).find((record) => record.id === id); }
export async function saveHRDocumentFile(input: { employeeId: string; employeeName: string; type: string; reference: string; note: string; fileName: string; mimeType: string; bytes: Uint8Array }) { const id = `DOC-${Date.now()}-${randomBytes(3).toString('hex')}`; const storedName = `${id}-${safeName(input.fileName)}`; await fs.mkdir(root, { recursive: true }); await fs.writeFile(path.join(root, storedName), input.bytes); const record: HRDocumentFile = { id, employeeId: input.employeeId, employeeName: input.employeeName, type: input.type, reference: input.reference, note: input.note, fileName: input.fileName, mimeType: input.mimeType || 'application/octet-stream', size: input.bytes.byteLength, storedName, uploadedAt: new Date().toISOString() }; const records = await readMetadata(); await writeMetadata([record, ...records]); return record; }
export async function readHRDocumentBytes(record: HRDocumentFile) { return fs.readFile(path.join(root, record.storedName)); }
