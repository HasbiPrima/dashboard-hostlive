"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useLookup, useStore } from "@/lib/store";
import type { Role, User } from "@/lib/types";
import { ROLE_LABEL } from "@/components/AppShell";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, td } from "@/components/ui";

export default function UsersPage() {
  const { data, user: me } = useStore();
  const lookup = useLookup();
  const [editing, setEditing] = useState<User | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Pengguna & role"
        subtitle="Kelola akun Admin, Manager, dan Host"
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} /> Pengguna
          </Button>
        }
      />
      <Card>
        <Table head={["Nama", "Email", "Role", "Profil host", "Status", ""]}>
          {data.users.map((u) => (
            <tr key={u.id}>
              <td className={`${td} font-medium text-slate-900`}>
                {u.name} {u.id === me?.id && <span className="text-xs text-slate-400">(Anda)</span>}
              </td>
              <td className={td}>{u.email}</td>
              <td className={td}>
                <Badge tone="indigo">{ROLE_LABEL[u.role]}</Badge>
              </td>
              <td className={td}>{u.hostId ? lookup.host(u.hostId) : "–"}</td>
              <td className={td}>{u.active ? <Badge tone="green">Aktif</Badge> : <Badge>Nonaktif</Badge>}</td>
              <td className={td}>
                <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                  Ubah
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      {editing && <UserModal key={editing === "new" ? "new" : editing.id} u={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function UserModal({ u, onClose }: { u?: User; onClose: () => void }) {
  const { data, user: me, saveUser, toast } = useStore();
  const [f, setF] = useState({ name: u?.name ?? "", email: u?.email ?? "", role: u?.role ?? ("host" as Role), hostId: u?.hostId ?? "", active: u?.active ?? true });
  const [error, setError] = useState("");
  const self = u?.id === me?.id;

  return (
    <Modal
      open
      title={u ? "Ubah pengguna" : "Pengguna baru"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => {
              const res = saveUser({ ...f, id: u?.id, hostId: f.hostId || undefined });
              if (!res.ok) return setError(res.error);
              toast("Pengguna disimpan");
              onClose();
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <Field label="Nama">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Email">
        <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <Select value={f.role} disabled={self} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={f.active ? "1" : "0"} disabled={self} onChange={(e) => setF({ ...f, active: e.target.value === "1" })}>
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </Select>
        </Field>
      </div>
      {f.role === "host" && (
        <Field label="Profil host">
          <Select value={f.hostId} onChange={(e) => setF({ ...f, hostId: e.target.value })}>
            <option value="">Pilih profil host</option>
            {data.hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {self && <p className="text-xs text-slate-500">Anda tidak bisa mengubah role/status akun sendiri.</p>}
      {error && <Alert tone="red">{error}</Alert>}
    </Modal>
  );
}
