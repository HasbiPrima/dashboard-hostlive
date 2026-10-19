"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useLookup, useStore } from "@/lib/store";
import type { Brand } from "@/lib/types";
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, PlatformBadge, Segmented, Select, Table, td } from "@/components/ui";

export default function BrandsPage() {
  const { data } = useStore();
  const lookup = useLookup();
  const [editing, setEditing] = useState<Brand | "new" | null>(null);
  const [platform, setPlatform] = useState("");

  const rows = data.brands
    .filter((b) => !platform || b.platformId === platform)
    .sort((a, b) => lookup.platform(b.platformId).localeCompare(lookup.platform(a.platformId)) || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Brand / klien"
        subtitle="Brand terdaftar per platform, mis. TikTok Shop: Bonju · Shopee: OT · Shopee: MAMEE"
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} /> Brand
          </Button>
        }
      />
      <div className="mb-4">
        <Segmented
          value={platform}
          onChange={setPlatform}
          options={[{ value: "", label: "Semua" }, ...data.platforms.map((p) => ({ value: p.id, label: p.name }))]}
        />
      </div>
      <Card>
        {rows.length ? (
          <Table head={["Platform", "Nama brand", "PIC", "Jumlah sesi", "Status", ""]}>
            {rows.map((b) => (
              <tr key={b.id}>
                <td className={td}>
                  <PlatformBadge name={lookup.platform(b.platformId)} />
                </td>
                <td className={`${td} font-medium text-slate-900`}>{b.name}</td>
                <td className={td}>{b.pic || "–"}</td>
                <td className={td}>{data.sessions.filter((s) => s.brandId === b.id && !s.cancelled).length}</td>
                <td className={td}>{b.active ? <Badge tone="green">Aktif</Badge> : <Badge>Nonaktif</Badge>}</td>
                <td className={td}>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
                    Ubah
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Belum ada brand di platform ini.</Empty>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Saat membuat sesi live, brand yang bisa dipilih hanya brand milik platform sesi itu. Brand yang sama di dua platform dibuat sebagai dua entri.
        </p>
      </Card>
      {editing && (
        <BrandModal
          key={editing === "new" ? "new" : editing.id}
          b={editing === "new" ? undefined : editing}
          defaultPlatform={platform}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function BrandModal({ b, defaultPlatform, onClose }: { b?: Brand; defaultPlatform: string; onClose: () => void }) {
  const { data, saveBrand, toast } = useStore();
  const [f, setF] = useState({ name: b?.name ?? "", pic: b?.pic ?? "", platformId: b?.platformId ?? defaultPlatform, active: b?.active ?? true });
  const [error, setError] = useState("");
  const used = b ? data.sessions.some((s) => s.brandId === b.id) : false;
  return (
    <Modal
      open
      title={b ? "Ubah brand" : "Brand baru"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => {
              const res = saveBrand({ ...f, id: b?.id });
              if (!res.ok) return setError(res.error);
              toast("Brand disimpan");
              onClose();
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <Field label="Platform" hint={used ? "Brand sudah dipakai di sesi live, platform tidak bisa diganti" : undefined}>
        <Select value={f.platformId} disabled={used} onChange={(e) => setF({ ...f, platformId: e.target.value })}>
          <option value="">Pilih platform</option>
          {data.platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nama brand">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Contoh: Bonju" />
      </Field>
      <Field label="PIC / kontak">
        <Input value={f.pic} onChange={(e) => setF({ ...f, pic: e.target.value })} />
      </Field>
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
