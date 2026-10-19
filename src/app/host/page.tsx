"use client";

import Link from "next/link";
import { useLookup, useStore } from "@/lib/store";
import { formatDateLong, monthStart } from "@/lib/time";
import { avg, percent, rupiahShort, sum } from "@/lib/format";
import { AttendanceCard, ToReportList, useMine } from "@/components/shared";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { LiveResult } from "@/components/LiveResult";

export default function HostHome() {
  const { user, now } = useStore();
  const lookup = useLookup();
  const { hostId, assignments, sessions } = useMine();
  const todayShifts = assignments.filter((a) => a.date === now.date).sort((a, b) => a.start.localeCompare(b.start));

  const month = sessions
    .filter((s) => s.date >= monthStart(now.date) && s.date <= now.date)
    .map((s) => lookup.result(s.id))
    .filter((x) => x != null);

  return (
    <>
      <PageHeader title={`Halo, ${user!.name.split(" ")[0]} 👋`} subtitle={formatDateLong(now.date)} />

      <div className="mb-5">
        <LiveResult highlightHostId={hostId} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Shift hari ini" action={<Link href="/host/absen" className="text-sm text-indigo-600">Riwayat absen</Link>}>
          {todayShifts.length ? (
            <div className="space-y-3">
              {todayShifts.map((a) => (
                <AttendanceCard key={a.id} a={a} />
              ))}
            </div>
          ) : (
            <Empty>Tidak ada shift hari ini.</Empty>
          )}
        </Card>

        <Card title="Perlu dilaporkan" action={<Link href="/host/laporan" className="text-sm text-indigo-600">Semua laporan</Link>}>
          <ToReportList limit={4} />
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-semibold text-slate-900">Performa bulan ini</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total GMV (hasil shift)" value={rupiahShort(sum(month.map((x) => x.delta.gmv)))} />
        <Stat label="Sesi dilaporkan" value={month.length} />
        <Stat label="Rata-rata CTR" value={percent(avg(month.map((x) => x.cum.ctr)))} />
        <Stat label="Rata-rata CTOR" value={percent(avg(month.map((x) => x.cum.ctor)))} />
      </div>
    </>
  );
}
