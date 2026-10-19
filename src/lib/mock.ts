import type { AppData, AuditLog, LiveReport, LiveSession, Now, ReportData, ShiftAssignment } from "./types";
import { addDays, moment, nowKey, toHHMM, toMin } from "./time";
import { DEFAULT_ANOMALY, detectAnomalies, REPORT_DEADLINE, roomKey } from "./rules";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Data demo yang tanggalnya mengikuti hari ini (6 hari ke belakang s/d 2 hari ke depan). */
export function seed(now: Now): AppData {
  const rand = rng(20261019);
  const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const today = now.date;
  const k = nowKey(now);

  // 8 host: 4 tim TikTok Shop (Studio 1) dan 4 tim Shopee (Studio 2), live bersamaan di setiap shift.
  const hosts = [
    { id: "h1", name: "Putri Ayuningtyas", phone: "0812-1111-2201", studio: "Studio 1" },
    { id: "h2", name: "Dimas Pratama", phone: "0812-1111-2202", studio: "Studio 1" },
    { id: "h3", name: "Nadia Kusuma", phone: "0812-1111-2203", studio: "Studio 1" },
    { id: "h4", name: "Bayu Saputra", phone: "0812-1111-2204", studio: "Studio 1" },
    { id: "h5", name: "Citra Lestari", phone: "0812-1111-2205", studio: "Studio 2" },
    { id: "h6", name: "Fajar Nugroho", phone: "0812-1111-2206", studio: "Studio 2" },
    { id: "h7", name: "Rina Marlina", phone: "0812-1111-2207", studio: "Studio 2" },
    { id: "h8", name: "Yoga Permana", phone: "0812-1111-2208", studio: "Studio 2" },
  ].map((h) => ({ ...h, active: true }));
  const teams = [
    { platformId: "p-tiktok", hostIds: ["h1", "h2", "h3", "h4"] },
    { platformId: "p-shopee", hostIds: ["h5", "h6", "h7", "h8"] },
  ];

  const users: AppData["users"] = [
    { id: "u-admin", name: "Sari Wulandari", email: "admin@agency.id", role: "admin", active: true },
    { id: "u-manager", name: "Rian Hidayat", email: "manager@agency.id", role: "manager", active: true },
    ...hosts.map((h) => ({
      id: `u-${h.id}`,
      name: h.name,
      email: `${h.name.split(" ")[0].toLowerCase()}@agency.id`,
      role: "host" as const,
      active: true,
      hostId: h.id,
    })),
  ];

  // Brand terdaftar per platform (satu toko/akun per platform).
  const brands = [
    { id: "b1", name: "Bonju", pic: "Maya", platformId: "p-tiktok" },
    { id: "b2", name: "Wardrobe Hijab Daily", pic: "Laila", platformId: "p-tiktok" },
    { id: "b3", name: "OT", pic: "Andi", platformId: "p-shopee" },
    { id: "b4", name: "MAMEE", pic: "Rina", platformId: "p-shopee" },
  ].map((b) => ({ ...b, active: true }));

  const platforms = [
    { id: "p-tiktok", name: "TikTok Shop", active: true },
    { id: "p-shopee", name: "Shopee", active: true },
  ];

  const templates = [
    { id: "t-pagi", name: "Pagi", start: "08:00", end: "12:00", active: true },
    { id: "t-siang", name: "Siang", start: "12:00", end: "16:00", active: true },
    { id: "t-sore", name: "Sore", start: "16:00", end: "20:00", active: true },
    { id: "t-malam", name: "Malam", start: "20:00", end: "24:00", active: true },
  ];

  const assignments: ShiftAssignment[] = [];
  const sessions: LiveSession[] = [];
  const attendance: AppData["attendance"] = {};
  const reports: LiveReport[] = [];
  const audit: AuditLog[] = [];

  // Tiap shift: satu host TikTok Shop + satu host Shopee, live bersamaan untuk brand yang sama hari itu.
  // Hari ini urutannya tetap (Shift 1 = h1 & h5 … Shift 4 = h4 & h8) dan brand-nya Beauty Glow Skincare.
  for (let d = -6; d <= 6; d++) {
    const date = addDays(today, d);
    // Hari ini: TikTok Shop = Bonju, Shopee = OT; hari lain dipilih acak dari brand platform itu.
    const brandOf = (platformId: string) =>
      d === 0 ? (platformId === "p-tiktok" ? "b1" : "b3") : pick(brands.filter((b) => b.platformId === platformId)).id;
    const dayBrand = Object.fromEntries(teams.map((t) => [t.platformId, brandOf(t.platformId)]));
    templates.forEach((t, i) => {
      teams.forEach((team, ti) => {
        const hostId = team.hostIds[(i + (d === 0 ? 0 : d + 8)) % team.hostIds.length];
        const a: ShiftAssignment = { id: `a-${date}-${i}-${ti}`, date, templateId: t.id, hostId, start: t.start, end: t.end };
        assignments.push(a);
        sessions.push({
          id: `s-${date}-${i}-${ti}`,
          date,
          start: t.start,
          end: t.end,
          hostId,
          brandId: dayBrand[team.platformId],
          platformId: team.platformId,
          assignmentId: a.id,
          studio: hosts.find((h) => h.id === hostId)!.studio,
        });

        // Absensi untuk shift yang sudah dimulai
        if (k < moment(date, toMin(t.start))) return;
        if (d < 0 && rand() < 0.05) return; // tidak hadir
        const ended = k >= moment(date, toMin(t.end));
        const late = rand() < 0.2;
        const clockIn = late ? toMin(t.start) + between(3, 20) : toMin(t.start) - between(2, 25);
        attendance[a.id] = {
          assignmentId: a.id,
          clockIn,
          clockOut: ended ? toMin(t.end) + between(0, 8) : undefined,
          lateMinutes: Math.max(0, clockIn - toMin(t.start)),
        };
      });
    });
  }

  // Laporan untuk sesi yang sudah selesai. GMV, checkout, dan views disimpan kumulatif per room live.
  const running = new Map<string, ReportData>();
  let corrections = 0;
  let revisions = 0;
  for (const s of sessions) {
    const endKey = moment(s.date, toMin(s.end));
    if (k < endKey || s.date === today) continue; // laporan hari ini diisi sendiri saat demo
    const pastDeadline = k > moment(s.date, toMin(s.end) + REPORT_DEADLINE);
    if (!attendance[s.assignmentId!]) continue;
    if (pastDeadline && rand() < 0.08) continue; // belum lapor
    if (!pastDeadline && rand() < 0.5) continue; // masih dalam batas 1 jam

    const views = between(1500, 25000);
    const ctr = Math.round((2 + rand() * 10) * 10) / 10;
    const ctor = Math.round((3 + rand() * 12) * 10) / 10;
    const checkout = Math.max(1, Math.round(((views * ctr) / 100) * (ctor / 100) * 4));
    const data: ReportData = {
      actualStart: toHHMM(toMin(s.start) + between(0, 5)),
      actualEnd: toHHMM(toMin(s.end) - between(0, 5)),
      gmv: Math.round((checkout * between(60, 250) * 1000) / 1000) * 1000,
      ctr,
      ctor,
      views,
      avgWatchSec: between(25, 180),
      checkout,
      notes: "",
    };
    const prev = running.get(roomKey(s));
    data.gmv += prev?.gmv ?? 0;
    data.checkout += prev?.checkout ?? 0;
    data.views += prev?.views ?? 0;
    const roll = rand();
    if (roll < 0.05) data.gmv = prev ? Math.round(prev.gmv * 0.6) : 0; // salah input
    else if (roll < 0.1) data.ctr = between(32, 48);
    running.set(roomKey(s), data);

    const userId = `u-${s.hostId}`;
    const at = moment(s.date, toMin(s.end) + between(5, 50));
    const flags = detectAnomalies(data, s, false, prev);
    const r: LiveReport = {
      id: `r-${s.id}`,
      sessionId: s.id,
      status: "submitted",
      versions: [{ no: 1, data, by: userId, at }],
      review: flags.length ? "flagged" : "clear",
      flags,
      notes: [],
      submittedAt: at,
    };

    if (flags.length && s.date < today) {
      if (corrections === 0) {
        r.review = "correction";
        r.notes.push({ by: "u-manager", at: moment(s.date, toMin(s.end) + 120), text: "Mohon cek ulang angka GMV dari dashboard seller.", action: "correction" });
        corrections++;
      } else if (rand() < 0.6) {
        r.review = "resolved";
        r.notes.push({ by: "u-manager", at: moment(s.date, toMin(s.end) + 150), text: "Sudah dicek dengan dashboard seller, angka sesuai.", action: "resolve" });
        audit.push({ id: `l-${r.id}`, at: r.notes[0].at, actorId: "u-manager", action: "Selesaikan flag", object: "Laporan", objectId: r.id, summary: "Flag anomali diselesaikan" });
      }
    } else if (!flags.length && s.date < today && revisions < 2) {
      const revised = { ...data, checkout: data.checkout + 3, gmv: data.gmv + 450_000 };
      const rat = moment(s.date, toMin(s.end) + 200);
      r.versions.push({ no: 2, data: revised, by: userId, at: rat, reason: "Ada 3 pesanan yang baru masuk setelah live ditutup." });
      audit.push({
        id: `l-rev-${r.id}`,
        at: rat,
        actorId: userId,
        action: "Revisi laporan",
        object: "Laporan",
        objectId: r.id,
        summary: "Revisi ke versi 2",
        before: `GMV ${data.gmv}, checkout ${data.checkout}`,
        after: `GMV ${revised.gmv}, checkout ${revised.checkout}`,
      });
      revisions++;
    }
    reports.push(r);
  }

  audit.push({
    id: "l-seed",
    at: moment(addDays(today, -6), 7 * 60),
    actorId: "u-admin",
    action: "Buat template shift",
    object: "Template shift",
    objectId: "t-pagi",
    summary: "Template Pagi, Siang, Sore, Malam dibuat",
  });
  audit.push({
    id: "l-publish",
    at: moment(addDays(today, -1), 17 * 60),
    actorId: "u-manager",
    action: "Terbitkan jadwal",
    object: "Shift",
    objectId: "minggu",
    summary: `Jadwal 7 hari (${today} s/d ${addDays(today, 6)}) diterbitkan`,
    hostIds: hosts.map((h) => h.id),
  });

  return {
    seedDate: today,
    users,
    hosts,
    brands,
    platforms,
    templates,
    assignments,
    attendance,
    sessions,
    reports,
    audit: audit.sort((a, b) => b.at.localeCompare(a.at)),
    settings: DEFAULT_ANOMALY,
  };
}
