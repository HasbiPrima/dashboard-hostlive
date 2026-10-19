"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  AnomalySettings,
  AppData,
  AuditLog,
  Brand,
  Host,
  LiveReport,
  LiveSession,
  Now,
  ReportData,
  ReportForm,
  ReviewNote,
  ShiftTemplate,
  User,
} from "./types";
import { seed } from "./mock";
import { stamp, toHHMM, toMin, wibNow } from "./time";
import {
  computeShiftResults,
  DEFAULT_ANOMALY,
  detectAnomalies,
  lateMinutesAt,
  overlaps,
  pastDeadline,
  previousReport,
  sessionEnded,
  validateRange,
} from "./rules";

// Data & jam simulasi dibagi antar tab (localStorage); akun login per tab (sessionStorage),
// jadi tiap tab bisa login sebagai host yang berbeda saat demo.
const DATA_KEY = "lmams-demo-data-v5";
const SEEN_KEY = "lmams-schedule-seen-";
const DEMO_TIME_KEY = "lmams-demo-time";
const USER_KEY = "lmams-demo-user";
const local = () => localStorage;
const session = () => sessionStorage;

type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

let counter = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(counter++).toString(36)}`;

function read<T>(key: string, store = local): T | undefined {
  try {
    const raw = store().getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}
function write(key: string, value: unknown, store = local) {
  try {
    if (value === undefined) store().removeItem(key);
    else store().setItem(key, JSON.stringify(value));
  } catch {
    /* penyimpanan browser tidak tersedia: data tetap berjalan di memori */
  }
}

interface Store {
  ready: boolean;
  data: AppData;
  user?: User;
  now: Now;
  demoMinutes: number | null;
  setDemoMinutes(m: number | null): void;
  toastMsg: string | null;
  toast(msg: string): void;
  login(userId: string): void;
  logout(): void;
  resetDemo(): void;
  /** Waktu terakhir host membuka halaman jadwal; perubahan setelahnya ditandai "Baru". */
  scheduleSeenAt: string;
  markScheduleSeen(): void;

  clockIn(assignmentId: string): void;
  clockOut(assignmentId: string): void;
  correctAttendance(assignmentId: string, clockIn: string, clockOut: string, reason: string): Result;

  saveDraft(sessionId: string, form: ReportForm): void;
  submitReport(sessionId: string, data: ReportData, reason?: string): { ok: boolean; error?: string; flags?: string[] };
  reviewReport(reportId: string, action: ReviewNote["action"], text: string): Result;

  addAssignment(date: string, hostId: string, start: string, end: string): Result;
  removeAssignment(id: string): Result;
  saveSession(input: Omit<LiveSession, "id" | "studio" | "assignmentId"> & { id?: string }): Result;
  cancelSession(id: string): void;

  saveUser(u: Omit<User, "id"> & { id?: string }): Result;
  saveHost(h: Omit<Host, "id"> & { id?: string }): Result;
  saveBrand(b: Omit<Brand, "id"> & { id?: string }): Result;
  togglePlatform(id: string): void;
  saveTemplate(t: Omit<ShiftTemplate, "id"> & { id?: string }): Result;

  settings: AnomalySettings;
  saveSettings(s: AnomalySettings): Result;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [userId, setUserId] = useState<string | undefined>();
  const [real, setReal] = useState<Now | null>(null);
  const [demoMinutes, setDemoState] = useState<number | null>(null);
  const [toastMsg, setToast] = useState<string | null>(null);
  const [seenVersion, setSeenVersion] = useState(0);

  // Muat dari localStorage; buat data demo baru bila belum ada atau sudah beda hari.
  useEffect(() => {
    const now = wibNow();
    const saved = read<AppData>(DATA_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hanya tersedia setelah mount
    setData(saved && saved.seedDate === now.date ? saved : seed(now));
    setReal(now);
    setUserId(read<string>(USER_KEY, session));
    setDemoState(read<number>(DEMO_TIME_KEY) ?? null);

    // Perubahan dari tab lain (mis. host shift lain mengirim laporan) langsung tampil di tab ini.
    const onStorage = (e: StorageEvent) => {
      if (e.key === DATA_KEY && e.newValue) setData(JSON.parse(e.newValue) as AppData);
      if (e.key === DEMO_TIME_KEY) setDemoState(e.newValue ? (JSON.parse(e.newValue) as number) : null);
    };
    window.addEventListener("storage", onStorage);
    const t = setInterval(() => setReal(wibNow()), 20_000);
    return () => {
      clearInterval(t);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setDemoMinutes = useCallback((m: number | null) => {
    setDemoState(m);
    write(DEMO_TIME_KEY, m ?? undefined);
  }, []);

  useEffect(() => {
    if (data) write(DATA_KEY, data);
  }, [data]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const now = useMemo<Now>(() => {
    const base = real ?? { date: "", minutes: 0 };
    return demoMinutes == null ? base : { date: base.date, minutes: demoMinutes };
  }, [real, demoMinutes]);
  const user = data?.users.find((u) => u.id === userId && u.active);
  const actor = user?.id ?? "system";
  // eslint-disable-next-line react-hooks/exhaustive-deps -- seenVersion memicu baca ulang setelah markScheduleSeen
  const scheduleSeenAt = useMemo(() => (user ? (read<string>(SEEN_KEY + user.id) ?? "") : ""), [user, seenVersion]);

  /** Terapkan perubahan + catat audit log dalam satu langkah. */
  const commit = useCallback(
    (fn: (d: AppData) => AppData, log?: Omit<AuditLog, "id" | "at" | "actorId">) => {
      setData((d) => {
        if (!d) return d;
        const next = fn(d);
        return log ? { ...next, audit: [{ id: uid("l"), at: stamp(now), actorId: actor, ...log }, ...next.audit] } : next;
      });
    },
    [now, actor],
  );

  const store = useMemo<Store | null>(() => {
    if (!data || !real) return null;
    const hostName = (id: string) => data.hosts.find((h) => h.id === id)?.name ?? id;
    const settings = data.settings ?? DEFAULT_ANOMALY;

    return {
      ready: true,
      data,
      user,
      now,
      demoMinutes,
      setDemoMinutes,
      toastMsg,
      toast: setToast,
      login(id) {
        write(USER_KEY, id, session);
        setUserId(id);
      },
      logout() {
        write(USER_KEY, undefined, session);
        setUserId(undefined);
      },
      scheduleSeenAt,
      markScheduleSeen() {
        if (!user) return;
        write(SEEN_KEY + user.id, stamp(now));
        setSeenVersion((v) => v + 1);
      },
      resetDemo() {
        setData(seed(wibNow()));
        setDemoMinutes(null);
      },

      clockIn(assignmentId) {
        const a = data.assignments.find((x) => x.id === assignmentId);
        if (!a || a.hostId !== user?.hostId || data.attendance[assignmentId]?.clockIn != null) return;
        const late = lateMinutesAt(a, now.minutes);
        commit(
          (d) => ({ ...d, attendance: { ...d.attendance, [assignmentId]: { assignmentId, clockIn: now.minutes, lateMinutes: late } } }),
          { action: "Clock-in", object: "Absensi", objectId: assignmentId, summary: late ? `Clock-in ${toHHMM(now.minutes)}, terlambat ${late} menit` : `Clock-in ${toHHMM(now.minutes)}, tepat waktu` },
        );
      },
      clockOut(assignmentId) {
        const att = data.attendance[assignmentId];
        if (att?.clockIn == null || att.clockOut != null) return;
        commit(
          (d) => ({ ...d, attendance: { ...d.attendance, [assignmentId]: { ...att, clockOut: Math.max(now.minutes, att.clockIn!) } } }),
          { action: "Clock-out", object: "Absensi", objectId: assignmentId, summary: `Clock-out ${toHHMM(now.minutes)}` },
        );
      },
      correctAttendance(assignmentId, clockIn, clockOut, reason) {
        const a = data.assignments.find((x) => x.id === assignmentId);
        if (!a) return fail("Penugasan tidak ditemukan");
        if (!reason.trim()) return fail("Alasan koreksi wajib diisi");
        if (!/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(clockIn) || !/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(clockOut))
          return fail("Format jam HH:MM");
        if (toMin(clockOut) <= toMin(clockIn)) return fail("Jam keluar harus setelah jam masuk");
        const before = data.attendance[assignmentId];
        const fmt = (m?: number) => (m == null ? "-" : toHHMM(m));
        commit(
          (d) => ({
            ...d,
            attendance: {
              ...d.attendance,
              [assignmentId]: {
                assignmentId,
                clockIn: toMin(clockIn),
                clockOut: toMin(clockOut),
                lateMinutes: lateMinutesAt(a, toMin(clockIn)),
                corrected: true,
                correctionReason: reason.trim(),
              },
            },
          }),
          {
            action: "Koreksi absensi",
            object: "Absensi",
            objectId: assignmentId,
            summary: `${hostName(a.hostId)} — ${reason.trim()}`,
            before: `Masuk ${fmt(before?.clockIn)}, keluar ${fmt(before?.clockOut)}`,
            after: `Masuk ${clockIn}, keluar ${clockOut}`,
          },
        );
        return ok;
      },

      saveDraft(sessionId, form) {
        commit((d) => {
          const existing = d.reports.find((r) => r.sessionId === sessionId);
          if (existing?.status === "submitted") return d;
          const draft: LiveReport = existing
            ? { ...existing, draft: form }
            : { id: uid("r"), sessionId, status: "draft", draft: form, versions: [], review: "clear", flags: [], notes: [] };
          return { ...d, reports: existing ? d.reports.map((r) => (r.id === existing.id ? draft : r)) : [...d.reports, draft] };
        });
      },
      submitReport(sessionId, reportData, reason) {
        const s = data.sessions.find((x) => x.id === sessionId);
        if (!s || s.hostId !== user?.hostId) return { ok: false, error: "Sesi ini bukan milik Anda" };
        if (s.cancelled) return { ok: false, error: "Sesi dibatalkan" };
        if (!sessionEnded(s, now)) return { ok: false, error: `Laporan bisa diisi setelah sesi selesai (${s.end} WIB)` };
        const late = pastDeadline(s, now);
        if (late && !reason?.trim()) return { ok: false, error: "Alasan wajib diisi karena melewati batas 1 jam" };

        const existing = data.reports.find((r) => r.sessionId === sessionId);
        const isRevision = existing?.status === "submitted";
        const prevReport = previousReport(data.sessions, (id) => data.reports.find((r) => r.sessionId === id), s);
        const flags = detectAnomalies(reportData, s, late, prevReport?.data, settings);
        // Revisi atas permintaan koreksi selalu kembali ke antrean manager untuk dicek.
        if (existing?.review === "correction") flags.push("Revisi setelah permintaan koreksi — perlu dicek manager");
        const at = stamp(now);
        const version = { no: (existing?.versions.length ?? 0) + 1, data: reportData, by: actor, at, reason: reason?.trim() || undefined };
        const next: LiveReport = {
          id: existing?.id ?? uid("r"),
          sessionId,
          status: "submitted",
          versions: [...(existing?.versions ?? []), version],
          review: flags.length ? "flagged" : "clear",
          flags,
          notes: existing?.notes ?? [],
          submittedAt: existing?.submittedAt && isRevision ? existing.submittedAt : at,
        };
        const prev = isRevision ? existing!.versions[existing!.versions.length - 1].data : undefined;
        commit(
          (d) => ({ ...d, reports: existing ? d.reports.map((r) => (r.id === existing.id ? next : r)) : [...d.reports, next] }),
          {
            action: isRevision ? "Revisi laporan" : "Kirim laporan",
            object: "Laporan",
            objectId: next.id,
            summary: isRevision ? `Revisi ke versi ${version.no}${version.reason ? ` — ${version.reason}` : ""}` : `Laporan sesi ${s.date} ${s.start}–${s.end}`,
            before: prev ? `GMV ${prev.gmv}, checkout ${prev.checkout}, views ${prev.views}` : undefined,
            after: isRevision ? `GMV ${reportData.gmv}, checkout ${reportData.checkout}, views ${reportData.views}` : undefined,
          },
        );
        return { ok: true, flags };
      },
      reviewReport(reportId, action, text) {
        const r = data.reports.find((x) => x.id === reportId);
        if (!r) return fail("Laporan tidak ditemukan");
        if (action !== "resolve" && !text.trim()) return fail("Catatan wajib diisi");
        const review = action === "correction" ? "correction" : action === "resolve" ? "resolved" : r.review;
        const note: ReviewNote = { by: actor, at: stamp(now), text: text.trim() || "Flag diselesaikan", action };
        const label = { note: "Tambah catatan", correction: "Minta koreksi", resolve: "Selesaikan flag" }[action];
        commit((d) => ({ ...d, reports: d.reports.map((x) => (x.id === reportId ? { ...x, review, notes: [...x.notes, note] } : x)) }), {
          action: label,
          object: "Laporan",
          objectId: reportId,
          summary: note.text,
        });
        return ok;
      },

      addAssignment(date, hostId, start, end) {
        if (!hostId) return fail("Pilih host");
        const err = validateRange(start, end);
        if (err) return fail(err);
        const clash = data.assignments.find((a) => a.date === date && a.hostId === hostId && overlaps(a.start, a.end, start, end));
        if (clash) return fail(`${hostName(hostId)} sudah punya shift ${clash.start}–${clash.end} di tanggal ini (bentrok)`);
        // Jam diisi bebas; bila sama persis dengan template, namanya ikut dipakai (mis. "Pagi").
        const templateId = data.templates.find((t) => t.start === start && t.end === end)?.id;
        const id = uid("a");
        commit((d) => ({ ...d, assignments: [...d.assignments, { id, date, templateId, hostId, start, end }] }), {
          action: "Tambah penugasan",
          object: "Shift",
          objectId: id,
          summary: `${hostName(hostId)} · ${date} ${start}–${end}`,
          hostIds: [hostId],
        });
        return ok;
      },
      removeAssignment(id) {
        const a = data.assignments.find((x) => x.id === id);
        if (!a) return fail("Tidak ditemukan");
        if (data.attendance[id]) return fail("Tidak bisa dihapus: sudah ada absensi");
        if (data.sessions.some((s) => s.assignmentId === id && !s.cancelled)) return fail("Hapus/batalkan sesi di shift ini dulu");
        commit((d) => ({ ...d, assignments: d.assignments.filter((x) => x.id !== id) }), {
          action: "Hapus penugasan",
          object: "Shift",
          objectId: id,
          summary: `${hostName(a.hostId)} · ${a.date} ${a.start}–${a.end}`,
          hostIds: [a.hostId],
        });
        return ok;
      },
      saveSession(input) {
        const err = validateRange(input.start, input.end);
        if (err) return fail(err);
        if (!input.hostId || !input.brandId || !input.platformId) return fail("Host, brand, dan platform wajib dipilih");
        if (data.brands.find((b) => b.id === input.brandId)?.platformId !== input.platformId)
          return fail("Brand ini tidak terdaftar di platform yang dipilih");
        const assignment = data.assignments.find(
          (a) => a.date === input.date && a.hostId === input.hostId && toMin(a.start) <= toMin(input.start) && toMin(input.end) <= toMin(a.end),
        );
        if (!assignment) return fail(`${hostName(input.hostId)} tidak punya shift yang mencakup ${input.start}–${input.end}`);
        const clash = data.sessions.find(
          (s) => s.id !== input.id && !s.cancelled && s.date === input.date && s.hostId === input.hostId && overlaps(s.start, s.end, input.start, input.end),
        );
        // Satu host hanya bisa live di satu platform pada satu waktu.
        if (clash)
          return fail(
            `${hostName(input.hostId)} sudah live di ${data.platforms.find((p) => p.id === clash.platformId)?.name} ${clash.start}–${clash.end}. Host tidak bisa live di 2 platform pada jam yang sama.`,
          );
        const studio = data.hosts.find((h) => h.id === input.hostId)?.studio ?? "-";
        const brand = data.brands.find((b) => b.id === input.brandId)?.name;
        const platform = data.platforms.find((p) => p.id === input.platformId)?.name;
        const desc = (s: Pick<LiveSession, "date" | "start" | "end" | "hostId" | "brandId" | "platformId">) =>
          `${s.date} ${s.start}–${s.end}, ${hostName(s.hostId)}, ${data.brands.find((b) => b.id === s.brandId)?.name}, ${data.platforms.find((p) => p.id === s.platformId)?.name}`;

        if (input.id) {
          const old = data.sessions.find((s) => s.id === input.id);
          if (!old) return fail("Sesi tidak ditemukan");
          if (old.cancelled || sessionEnded(old, now) || data.reports.some((r) => r.sessionId === old.id && r.status === "submitted"))
            return fail("Sesi yang sudah berjalan/selesai tidak bisa diubah agar riwayat tetap utuh");
          const next = { ...old, ...input, id: old.id, studio, assignmentId: assignment.id };
          commit((d) => ({ ...d, sessions: d.sessions.map((s) => (s.id === old.id ? next : s)) }), {
            action: "Ubah jadwal sesi",
            object: "Sesi live",
            objectId: old.id,
            summary: `${brand} di ${platform}`,
            before: desc(old),
            after: desc(next),
            hostIds: [...new Set([old.hostId, next.hostId])],
          });
        } else {
          const id = uid("s");
          commit((d) => ({ ...d, sessions: [...d.sessions, { ...input, id, studio, assignmentId: assignment.id }] }), {
            action: "Buat sesi",
            object: "Sesi live",
            objectId: id,
            summary: desc(input),
            hostIds: [input.hostId],
          });
        }
        return ok;
      },
      cancelSession(id) {
        const s = data.sessions.find((x) => x.id === id);
        if (!s) return;
        commit((d) => ({ ...d, sessions: d.sessions.map((x) => (x.id === id ? { ...x, cancelled: true } : x)) }), {
          action: "Batalkan sesi",
          object: "Sesi live",
          objectId: id,
          summary: `${s.date} ${s.start}–${s.end}, ${hostName(s.hostId)}`,
          hostIds: [s.hostId],
        });
      },

      saveUser(u) {
        if (!u.name.trim() || !u.email.trim()) return fail("Nama dan email wajib diisi");
        if (data.users.some((x) => x.email.toLowerCase() === u.email.trim().toLowerCase() && x.id !== u.id)) return fail("Email sudah dipakai");
        if (u.role === "host" && !u.hostId) return fail("Pilih profil host untuk akun host");
        const old = data.users.find((x) => x.id === u.id);
        const next: User = { ...u, id: u.id ?? uid("u"), name: u.name.trim(), email: u.email.trim(), hostId: u.role === "host" ? u.hostId : undefined };
        commit((d) => ({ ...d, users: old ? d.users.map((x) => (x.id === old.id ? next : x)) : [...d.users, next] }), {
          action: old ? "Ubah pengguna" : "Tambah pengguna",
          object: "Pengguna",
          objectId: next.id,
          summary: `${next.name} (${next.role}${next.active ? "" : ", nonaktif"})`,
          before: old ? `${old.role}, ${old.active ? "aktif" : "nonaktif"}` : undefined,
          after: old ? `${next.role}, ${next.active ? "aktif" : "nonaktif"}` : undefined,
        });
        return ok;
      },
      saveHost(h) {
        if (!h.name.trim()) return fail("Nama wajib diisi");
        const old = data.hosts.find((x) => x.id === h.id);
        const next: Host = { ...h, id: h.id ?? uid("h"), name: h.name.trim() };
        commit((d) => ({ ...d, hosts: old ? d.hosts.map((x) => (x.id === old.id ? next : x)) : [...d.hosts, next] }), {
          action: old ? "Ubah host" : "Tambah host",
          object: "Host",
          objectId: next.id,
          summary: `${next.name}${next.active ? "" : " (nonaktif)"}`,
        });
        return ok;
      },
      saveBrand(b) {
        if (!b.name.trim()) return fail("Nama brand wajib diisi");
        if (!data.platforms.some((p) => p.id === b.platformId)) return fail("Pilih platform brand");
        if (data.brands.some((x) => x.id !== b.id && x.platformId === b.platformId && x.name.toLowerCase() === b.name.trim().toLowerCase()))
          return fail("Brand ini sudah ada di platform tersebut");
        const old = data.brands.find((x) => x.id === b.id);
        const next: Brand = { ...b, id: b.id ?? uid("b"), name: b.name.trim() };
        const pname = (id: string) => data.platforms.find((p) => p.id === id)?.name;
        commit((d) => ({ ...d, brands: old ? d.brands.map((x) => (x.id === old.id ? next : x)) : [...d.brands, next] }), {
          action: old ? "Ubah brand" : "Tambah brand",
          object: "Brand",
          objectId: next.id,
          summary: `${pname(next.platformId)}: ${next.name}${next.active ? "" : " (nonaktif)"}`,
          before: old ? `${pname(old.platformId)}: ${old.name}` : undefined,
          after: old ? `${pname(next.platformId)}: ${next.name}` : undefined,
        });
        return ok;
      },
      togglePlatform(id) {
        const p = data.platforms.find((x) => x.id === id);
        if (!p) return;
        commit((d) => ({ ...d, platforms: d.platforms.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) }), {
          action: "Ubah platform",
          object: "Platform",
          objectId: id,
          summary: `${p.name} ${p.active ? "dinonaktifkan" : "diaktifkan"}`,
        });
      },
      saveTemplate(t) {
        if (!t.name.trim()) return fail("Nama shift wajib diisi");
        const err = validateRange(t.start, t.end);
        if (err) return fail(err);
        const old = data.templates.find((x) => x.id === t.id);
        const next: ShiftTemplate = { ...t, id: t.id ?? uid("t"), name: t.name.trim() };
        commit((d) => ({ ...d, templates: old ? d.templates.map((x) => (x.id === old.id ? next : x)) : [...d.templates, next] }), {
          action: old ? "Ubah template shift" : "Buat template shift",
          object: "Template shift",
          objectId: next.id,
          summary: `${next.name} ${next.start}–${next.end}${next.active ? "" : " (nonaktif)"}`,
          before: old ? `${old.start}–${old.end}` : undefined,
          after: old ? `${next.start}–${next.end}` : undefined,
        });
        return ok;
      },

      settings,
      saveSettings(next) {
        const vals = Object.values(next);
        if (vals.some((v) => !Number.isFinite(v) || v <= 0)) return fail("Semua nilai harus angka lebih dari 0");
        if (next.maxCtr > 100 || next.maxCtor > 100) return fail("CTR dan CTOR maksimal 100%");
        const fmt = (s: AnomalySettings) =>
          `CTR ${s.maxCtr}%, CTOR ${s.maxCtor}%, GMV/checkout ${s.maxGmvPerCheckout}, durasi ${s.maxDurationDiff} mnt`;
        commit((d) => ({ ...d, settings: next }), {
          action: "Ubah ambang anomali",
          object: "Pengaturan",
          objectId: "anomaly",
          summary: "Ambang flag anomali diperbarui (berlaku untuk laporan berikutnya)",
          before: fmt(settings),
          after: fmt(next),
        });
        return ok;
      },
    };
  }, [data, real, user, now, demoMinutes, setDemoMinutes, toastMsg, commit, actor, scheduleSeenAt]);

  if (!store) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Memuat…</div>;
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore harus di dalam StoreProvider");
  return s;
}

/** Helper pencarian nama yang sering dipakai di halaman. */
export function useLookup() {
  const { data } = useStore();
  return useMemo(() => {
    const by = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
    const hosts = by(data.hosts);
    const brands = by(data.brands);
    const platforms = by(data.platforms);
    const templates = by(data.templates);
    const users = by(data.users);
    const reportBySession = new Map(data.reports.map((r) => [r.sessionId, r]));
    const results = computeShiftResults(data.sessions, (id) => reportBySession.get(id));
    return {
      host: (id: string) => hosts.get(id)?.name ?? "-",
      brand: (id: string) => brands.get(id)?.name ?? "-",
      platform: (id: string) => platforms.get(id)?.name ?? "-",
      template: (id: string) => templates.get(id)?.name ?? "-",
      /** Nama shift dari template bila ada, mis. "Shift Pagi"; selain itu cukup "Shift". */
      shiftName: (a: { templateId?: string }) => (a.templateId && templates.get(a.templateId) ? `Shift ${templates.get(a.templateId)!.name}` : "Shift"),
      user: (id: string) => users.get(id)?.name ?? (id === "system" ? "Sistem" : id),
      report: (sessionId: string) => reportBySession.get(sessionId),
      /** Angka kumulatif + selisih (hasil shift) untuk sesi yang sudah lapor. */
      result: (sessionId: string) => results.get(sessionId),
      sessionHost: (sessionId: string) => data.sessions.find((s) => s.id === sessionId)?.hostId ?? "",
      previous: (s: LiveSession) => previousReport(data.sessions, (id) => reportBySession.get(id), s),
    };
  }, [data]);
}

const SCHEDULE_ACTIONS = new Set(["Tambah penugasan", "Hapus penugasan", "Buat sesi", "Ubah jadwal sesi", "Batalkan sesi", "Terbitkan jadwal"]);

/** Perubahan jadwal yang menyangkut host yang sedang login, terbaru dulu; `unseen` = belum dilihat. */
export function useScheduleUpdates() {
  const { data, user, scheduleSeenAt } = useStore();
  return useMemo(() => {
    const hostId = user?.hostId;
    const updates = hostId ? data.audit.filter((l) => SCHEDULE_ACTIONS.has(l.action) && l.hostIds?.includes(hostId)) : [];
    return { updates, unseen: updates.filter((l) => l.at > scheduleSeenAt).length };
  }, [data, user, scheduleSeenAt]);
}
