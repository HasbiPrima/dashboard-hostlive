import type { AnomalySettings, Attendance, LiveReport, LiveSession, Now, ReportData, ReportForm, ShiftAssignment } from "./types";
import { moment, nowKey, toHHMM, toMin } from "./time";
import { rupiah } from "./format";

// Keputusan produk (PRD v1.1 + jawaban user)
export const OPS_START = 8 * 60; // 08:00 WIB
export const OPS_END = 24 * 60; // 24:00 WIB, sesi tidak boleh lewat tengah malam
export const CLOCK_IN_OPENS_BEFORE = 30; // menit sebelum shift
export const REPORT_DEADLINE = 60; // menit setelah sesi selesai

// Ambang flag anomali bawaan; Admin bisa mengubahnya di halaman Pengaturan.
export const DEFAULT_ANOMALY: AnomalySettings = {
  maxCtr: 30,
  maxCtor: 50,
  maxGmvPerCheckout: 5_000_000,
  maxDurationDiff: 30,
};

/* ---------- Absensi ---------- */

export type AttendanceState =
  | { kind: "upcoming"; opensAt: string }
  | { kind: "open"; lateBy: number }
  | { kind: "closed" }
  | { kind: "in"; att: Attendance }
  | { kind: "out"; att: Attendance };

export function attendanceState(a: ShiftAssignment, att: Attendance | undefined, now: Now): AttendanceState {
  if (att?.clockOut != null) return { kind: "out", att };
  if (att?.clockIn != null) return { kind: "in", att };
  const start = toMin(a.start);
  const opens = start - CLOCK_IN_OPENS_BEFORE;
  const k = nowKey(now);
  if (k < moment(a.date, opens)) return { kind: "upcoming", opensAt: toHHMM(opens) };
  if (k < moment(a.date, toMin(a.end))) return { kind: "open", lateBy: Math.max(0, now.minutes - start) };
  return { kind: "closed" };
}

export const lateMinutesAt = (a: ShiftAssignment, minutes: number) => Math.max(0, minutes - toMin(a.start));

export type Tone = "green" | "yellow" | "red" | "blue" | "gray" | "indigo";

export function attendanceBadge(a: ShiftAssignment, att: Attendance | undefined, now: Now): { label: string; tone: Tone } {
  const st = attendanceState(a, att, now);
  const late = (n: number) => `Terlambat ${n} menit`;
  if (att?.corrected) return { label: "Dikoreksi", tone: "blue" };
  switch (st.kind) {
    case "out":
    case "in":
      return st.att.lateMinutes > 0 ? { label: late(st.att.lateMinutes), tone: "yellow" } : { label: "Tepat waktu", tone: "green" };
    case "open":
      return st.lateBy > 0 ? { label: `Belum absen (telat ${st.lateBy} mnt)`, tone: "red" } : { label: "Belum absen", tone: "gray" };
    case "closed":
      return { label: "Tidak hadir", tone: "red" };
    default:
      return { label: "Terjadwal", tone: "gray" };
  }
}

export const workMinutes = (att?: Attendance) =>
  att?.clockIn != null && att.clockOut != null ? Math.max(0, att.clockOut - att.clockIn) : undefined;

/* ---------- Sesi live ---------- */

export type SessionStatus = "scheduled" | "live" | "waiting" | "done" | "missing" | "cancelled";

export const SESSION_LABEL: Record<SessionStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Terjadwal", tone: "gray" },
  live: { label: "Berlangsung", tone: "indigo" },
  waiting: { label: "Menunggu laporan", tone: "yellow" },
  done: { label: "Selesai", tone: "green" },
  missing: { label: "Belum lapor", tone: "red" },
  cancelled: { label: "Dibatalkan", tone: "gray" },
};

export const sessionEnded = (s: LiveSession, now: Now) => nowKey(now) >= moment(s.date, toMin(s.end));
export const deadlineOf = (s: LiveSession) => toMin(s.end) + REPORT_DEADLINE;
export const pastDeadline = (s: LiveSession, now: Now) => nowKey(now) > moment(s.date, deadlineOf(s));

export function sessionStatus(s: LiveSession, report: LiveReport | undefined, now: Now): SessionStatus {
  if (s.cancelled) return "cancelled";
  const k = nowKey(now);
  if (k < moment(s.date, toMin(s.start))) return "scheduled";
  if (!sessionEnded(s, now)) return "live";
  if (report?.status === "submitted") return "done";
  return pastDeadline(s, now) ? "missing" : "waiting";
}

/* ---------- Laporan ---------- */

export const REVIEW_LABEL: Record<LiveReport["review"], { label: string; tone: Tone }> = {
  clear: { label: "Aman", tone: "green" },
  flagged: { label: "Ditandai", tone: "red" },
  correction: { label: "Perlu koreksi", tone: "yellow" },
  resolved: { label: "Selesai ditinjau", tone: "blue" },
};

export const emptyForm = (s?: LiveSession): ReportForm => ({
  actualStart: s?.start ?? "",
  actualEnd: s?.end ?? "",
  gmv: "",
  ctr: "",
  ctor: "",
  views: "",
  avgWatchSec: "",
  checkout: "",
  notes: "",
});

export const toForm = (d: ReportData): ReportForm => ({
  actualStart: d.actualStart,
  actualEnd: d.actualEnd,
  gmv: String(d.gmv),
  ctr: String(d.ctr).replace(".", ","),
  ctor: String(d.ctor).replace(".", ","),
  views: String(d.views),
  avgWatchSec: String(d.avgWatchSec),
  checkout: String(d.checkout),
  notes: d.notes,
});

const TIME_RE = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

export type FormErrors = Partial<Record<keyof ReportForm, string>>;

export function validateReport(f: ReportForm): { data?: ReportData; errors: FormErrors } {
  const errors: FormErrors = {};

  const time = (k: "actualStart" | "actualEnd") => {
    const v = f[k].trim();
    if (!v) errors[k] = "Wajib diisi";
    else if (!TIME_RE.test(v)) errors[k] = "Format jam HH:MM, contoh 16:05";
    return v;
  };
  const start = time("actualStart");
  const end = time("actualEnd");
  if (!errors.actualStart && toMin(start) < OPS_START) errors.actualStart = "Di luar jam operasional (mulai 08:00)";
  if (!errors.actualEnd && toMin(end) > OPS_END) errors.actualEnd = "Sesi tidak boleh lewat 24:00";
  if (!errors.actualStart && !errors.actualEnd && toMin(end) <= toMin(start))
    errors.actualEnd = "Harus setelah waktu mulai";

  const int = (k: "gmv" | "views" | "avgWatchSec" | "checkout") => {
    const raw = f[k].trim();
    if (!raw) return (errors[k] = "Wajib diisi"), 0;
    if (raw.includes("-")) return (errors[k] = "Tidak boleh negatif"), 0;
    const clean = raw.replace(/\./g, "");
    if (!/^\d+$/.test(clean)) return (errors[k] = "Harus berupa bilangan bulat"), 0;
    return Number(clean);
  };
  const pct = (k: "ctr" | "ctor") => {
    const raw = f[k].trim().replace(",", ".");
    if (!raw) return (errors[k] = "Wajib diisi"), 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return (errors[k] = "Harus berupa angka"), 0;
    if (n < 0 || n > 100) return (errors[k] = "Rentang 0–100%"), 0;
    return Math.round(n * 100) / 100;
  };

  const data: ReportData = {
    actualStart: start,
    actualEnd: end,
    gmv: int("gmv"),
    ctr: pct("ctr"),
    ctor: pct("ctor"),
    views: int("views"),
    avgWatchSec: int("avgWatchSec"),
    checkout: int("checkout"),
    notes: f.notes.trim(),
  };
  return Object.keys(errors).length ? { errors } : { data, errors };
}

/** Laporan tetap diterima & masuk rekap; alasan-alasan ini hanya menandainya untuk ditinjau manager. */
export function detectAnomalies(d: ReportData, s: LiveSession, late: boolean, prev?: ReportData, t: AnomalySettings = DEFAULT_ANOMALY): string[] {
  const flags: string[] = [];
  if (prev && (d.gmv < prev.gmv || d.checkout < prev.checkout || d.views < prev.views))
    flags.push("Angka kumulatif lebih kecil dari laporan shift sebelumnya");
  if (d.checkout > 0 && d.gmv === 0) flags.push("Ada checkout tetapi GMV Rp 0");
  if (d.gmv > 0 && d.checkout === 0) flags.push("GMV tercatat tetapi checkout 0");
  if (d.checkout > 0 && d.gmv / d.checkout > t.maxGmvPerCheckout) flags.push(`Nilai per checkout di atas ${rupiah(t.maxGmvPerCheckout)}`);
  if (d.views > 0 && d.checkout > d.views) flags.push("Checkout melebihi jumlah views");
  if (d.ctr > t.maxCtr) flags.push(`CTR di atas ${t.maxCtr}%`);
  if (d.ctor > t.maxCtor) flags.push(`CTOR di atas ${t.maxCtor}%`);
  const planned = toMin(s.end) - toMin(s.start);
  const actual = toMin(d.actualEnd) - toMin(d.actualStart);
  if (Math.abs(planned - actual) > t.maxDurationDiff) flags.push(`Durasi aktual berbeda lebih dari ${t.maxDurationDiff} menit dari jadwal`);
  if (late) flags.push("Dikirim melewati batas 1 jam");
  return flags;
}

export const latestData = (r?: LiveReport) => r?.versions[r.versions.length - 1]?.data;

/* ---------- Angka kumulatif & selisih per shift ---------- */
// Satu room live = brand + platform yang sama di hari yang sama. Host mengisi GMV, checkout, dan views
// kumulatif dari dashboard live; hasil shift = selisih dengan laporan shift sebelumnya di room itu.

export type Delta = { gmv: number; checkout: number; views: number };

export interface ShiftResult {
  cum: ReportData;
  delta: Delta;
  prevSessionId?: string;
  /** Sesi sebelumnya di room yang belum lapor; hasilnya ikut terhitung di selisih ini. */
  skipped: string[];
}

export const roomKey = (s: LiveSession) => `${s.date}|${s.brandId}|${s.platformId}`;

export const diff = (d: ReportData, prev?: ReportData): Delta => ({
  gmv: d.gmv - (prev?.gmv ?? 0),
  checkout: d.checkout - (prev?.checkout ?? 0),
  views: d.views - (prev?.views ?? 0),
});

const submittedData = (r?: LiveReport) => (r?.status === "submitted" ? latestData(r) : undefined);

export function computeShiftResults(sessions: LiveSession[], reportOf: (sessionId: string) => LiveReport | undefined) {
  const rooms = new Map<string, LiveSession[]>();
  for (const s of sessions) if (!s.cancelled) rooms.set(roomKey(s), [...(rooms.get(roomKey(s)) ?? []), s]);
  const out = new Map<string, ShiftResult>();
  for (const list of rooms.values()) {
    list.sort((a, b) => a.start.localeCompare(b.start));
    let prev: { id: string; d: ReportData } | undefined;
    let skipped: string[] = [];
    for (const s of list) {
      const d = submittedData(reportOf(s.id));
      if (!d) {
        skipped.push(s.id);
        continue;
      }
      out.set(s.id, { cum: d, delta: diff(d, prev?.d), prevSessionId: prev?.id, skipped });
      prev = { id: s.id, d };
      skipped = [];
    }
  }
  return out;
}

/** Laporan terakhir sebelum sesi ini di room yang sama (acuan selisih). */
export function previousReport(sessions: LiveSession[], reportOf: (sessionId: string) => LiveReport | undefined, s: LiveSession) {
  return sessions
    .filter((x) => !x.cancelled && x.id !== s.id && roomKey(x) === roomKey(s) && x.start < s.start)
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((x) => ({ session: x, data: submittedData(reportOf(x.id)) }))
    .find((x) => x.data) as { session: LiveSession; data: ReportData } | undefined;
}

/* ---------- Jadwal ---------- */

export const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd);

export function validateRange(start: string, end: string): string | undefined {
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return "Format jam HH:MM";
  if (toMin(start) < OPS_START || toMin(end) > OPS_END) return "Harus dalam jam operasional 08:00–24:00 WIB";
  if (toMin(end) <= toMin(start)) return "Jam selesai harus setelah jam mulai";
}

/** Rentang jam operasional 08:00–24:00 yang belum tertutup oleh interval mana pun (untuk peringatan slot kosong). */
export function coverageGaps(intervals: { start: string; end: string }[]): { start: string; end: string }[] {
  const sorted = [...intervals].sort((a, b) => toMin(a.start) - toMin(b.start));
  const gaps: { start: string; end: string }[] = [];
  let cursor = OPS_START;
  for (const iv of sorted) {
    if (toMin(iv.start) > cursor) gaps.push({ start: toHHMM(cursor), end: iv.start });
    cursor = Math.max(cursor, toMin(iv.end));
  }
  if (cursor < OPS_END) gaps.push({ start: toHHMM(cursor), end: toHHMM(OPS_END) });
  return gaps;
}
