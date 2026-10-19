"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Host } from "@/lib/types";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, td } from "@/components/ui";

export default function HostsPage() {
  const { data } = useStore();
  const [editing, setEditing] = useState<Host | "new" | null>(null);
  return (
    <>
      <PageHeader
        title="Host"
        subtitle="Profil operasional host live"
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} /> Host
          </Button>
        }
      />
      <Card>
        <Table head={["Nama", "No. HP", "Studio", "Akun login", "Status", ""]}>
          {data.hosts.map((h) => (
            <tr key={h.id}>
              <td className={`${td} font-medium text-slate-900`}>{h.name}</td>
              <td className={td}>{h.phone}</td>
              <td className={td}>{h.studio}</td>
              <td className={td}>{data.users.find((u) => u.hostId === h.id)?.email ?? <span className="text-amber-600">Belum ada</span>}</td>
              <td className={td}>{h.active ? <Badge tone="green">Aktif</Badge> : <Badge>Nonaktif</Badge>}</td>
              <td className={td}>
                <Button size="sm" variant="ghost" onClick={() => setEditing(h)}>
                  Ubah
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      {editing && <HostModal key={editing === "new" ? "new" : editing.id} h={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function HostModal({ h, onClose }: { h?: Host; onClose: () => void }) {
  const { saveHost, toast } = useStore();
  const [f, setF] = useState({ name: h?.name ?? "", phone: h?.phone ?? "", studio: h?.studio ?? "Studio 1", active: h?.active ?? true });
  const [error, setError] = useState("");
  return (
    <Modal
      open
      title={h ? "Ubah host" : "Host baru"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => {
              const res = saveHost({ ...f, id: h?.id });
              if (!res.ok) return setError(res.error);
              toast("Host disimpan");
              onClose();
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <Field label="Nama lengkap">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="No. HP">
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" />
        </Field>
        <Field label="Studio">
          <Input value={f.studio} onChange={(e) => setF({ ...f, studio: e.target.value })} />
        </Field>
      </div>
      <Field label="Status">
        <Select value={f.active ? "1" : "0"} onChange={(e) => setF({ ...f, active: e.target.value === "1" })}>
          <option value="1">Aktif</option>
          <option value="0">Nonaktif</option>
        </Select>
      </Field>
      {!h && <p className="text-xs text-slate-500">Buat akun login untuk host ini di menu Pengguna.</p>}
      {error && <Alert tone="red">{error}</Alert>}
    </Modal>
  );
}
