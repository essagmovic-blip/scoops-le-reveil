import { promises as fs } from 'fs';
import path from 'path';
import type { ServiceReport, ServiceReportStatus } from '@/lib/service-reports';

const storePath = path.join(process.cwd(), 'data', 'service-reports.json');

async function readReports() {
  try {
    const raw = JSON.parse(await fs.readFile(storePath, 'utf8')) as ServiceReport[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function writeReports(reports: ServiceReport[]) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(reports, null, 2), 'utf8');
}

export async function listServiceReports() {
  return (await readReports()).sort((first, second) => second.submittedAt.localeCompare(first.submittedAt));
}

export async function saveServiceReport(report: ServiceReport) {
  const reports = await readReports();
  const next = [report, ...reports.filter((item) => item.id !== report.id)];
  await writeReports(next);
  return report;
}

export async function updateServiceReport(id: string, patch: Pick<ServiceReport, 'status' | 'readAt' | 'readBy' | 'validationComment'>) {
  const reports = await readReports();
  const existing = reports.find((report) => report.id === id);
  if (!existing) return null;
  const updated: ServiceReport = { ...existing, ...patch };
  await writeReports(reports.map((report) => report.id === id ? updated : report));
  return updated;
}

export async function deleteServiceReportsByUnit(unitId: string) {
  const reports = await readReports();
  await writeReports(reports.filter((report) => report.unitId !== unitId));
}

export function isServiceReportStatus(value: unknown): value is ServiceReportStatus {
  return value === 'Non lu' || value === 'Lu' || value === 'Validé' || value === 'À corriger';
}
