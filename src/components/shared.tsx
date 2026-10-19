"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useLookup, useStore } from "@/lib/store";
import { attendanceBadge, attendanceState, deadlineOf, pastDeadline, SESSION_LABEL, sessionEnded, sessionStatus, workMinutes } from "@/lib/rules";
import { formatDate, formatDuration, toHHMM } from "@/lib/time";
import type { LiveSession, ShiftAssignment } from "@/lib/types";
import { Badge, Button, Empty, PlatformBadge } from "./ui";

/** Data milik host yang sedang login saja. */
export function useMine() {
  const { data, user } = useStore();
  return useMemo(() => {
    const hostId = user?.hostId ?? "";
    return {
      hostId,
      assignments: data.assignments.filter((a) => a.hostId === hostId),
      sessions: data.sessions.filter((s) => s.hostId === hostId),
    };
  }, [data, user]);
}

export function AttendanceCard({ a, big }: { a: ShiftAssignment; big?: boolean }) {
  const { data, now, clockIn, clockOut, toast } = useStore();
  const lookup = useLookup();
  const att = data.attendance[a.id];
  const st = attendanceState(a, att, now);
  const badge = attendanceBadge(a, att, now);
  const size = big ? "lg" : "md";

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{lookup.shiftName(a)}</p>
          <p className="text-2xl font-bold text-slate-900">
            {a.start}–{a.end} <span className="text-sm font-normal text-slate-500">WIB</span>
          </p>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-slate-50 py-2">
          <p className="text-xs text-slate-500">Masuk</p>
          <p className="font-semibold">{att?.clockIn != null ? toHHMM(att.clockIn) : "–"}</p>
        </div>
        <div className="rounded-lg bg-slate-50 py-2">
          <p className="text-xs text-slate-500">Keluar</p>
          <p className="font-semibold">{att?.clockOut != null ? toHHMM(att.clockOut) : "–"}</p>
        </div>
        <div className="rounded-lg bg-slate-50 py-2">
          <p className="text-xs text-slate-500">Durasi</p>
          <p className="font-semibold">{workMinutes(att) != null ? formatDuration(workMinutes(att)!) : "–"}</p>
        </div>
      </div>

      <div className="mt-4">
        {st.kind === "upcoming" && (
          <>
            <Button size={size} className="w-full" disabled>
              <LogIn size={18} /> Clock-in
            </Button>
            <p className="mt-2 text-center text-xs text-slate-500">Clock-in dibuka pukul {st.opensAt} WIB (30 menit sebelum shift)</p>
          </>
        )}
        {st.kind === "open" && (
          <>
            <Button
              size={size}
              className="w-full"
              onClick={() => {
                clockIn(a.id);
                toast(st.lateBy ? `Clock-in tercatat. Terlambat ${st.lateBy} menit.` : "Clock-in tercatat. Tepat waktu!");
              }}
            >
              <LogIn size={18} /> Clock-in sekarang
            </Button>
            <p className={`mt-2 text-center text-xs ${st.lateBy ? "text-red-600" : "text-slate-500"}`}>
              {st.lateBy ? `Shift sudah mulai — akan tercatat terlambat ${st.lateBy} menit` : `Tepat waktu bila clock-in sebelum ${a.start}`}
            </p>
          </>
        )}
        {st.kind === "in" && (
          <Button
            size={size}
            variant="secondary"
            className="w-full"
            onClick={() => {
              clockOut(a.id);
              toast("Clock-out tercatat.");
            }}
          >
            <LogOut size={18} /> Clock-out
          </Button>
        )}
        {st.kind === "out" && <p className="text-center text-sm text-emerald-700">Shift selesai. Terima kasih!</p>}
        {st.kind === "closed" && <p className="text-center text-sm text-red-600">Shift sudah berakhir tanpa clock-in. Hubungi manager untuk koreksi.</p>}
        {att?.corrected && <p className="mt-2 text-center text-xs text-sky-700">Dikoreksi manager: {att.correctionReason}</p>}
      </div>
    </div>
  );
}

export function SessionRow({ s, showHost, action }: { s: LiveSession; showHost?: boolean; action?: React.ReactNode }) {
  const { now } = useStore();
  const lookup = useLookup();
  const st = SESSION_LABEL[sessionStatus(s, lookup.report(s.id), now)];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="w-24 shrink-0 font-semibold text-slate-900">
        {s.start}–{s.end}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{lookup.brand(s.brandId)}</p>
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <PlatformBadge name={lookup.platform(s.platformId)} />
          {showHost && <span>{lookup.host(s.hostId)}</span>}
          <span>{s.studio}</span>
        </p>
      </div>
      <Badge tone={st.tone}>{st.label}</Badge>
      {action}
    </div>
  );
}

export function useToReport() {
  const { now } = useStore();
  const lookup = useLookup();
  const { sessions } = useMine();
  return sessions
    .filter((s) => !s.cancelled && sessionEnded(s, now))
    .filter((s) => {
      const r = lookup.report(s.id);
      return r?.status !== "submitted" || r.review === "correction";
    })
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
}

export function ToReportList({ limit }: { limit?: number }) {
  const { now } = useStore();
  const lookup = useLookup();
  const list = useToReport();
  if (!list.length) return <Empty>Semua sesi sudah dilaporkan 🎉</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {list.slice(0, limit).map((s) => {
        const r = lookup.report(s.id);
        const fix = r?.review === "correction";
        const late = pastDeadline(s, now);
        return (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{lookup.brand(s.brandId)}</p>
              <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <PlatformBadge name={lookup.platform(s.platformId)} />
                {formatDate(s.date)} · {s.start}–{s.end}
              </p>
            </div>
            {fix ? (
              <Badge tone="yellow">Perlu koreksi</Badge>
            ) : late ? (
              <Badge tone="red">Lewat batas</Badge>
            ) : (
              <Badge tone="yellow">Batas {toHHMM(deadlineOf(s) % 1440)}</Badge>
            )}
            <Link href={`/host/laporan/${s.id}`}>
              <Button size="sm">{fix ? "Perbaiki" : r?.status === "draft" ? "Lanjutkan" : "Isi laporan"}</Button>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
