"use client";

import { useState } from "react";
import { useLookup, useStore } from "@/lib/store";
import { attendanceBadge, workMinutes } from "@/lib/rules";
import { formatDateLong, formatDuration, toHHMM } from "@/lib/time";
import type { ShiftAssignment } from "@/lib/types";
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Stat, Table, Textarea, td } from "@/components/ui";

export default function ManagerAttendance() {
  const { data, now } = useStore();
  const lookup = useLookup();
  const [date, setDate] = useState(now.date);
  const [fix, setFix] = useState<ShiftAssignment | null>(null);

  const rows = data.assignments.filter((a) => a.date === date).sort((a, b) => a.start.localeCompare(b.start) || lookup.host(a.hostId).localeCompare(lookup.host(b.hostId)));
  const badges = rows.map((a) => attendanceBadge(a, data.attendance[a.id], now));
  const count = (label: (l: string) => boolean) => badges.filter((b) => label(b.label)).length;

  return (
    <>
      <PageHeader
        title="Absensi host"
        subtitle={formatDateLong(date)}
        actions={<Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-auto" />}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total shift" value={rows.length} />
        <Stat label="Tepat waktu" value={count((l) => l === "Tepat waktu")} />
        <Stat label="Terlambat" value={count((l) => l.startsWith("Terlambat"))} tone="yellow" />
        <Stat label="Tidak hadir / belum absen" value={count((l) => l === "Tidak hadir" || l.startsWith("Belum absen"))} tone="red" />
      </div>
      <Card>
        {rows.length ? (
          <Table head={["Host", "Shift", "Masuk", "Keluar", "Durasi", "Status", ""]}>
            {rows.map((a, i) => {
              const att = data.attendance[a.id];
              const dur = workMinutes(att);
              return (
                <tr key={a.id}>
                  <td className={`${td} font-medium text-slate-900`}>{lookup.host(a.hostId)}</td>
                  <td className={td}>
                    {lookup.shiftName(a)} <span className="text-slate-500">{a.start}–{a.end}</span>
                  </td>
                  <td className={td}>{att?.clockIn != null ? toHHMM(att.clockIn) : "–"}</td>
                  <td className={td}>{att?.clockOut != null ? toHHMM(att.clockOut) : "–"}</td>
                  <td className={td}>{dur != null ? formatDuration(dur) : "–"}</td>
                  <td className={td}>
                    <Badge tone={badges[i].tone}>{badges[i].label}</Badge>
                    {att?.corrected && att.lateMinutes > 0 && <span className="ml-1 text-xs text-slate-500">telat {att.lateMinutes} mnt</span>}
                  </td>
                  <td className={td}>
                    <Button size="sm" variant="ghost" onClick={() => setFix(a)}>
                      Koreksi
                    </Button>
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Empty>Tidak ada shift di tanggal ini.</Empty>
        )}
      </Card>
      {fix && <CorrectionModal key={fix.id} a={fix} onClose={() => setFix(null)} />}
    </>
  );
}

function CorrectionModal({ a, onClose }: { a: ShiftAssignment; onClose: () => void }) {
  const { data, correctAttendance, toast } = useStore();
  const lookup = useLookup();
  const att = data.attendance[a.id];
  const [clockIn, setIn] = useState(att?.clockIn != null ? toHHMM(att.clockIn) : a.start);
  const [clockOut, setOut] = useState(att?.clockOut != null ? toHHMM(att.clockOut) : a.end);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  return (
    <Modal
      open
      title={`Koreksi absensi · ${lookup.host(a.hostId)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => {
              const res = correctAttendance(a.id, clockIn, clockOut, reason);
              if (!res.ok) return setError(res.error);
              toast("Absensi dikoreksi & tercatat di audit log");
              onClose();
            }}
          >
            Simpan koreksi
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        {lookup.shiftName(a)} {a.start}–{a.end} · {formatDateLong(a.date)}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jam masuk">
          <Input value={clockIn} onChange={(e) => setIn(e.target.value)} placeholder="HH:MM" inputMode="numeric" />
        </Field>
        <Field label="Jam keluar">
          <Input value={clockOut} onChange={(e) => setOut(e.target.value)} placeholder="HH:MM" inputMode="numeric" />
        </Field>
      </div>
      <Field label="Alasan koreksi (wajib)">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: HP host mati, hadir sesuai CCTV studio" />
      </Field>
      {error && <Alert tone="red">{error}</Alert>}
      <p className="text-xs text-slate-500">Nilai sebelum & sesudah akan dicatat di audit log.</p>
    </Modal>
  );
}
