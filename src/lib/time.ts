import type { Now } from "./types";

export const TZ = "Asia/Jakarta";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Tanggal & menit saat ini dalam WIB. */
export function wibNow(d = new Date()): Now {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function addDays(date: string, n: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Kunci yang bisa dibandingkan sebagai string; menit >= 1440 digeser ke hari berikutnya. */
export function moment(date: string, minutes: number) {
  const days = Math.floor(minutes / 1440);
  return `${addDays(date, days)} ${toHHMM(minutes - days * 1440)}`;
}

export const nowKey = (now: Now) => moment(now.date, now.minutes);
export const stamp = nowKey;

const utc = (date: string) => new Date(date + "T00:00:00Z");
const dayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const dayName = (date: string) => dayFmt.format(utc(date));
export const formatDateLong = (date: string) => longFmt.format(utc(date));
export const formatDate = (date: string) => shortFmt.format(utc(date));

/** "2026-10-19 15:30" → "19 Okt 2026, 15:30" */
export function formatStamp(s: string) {
  const [date, time] = s.split(" ");
  return `${formatDate(date)}, ${time}`;
}

export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} menit`;
  return m === 0 ? `${h} jam` : `${h} jam ${m} menit`;
}

export const monthStart = (date: string) => date.slice(0, 8) + "01";
