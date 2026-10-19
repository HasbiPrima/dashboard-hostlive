"use client";

import { useStore } from "@/lib/store";
import { Badge, Button, Card, PageHeader, PlatformBadge, Table, td } from "@/components/ui";

export default function PlatformsPage() {
  const { data, togglePlatform, toast } = useStore();
  return (
    <>
      <PageHeader title="Platform marketplace" subtitle="Satu sesi live memiliki satu platform utama" />
      <Card>
        <Table head={["Platform", "Jumlah sesi", "Status", ""]}>
          {data.platforms.map((p) => (
            <tr key={p.id}>
              <td className={td}>
                <PlatformBadge name={p.name} />
              </td>
              <td className={td}>{data.sessions.filter((s) => s.platformId === p.id && !s.cancelled).length}</td>
              <td className={td}>{p.active ? <Badge tone="green">Aktif</Badge> : <Badge>Nonaktif</Badge>}</td>
              <td className={td}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    togglePlatform(p.id);
                    toast(`${p.name} ${p.active ? "dinonaktifkan" : "diaktifkan"}`);
                  }}
                >
                  {p.active ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
        <p className="mt-4 text-xs text-slate-500">Platform nonaktif tidak bisa dipilih untuk sesi baru; data lama tetap tersimpan.</p>
      </Card>
    </>
  );
}
