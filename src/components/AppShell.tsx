"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  FileText,
  FingerprintPattern as Fingerprint,
  ScrollText as History,
  LayoutDashboard,
  LogOut,
  Menu,
  Radio,
  Settings,
  ShieldAlert,
  Store,
  Tags,
  UserRound,
  Users,
  X,
  ChartColumn,
} from "lucide-react";
import { useScheduleUpdates, useStore } from "@/lib/store";
import { toHHMM } from "@/lib/time";
import type { Role } from "@/lib/types";
import { Button, cx, Select } from "./ui";

type NavItem = { href: string; label: string; icon: React.ElementType; badge?: number };

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", manager: "Manager", host: "Host" };
export const homeOf = (r: Role) => `/${r}`;

function useNav(role: Role): NavItem[] {
  const { data } = useStore();
  const { unseen } = useScheduleUpdates();
  const anomalies = data.reports.filter((r) => r.status === "submitted" && (r.review === "flagged" || r.review === "correction")).length;
  if (role === "host")
    return [
      { href: "/host", label: "Beranda", icon: LayoutDashboard },
      { href: "/host/jadwal", label: "Jadwal", icon: CalendarDays, badge: unseen },
      { href: "/host/absen", label: "Absen", icon: Fingerprint },
      { href: "/host/laporan", label: "Laporan", icon: FileText },
    ];
  if (role === "manager")
    return [
      { href: "/manager", label: "Beranda", icon: LayoutDashboard },
      { href: "/manager/jadwal", label: "Jadwal & Shift", icon: CalendarDays },
      { href: "/manager/absensi", label: "Absensi", icon: Fingerprint },
      { href: "/manager/anomali", label: "Antrean Anomali", icon: ShieldAlert, badge: anomalies },
      { href: "/manager/rekap", label: "Rekap", icon: ChartColumn },
    ];
  return [
    { href: "/admin", label: "Beranda", icon: LayoutDashboard },
    { href: "/admin/jadwal", label: "Jadwal & Shift", icon: CalendarDays },
    { href: "/admin/pengguna", label: "Pengguna", icon: Users },
    { href: "/admin/host", label: "Host", icon: UserRound },
    { href: "/admin/brand", label: "Brand", icon: Tags },
    { href: "/admin/platform", label: "Platform", icon: Store },
    { href: "/admin/shift", label: "Template Shift", icon: Clock },
    { href: "/admin/rekap", label: "Rekap", icon: ChartColumn },
    { href: "/admin/audit", label: "Audit Log", icon: History },
    { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
  ];
}

const isActive = (path: string, href: string) => (href.split("/").length === 2 ? path === href : path.startsWith(href));

// Jam 00–24 (24 hanya :00) agar akhir shift Malam 24:00 bisa disimulasikan; input type="time" berhenti di 23:59.
const HOUR_OPTIONS = Array.from({ length: 25 }, (_, h) => h);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, "0");

function DemoClock() {
  const { now, demoMinutes, setDemoMinutes, resetDemo, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(now.minutes);
  const hour = Math.floor(val / 60);
  const minute = val % 60;
  return (
    <div className="relative">
      <button
        onClick={() => {
          setVal(now.minutes);
          setOpen((o) => !o);
        }}
        className={cx(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium",
          demoMinutes == null ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-900",
        )}
        title="Simulasi waktu (khusus demo)"
      >
        <Clock size={15} />
        {toHHMM(now.minutes)} WIB
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <p className="text-sm font-semibold text-slate-900">Simulasi waktu (demo)</p>
          <p className="text-xs text-slate-500">Atur jam untuk mencoba absen & batas laporan tanpa menunggu.</p>
          <div className="flex items-center gap-2">
            <Select aria-label="Jam" value={hour} onChange={(e) => setVal(Number(e.target.value) === 24 ? 1440 : Number(e.target.value) * 60 + minute)}>
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {pad(h)}
                </option>
              ))}
            </Select>
            <span className="font-semibold text-slate-500">:</span>
            <Select aria-label="Menit" value={minute} disabled={hour === 24} onChange={(e) => setVal(hour * 60 + Number(e.target.value))}>
              {(hour === 24 ? [0] : MINUTE_OPTIONS.includes(minute) ? MINUTE_OPTIONS : [...MINUTE_OPTIONS, minute].sort((a, b) => a - b)).map((m) => (
                <option key={m} value={m}>
                  {pad(m)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setDemoMinutes(val);
                setOpen(false);
              }}
            >
              Terapkan
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setDemoMinutes(null);
                setOpen(false);
              }}
            >
              Waktu asli
            </Button>
          </div>
          <button
            className="text-xs text-red-600 hover:underline"
            onClick={() => {
              resetDemo();
              setOpen(false);
              toast("Data demo direset");
            }}
          >
            Reset data demo
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, logout, toastMsg } = useStore();
  const router = useRouter();
  const path = usePathname();
  const nav = useNav(role);
  const [drawer, setDrawer] = useState(false);

  // Hak akses di frontend hanya untuk navigasi; penegakan sebenarnya wajib di backend (PRD bagian 6).
  useEffect(() => {
    if (!user) router.replace("/");
    else if (user.role !== role) router.replace(homeOf(user.role));
  }, [user, role, router]);

  if (!user || user.role !== role) return null;

  const links = (onClick?: () => void) =>
    nav.map((n) => (
      <Link
        key={n.href}
        href={n.href}
        onClick={onClick}
        className={cx(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
          isActive(path, n.href) ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100",
        )}
      >
        <n.icon size={18} />
        <span className="flex-1">{n.label}</span>
        {!!n.badge && <span className="rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">{n.badge}</span>}
      </Link>
    ));

  const brand = (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
        <Radio size={18} />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-bold text-slate-900">LiveOps</p>
        <p className="text-xs text-slate-500">Agency Management</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white p-4 lg:flex">
        {brand}
        <nav className="mt-6 flex-1 space-y-1">{links()}</nav>
      </aside>

      {/* Drawer mobile untuk Admin/Manager */}
      {drawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden" onClick={() => setDrawer(false)}>
          <aside className="h-full w-64 bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              {brand}
              <button onClick={() => setDrawer(false)} aria-label="Tutup menu" className="p-1 text-slate-400">
                <X size={20} />
              </button>
            </div>
            <nav className="mt-6 space-y-1">{links(() => setDrawer(false))}</nav>
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          {role !== "host" && (
            <button className="p-1 text-slate-600 lg:hidden" onClick={() => setDrawer(true)} aria-label="Buka menu">
              <Menu size={22} />
            </button>
          )}
          <div className="lg:hidden">{brand}</div>
          <div className="ml-auto flex items-center gap-2">
            <DemoClock />
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
            </div>
            <button
              onClick={() => {
                logout();
                router.replace("/");
              }}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              title="Keluar"
              aria-label="Keluar"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className={cx("mx-auto max-w-6xl px-4 py-6", role === "host" && "pb-24 lg:pb-6")}>{children}</main>
      </div>

      {/* Menu bawah untuk Host di HP */}
      {role === "host" && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white lg:hidden">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx("relative flex flex-col items-center gap-1 py-2.5 text-xs font-medium", isActive(path, n.href) ? "text-indigo-600" : "text-slate-500")}
            >
              <n.icon size={20} />
              {n.label}
              {!!n.badge && (
                <span className="absolute right-[calc(50%-20px)] top-1.5 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold leading-4 text-white">{n.badge}</span>
              )}
            </Link>
          ))}
        </nav>
      )}

      {toastMsg && (
        <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-sm rounded-lg bg-slate-900 px-4 py-3 text-center text-sm text-white shadow-lg lg:bottom-6">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

