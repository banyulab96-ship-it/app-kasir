export interface ClosingRecord {
  date: string;
  kasirApproved: boolean;
  kasirApprovedBy?: string;
  kasirApprovedAt?: string;
  spvApproved: boolean;
  spvApprovedBy?: string;
  spvApprovedAt?: string;
  isClosed: boolean;
}

const STORAGE_KEY = 'dapurkasir_closings';
export const SPV_CLOSING_CODE = '123456789';

export function getClosingRecord(date: string): ClosingRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date, kasirApproved: false, spvApproved: false, isClosed: false };
    const all = JSON.parse(raw);
    return all[date] || { date, kasirApproved: false, spvApproved: false, isClosed: false };
  } catch {
    return { date, kasirApproved: false, spvApproved: false, isClosed: false };
  }
}

export function saveClosingRecord(record: ClosingRecord): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[record.date] = record;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save closing record:', e);
  }
}

export function isDateLockedForKasir(date: string): boolean {
  if (!date) return false;
  const rec = getClosingRecord(date);
  return rec.kasirApproved || rec.isClosed;
}
