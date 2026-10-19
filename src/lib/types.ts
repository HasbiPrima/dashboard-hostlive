export type Role = "admin" | "manager" | "host";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  hostId?: string;
}

export interface Host {
  id: string;
  name: string;
  phone: string;
  studio: string;
  active: boolean;
}

export interface Brand {
  id: string;
  name: string;
  pic: string;
  /** Brand terdaftar per platform, mis. TikTok Shop: Bonju, Shopee: OT. */
  platformId: string;
  active: boolean;
}

export interface Platform {
  id: string;
  name: string;
  active: boolean;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  start: string; // "HH:MM" WIB
  end: string; // "HH:MM" WIB, maksimal "24:00"
  active: boolean;
}

/** Jam shift disalin dari template saat penugasan dibuat, supaya riwayat tidak berubah bila template diedit. */
export interface ShiftAssignment {
  id: string;
  date: string; // "YYYY-MM-DD"
  /** Terisi bila jam penugasan sama persis dengan template shift; jam bisa diisi bebas. */
  templateId?: string;
  hostId: string;
  start: string;
  end: string;
}

export interface Attendance {
  assignmentId: string;
  clockIn?: number; // menit sejak 00:00 WIB
  clockOut?: number;
  lateMinutes: number;
  corrected?: boolean;
  correctionReason?: string;
}

export interface LiveSession {
  id: string;
  date: string;
  start: string;
  end: string;
  hostId: string;
  brandId: string;
  platformId: string;
  assignmentId?: string;
  studio: string;
  cancelled?: boolean;
}

export interface ReportData {
  actualStart: string;
  actualEnd: string;
  gmv: number;
  ctr: number;
  ctor: number;
  views: number;
  avgWatchSec: number;
  checkout: number;
  notes: string;
}

/** Nilai mentah dari form, sebelum divalidasi. */
export type ReportForm = { [K in keyof ReportData]: string };

export interface ReportVersion {
  no: number;
  data: ReportData;
  by: string;
  at: string; // "YYYY-MM-DD HH:MM" WIB
  reason?: string;
}

export type ReviewStatus = "clear" | "flagged" | "correction" | "resolved";

export interface ReviewNote {
  by: string;
  at: string;
  text: string;
  action: "note" | "correction" | "resolve";
}

export interface LiveReport {
  id: string;
  sessionId: string;
  status: "draft" | "submitted";
  draft?: ReportForm;
  versions: ReportVersion[];
  review: ReviewStatus;
  flags: string[];
  notes: ReviewNote[];
  submittedAt?: string;
}

export interface AuditLog {
  id: string;
  at: string;
  actorId: string;
  action: string;
  object: string;
  objectId: string;
  summary: string;
  before?: string;
  after?: string;
  /** Host yang terdampak perubahan jadwal, untuk notifikasi di jadwal host. */
  hostIds?: string[];
}

export interface AppData {
  seedDate: string;
  users: User[];
  hosts: Host[];
  brands: Brand[];
  platforms: Platform[];
  templates: ShiftTemplate[];
  assignments: ShiftAssignment[];
  attendance: Record<string, Attendance>;
  sessions: LiveSession[];
  reports: LiveReport[];
  audit: AuditLog[];
  /** Opsional agar data demo lama tetap terbaca; default di rules.ts. */
  settings?: AnomalySettings;
}

/** Ambang flag anomali, bisa diubah Admin di halaman Pengaturan. */
export interface AnomalySettings {
  maxCtr: number;
  maxCtor: number;
  maxGmvPerCheckout: number;
  maxDurationDiff: number;
}

export interface Now {
  date: string;
  minutes: number;
}
