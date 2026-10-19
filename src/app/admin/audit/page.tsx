"use client";

import { useState } from "react";
import { useLookup, useStore } from "@/lib/store";
import { formatStamp } from "@/lib/time";
import { Card, Empty, Input, PageHeader, Select, Table, td } from "@/components/ui";

export default function AuditPage() {
  const { data } = useStore();
  const lookup = useLookup();
  const [q, setQ] = useState("");
  const [object, setObject] = useState("");

  const objects = [...new Set(data.audit.map((l) => l.object))].sort();
  const rows = data.audit.filter(
    (l) =>
      (!object || l.object === object) &&
      (!q || `${l.action} ${l.summary} ${lookup.user(l.actorId)} ${l.before ?? ""} ${l.after ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Jejak perubahan penting: siapa, kapan, apa, dan nilai sebelum/sesudah"
        actions={
          <>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari…" className="w-48" />
            <Select value={object} onChange={(e) => setObject(e.target.value)} className="w-auto">
              <option value="">Semua objek</option>
              {objects.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          </>
        }
      />
      <Card>
        {rows.length ? (
          <Table head={["Waktu", "Pelaku", "Aksi", "Objek", "Ringkasan", "Sebelum → Sesudah"]}>
            {rows.map((l) => (
              <tr key={l.id}>
                <td className={`${td} whitespace-nowrap text-slate-500`}>{formatStamp(l.at)}</td>
                <td className={td}>{lookup.user(l.actorId)}</td>
                <td className={`${td} font-medium text-slate-900`}>{l.action}</td>
                <td className={td}>{l.object}</td>
                <td className={`${td} max-w-xs whitespace-normal`}>{l.summary}</td>
                <td className={`${td} max-w-xs whitespace-normal text-xs text-slate-500`}>{l.before ? `${l.before} → ${l.after}` : "–"}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Tidak ada catatan.</Empty>
        )}
      </Card>
    </>
  );
}
