"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatDuration, toMin } from "@/lib/time";
import type { ShiftTemplate } from "@/lib/types";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, td } from "@/components/ui";

export default function ShiftTemplatesPage() {
  const { data } = useStore();
  const [editing, setEditing] = useState<ShiftTemplate | "new" | null>(null);
  return (
    <>
      <PageHeader
        title="Template shift"
        subtitle="Pola shift dalam jam operasional 08:00–24:00 WIB"
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} /> Template
          </Button>
        }
      />
      <Card>
        <Table head={["Nama", "Jam", "Durasi", "Status", ""]}>
          {[...data.templates]
            .sort((a, b) => a.start.localeCompare(b.start))
            .map((t) => (
              <tr key={t.id}>
                <td className={`${td} font-medium text-slate-900`}>{t.name}</td>
                <td className={td}>
                  {t.start}–{t.end} WIB
                </td>
                <td className={td}>{formatDuration(toMin(t.end) - toMin(t.start))}</td>
                <td className={td}>{t.active ? <Badge tone="green">Aktif</Badge> : <Badge>Nonaktif</Badge>}</td>
                <td className={td}>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                    Ubah
                  </Button>
                </td>
              </tr>
            ))}
        </Table>
        <p className="mt-4 text-xs text-slate-500">
          Mengubah template tidak mengubah penugasan yang sudah dibuat — jam shift disalin saat penugasan dibuat agar riwayat tetap utuh.
        </p>
      </Card>
      {editing && <TemplateModal key={editing === "new" ? "new" : editing.id} t={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function TemplateModal({ t, onClose }: { t?: ShiftTemplate; onClose: () => void }) {
  const { saveTemplate, toast } = useStore();
  const [f, setF] = useState({ name: t?.name ?? "", start: t?.start ?? "", end: t?.end ?? "", active: t?.active ?? true });
  const [error, setError] = useState("");
  return (
    <Modal
      open
      title={t ? "Ubah template shift" : "Template shift baru"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => {
              const res = saveTemplate({ ...f, id: t?.id });
              if (!res.ok) return setError(res.error);
              toast("Template disimpan");
              onClose();
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <Field label="Nama shift">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Contoh: Sore" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mulai (WIB)" hint="Paling awal 08:00">
          <Input value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} placeholder="16:00" inputMode="numeric" />
        </Field>
        <Field label="Selesai (WIB)" hint="Paling lambat 24:00">
          <Input value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} placeholder="20:00" inputMode="numeric" />
        </Field>
      </div>
      <Field label="Status">
        <Select value={f.active ? "1" : "0"} onChange={(e) => setF({ ...f, active: e.target.value === "1" })}>
          <option value="1">Aktif</option>
          <option value="0">Nonaktif</option>
        </Select>
      </Field>
      {error && <Alert tone="red">{error}</Alert>}
    </Modal>
  );
}
