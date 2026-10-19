"use client";

import Link from "next/link";
import { useState } from "react";
import { useLookup } from "@/lib/store";
import { latestData, REVIEW_LABEL } from "@/lib/rules";
import { formatDate } from "@/lib/time";
import { percent, signedRupiah } from "@/lib/format";
import { ToReportList, useMine, useToReport } from "@/components/shared";
import { Badge, Card, Empty, PageHeader, PlatformBadge, Segmented, Table, td } from "@/components/ui";

export default function HostReports() {
  const lookup = useLookup();
  const { sessions } = useMine();
  const pending = useToReport();
  const [tab, setTab] = useState<"todo" | "history">("todo");

  const history = sessions
    .map((s) => ({ s, r: lookup.report(s.id) }))
    .filter(({ r }) => r?.status === "submitted")
    .sort((a, b) => (b.s.date + b.s.start).localeCompare(a.s.date + a.s.start));

  return (
    <>
      <PageHeader
        title="Laporan sesi"
        subtitle="Isi laporan maksimal 1 jam setelah sesi selesai"
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "todo", label: `Perlu dilaporkan (${pending.length})` },
              { value: "history", label: "Riwayat" },
            ]}
          />
        }
      />
      {tab === "todo" ? (
        <Card>
          <ToReportList />
        </Card>
      ) : (
        <Card>
          {history.length ? (
            <Table head={["Tanggal", "Sesi", "Brand", "Platform", "Selisih GMV", "CTR", "Status", ""]}>
              {history.map(({ s, r }) => {
                const d = latestData(r)!;
                const st = REVIEW_LABEL[r!.review];
                return (
                  <tr key={s.id}>
                    <td className={td}>{formatDate(s.date)}</td>
                    <td className={td}>
                      {s.start}–{s.end}
                    </td>
                    <td className={td}>{lookup.brand(s.brandId)}</td>
                    <td className={td}>
                      <PlatformBadge name={lookup.platform(s.platformId)} />
                    </td>
                    <td className={`${td} font-medium`}>{signedRupiah(lookup.result(s.id)?.delta.gmv ?? 0)}</td>
                    <td className={td}>{percent(d.ctr)}</td>
                    <td className={td}>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {r!.versions.length > 1 && <span className="ml-2 text-xs text-slate-500">v{r!.versions.length}</span>}
                    </td>
                    <td className={td}>
                      <Link href={`/host/laporan/${s.id}`} className="text-sm font-medium text-indigo-600">
                        Lihat
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <Empty>Belum ada laporan terkirim.</Empty>
          )}
        </Card>
      )}
    </>
  );
}
