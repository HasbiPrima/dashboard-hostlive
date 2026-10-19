"use client";

import { useLookup, useStore } from "@/lib/store";
import { attendanceBadge, workMinutes } from "@/lib/rules";
import { addDays, formatDate, formatDuration, formatDateLong, toHHMM } from "@/lib/time";
import { AttendanceCard, useMine } from "@/components/shared";
import { Alert, Badge, Card, Empty, PageHeader, Table, td } from "@/components/ui";

export default function HostAttendance() {
  const { data, now } = useStore();
  const lookup = useLookup();
  const { assignments } = useMine();
  const today = assignments.filter((a) => a.date === now.date).sort((a, b) => a.start.localeCompare(b.start));
  const history = assignments
    .filter((a) => a.date < now.date && a.date >= addDays(now.date, -14))
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));

  return (
    <>
      <PageHeader title="Absensi" subtitle={formatDateLong(now.date)} />
      <div className="space-y-5">
        <Alert tone="blue">
          Clock-in dibuka <b>30 menit sebelum</b> shift. Clock-in setelah jam mulai tetap bisa, tapi tercatat <b>terlambat</b>. Clock-out bisa kapan saja setelah
          clock-in.
        </Alert>

        {today.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {today.map((a) => (
              <AttendanceCard key={a.id} a={a} big />
            ))}
          </div>
        ) : (
          <Empty>Tidak ada shift hari ini.</Empty>
        )}

        <Card title="Riwayat 14 hari terakhir">
          {history.length ? (
            <Table head={["Tanggal", "Shift", "Masuk", "Keluar", "Durasi", "Status"]}>
              {history.map((a) => {
                const att = data.attendance[a.id];
                const b = attendanceBadge(a, att, now);
                const dur = workMinutes(att);
                return (
                  <tr key={a.id}>
                    <td className={td}>{formatDate(a.date)}</td>
                    <td className={td}>
                      {lookup.shiftName(a)} <span className="text-slate-500">{a.start}–{a.end}</span>
                    </td>
                    <td className={td}>{att?.clockIn != null ? toHHMM(att.clockIn) : "–"}</td>
                    <td className={td}>{att?.clockOut != null ? toHHMM(att.clockOut) : "–"}</td>
                    <td className={td}>{dur != null ? formatDuration(dur) : "–"}</td>
                    <td className={td}>
                      <Badge tone={b.tone}>{b.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <Empty>Belum ada riwayat.</Empty>
          )}
        </Card>
      </div>
    </>
  );
}
