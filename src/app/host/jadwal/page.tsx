"use client";

import { useEffect, useState } from "react";
import { useLookup, useScheduleUpdates, useStore } from "@/lib/store";
import { addDays, formatDateLong, formatStamp } from "@/lib/time";
import { SessionRow, useMine } from "@/components/shared";
import { Alert, Badge, Card, Empty, PageHeader, Segmented } from "@/components/ui";

export default function HostSchedule() {
  const { now, scheduleSeenAt, markScheduleSeen } = useStore();
  const lookup = useLookup();
  const { assignments, sessions } = useMine();
  const { updates, unseen } = useScheduleUpdates();
  const [view, setView] = useState<"next" | "past">("next");
  // Simpan batas "sudah dilihat" saat halaman dibuka, agar label "Baru" tetap tampil selama kunjungan ini.
  const [seenBefore] = useState(scheduleSeenAt);

  useEffect(() => {
    if (unseen > 0) markScheduleSeen();
  }, [unseen, markScheduleSeen]);

  const days = view === "next" ? [0, 1, 2, 3, 4, 5, 6].map((d) => addDays(now.date, d)) : [1, 2, 3, 4, 5, 6, 7].map((d) => addDays(now.date, -d));
  const withWork = days.filter((d) => assignments.some((a) => a.date === d));

  return (
    <>
      <PageHeader
        title="Jadwal saya"
        subtitle="Jadwal diatur Admin/Manager dan otomatis ter-update di sini"
        actions={
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "next", label: "7 hari ke depan" },
              { value: "past", label: "7 hari terakhir" },
            ]}
          />
        }
      />

      {updates.length > 0 && (
        <Card title="Update jadwal" className="mb-4">
          <ul className="divide-y divide-slate-100">
            {updates.slice(0, 6).map((l) => (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {l.action} {l.at > seenBefore && <Badge tone="red">Baru</Badge>}
                  </p>
                  <p className="text-slate-600">{l.summary}</p>
                  {l.before && (
                    <p className="text-xs text-slate-500">
                      Sebelumnya: {l.before} → Sekarang: {l.after}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {lookup.user(l.actorId)} · {formatStamp(l.at)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="space-y-4">
        {withWork.length === 0 && <Empty>Belum ada jadwal pada rentang ini.</Empty>}
        {withWork.map((date) => (
          <Card key={date} title={date === now.date ? `Hari ini · ${formatDateLong(date)}` : formatDateLong(date)}>
            {assignments
              .filter((a) => a.date === date)
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((a) => (
                <div key={a.id} className="mb-2 last:mb-0">
                  <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800">
                    {lookup.shiftName(a)} · {a.start}–{a.end} WIB
                  </p>
                  <div className="divide-y divide-slate-100 px-1">
                    {sessions
                      .filter((s) => s.assignmentId === a.id)
                      .sort((x, y) => x.start.localeCompare(y.start))
                      .map((s) => (
                        <SessionRow key={s.id} s={s} />
                      ))}
                  </div>
                </div>
              ))}
          </Card>
        ))}
      </div>
      <div className="mt-4">
        <Alert tone="blue">Jadwal hanya bisa diubah oleh Admin atau Manager. Hubungi manager bila perlu tukar shift.</Alert>
      </div>
    </>
  );
}
