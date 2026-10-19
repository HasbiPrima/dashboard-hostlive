"use client";

import Link from "next/link";
import { useLookup, useStore } from "@/lib/store";
import { attendanceBadge, coverageGaps, sessionStatus } from "@/lib/rules";
import { formatDate, formatDateLong } from "@/lib/time";
import { rupiahShort, sum } from "@/lib/format";
import { SessionRow } from "@/components/shared";
import { Alert, Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { LiveResult } from "@/components/LiveResult";

export default function ManagerHome() {
  const { data, now } = useStore();
  const lookup = useLookup();

  const todaySessions = data.sessions.filter((s) => s.date === now.date).sort((a, b) => a.start.localeCompare(b.start));
  const todayShifts = data.assignments.filter((a) => a.date === now.date).sort((a, b) => a.start.localeCompare(b.start));
  const gmvToday = sum(todaySessions.map((s) => lookup.result(s.id)?.delta.gmv ?? 0));
  const present = todayShifts.filter((a) => data.attendance[a.id]?.clockIn != null).length;
  const queue = data.reports.filter((r) => r.status === "submitted" && (r.review === "flagged" || r.review === "correction"));
  const missing = data.sessions
    .filter((s) => sessionStatus(s, lookup.report(s.id), now) === "missing")
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  // Slot kosong = jam operasional hari ini yang belum ada sesi live, per platform aktif.
  const emptySlots = data.platforms
    .filter((p) => p.active)
    .map((p) => ({ p, gaps: coverageGaps(todaySessions.filter((s) => !s.cancelled && s.platformId === p.id)) }))
    .filter((x) => x.gaps.length);

  return (
    <>
      <PageHeader title="Operasional hari ini" subtitle={formatDateLong(now.date)} />

      <div className="mb-5">
        <LiveResult />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sesi live hari ini" value={todaySessions.filter((s) => !s.cancelled).length} />
        <Stat label="GMV hari ini" value={rupiahShort(gmvToday)} hint="Dari laporan yang sudah masuk" />
        <Stat label="Host sudah absen" value={`${present}/${todayShifts.length}`} />
        <Stat label="Antrean anomali" value={queue.length} tone={queue.length ? "red" : undefined} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Perlu perhatian" className="lg:col-span-1">
          <div className="space-y-3">
            {emptySlots.map(({ p, gaps }) => (
              <Alert key={p.id} tone="yellow">
                <b>{p.name}</b> belum ada sesi live {gaps.map((g) => `${g.start}–${g.end}`).join(", ")}.{" "}
                <Link href="/manager/jadwal" className="font-medium underline">
                  Atur
                </Link>
              </Alert>
            ))}
            {queue.length > 0 && (
              <Alert tone="red">
                {queue.length} laporan ditandai/perlu koreksi.{" "}
                <Link href="/manager/anomali" className="font-medium underline">
                  Tinjau
                </Link>
              </Alert>
            )}
            {missing.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">Sesi belum lapor ({missing.length})</p>
                <ul className="space-y-1 text-sm">
                  {missing.slice(0, 5).map((s) => (
                    <li key={s.id} className="flex justify-between gap-2 text-slate-600">
                      <span className="truncate">
                        {lookup.host(s.hostId)} · {lookup.brand(s.brandId)}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatDate(s.date)} {s.start}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!emptySlots.length && !queue.length && !missing.length && <Empty>Semua aman 👍</Empty>}
          </div>
        </Card>

        <Card title="Kehadiran host" className="lg:col-span-2" action={<Link href="/manager/absensi" className="text-sm text-indigo-600">Detail</Link>}>
          {todayShifts.length ? (
            <ul className="divide-y divide-slate-100">
              {todayShifts.map((a) => {
                const b = attendanceBadge(a, data.attendance[a.id], now);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="font-medium text-slate-900">{lookup.host(a.hostId)}</span>
                    <span className="flex-1 text-slate-500">
                      {lookup.shiftName(a)} · {a.start}–{a.end}
                    </span>
                    <Badge tone={b.tone}>{b.label}</Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>Belum ada shift hari ini.</Empty>
          )}
        </Card>
      </div>

      <Card title="Jadwal live hari ini" className="mt-5" action={<Link href="/manager/jadwal" className="text-sm text-indigo-600">Kelola jadwal</Link>}>
        {todaySessions.length ? (
          <div className="divide-y divide-slate-100">
            {todaySessions.map((s) => (
              <SessionRow key={s.id} s={s} showHost />
            ))}
          </div>
        ) : (
          <Empty>Belum ada sesi hari ini.</Empty>
        )}
      </Card>
    </>
  );
}
