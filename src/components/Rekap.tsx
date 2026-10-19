"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useLookup, useStore } from "@/lib/store";
import { type Delta, latestData, REVIEW_LABEL, sessionStatus } from "@/lib/rules";
import { dayName, formatDate, monthStart } from "@/lib/time";
import { num, percent, rupiahShort, seconds, signedNum, signedRupiah, sum } from "@/lib/format";
import { exportCsv, exportExcel, type ExportColumn } from "@/lib/export";
import type { LiveReport, LiveSession, ReportData } from "@/lib/types";
import { Badge, Button, Card, Empty, Field, Input, PageHeader, PlatformBadge, Select, Stat, Table, td } from "./ui";

// d = angka kumulatif yang diisi host; delta = hasil shift (selisih dengan shift sebelumnya).
type Row = { s: LiveSession; r: LiveReport; d: ReportData; delta: Delta };

export function Rekap() {
  const { data, now, toast } = useStore();
  const lookup = useLookup();
  const [f, setF] = useState({ from: monthStart(now.date), to: now.date, platform: "", host: "", brand: "", review: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const { rows, missing } = useMemo(() => {
    const inFilter = (s: LiveSession) =>
      s.date >= f.from &&
      s.date <= f.to &&
      (!f.platform || s.platformId === f.platform) &&
      (!f.host || s.hostId === f.host) &&
      (!f.brand || s.brandId === f.brand);
    const sessions = data.sessions.filter(inFilter);
    const rows: Row[] = [];
    for (const s of sessions) {
      const r = lookup.report(s.id);
      // Rekap memakai versi laporan resmi terkini; laporan ditandai tetap ikut dihitung.
      if (r?.status === "submitted" && (!f.review || r.review === f.review)) rows.push({ s, r, d: latestData(r)!, delta: lookup.result(s.id)!.delta });
    }
    rows.sort((a, b) => (b.s.date + b.s.start).localeCompare(a.s.date + a.s.start));
    const missing = sessions.filter((s) => sessionStatus(s, lookup.report(s.id), now) === "missing").length;
    return { rows, missing };
  }, [data, f, lookup, now]);

  const cols: ExportColumn<Row>[] = [
    { label: "Hari", value: (x) => dayName(x.s.date) },
    { label: "Tanggal", value: (x) => x.s.date },
    { label: "Waktu Mulai", value: (x) => x.d.actualStart },
    { label: "Waktu Selesai", value: (x) => x.d.actualEnd },
    { label: "Brand", value: (x) => lookup.brand(x.s.brandId) },
    { label: "Nama Host", value: (x) => lookup.host(x.s.hostId) },
    { label: "Platform", value: (x) => lookup.platform(x.s.platformId) },
    { label: "Selisih GMV (Rp)", value: (x) => x.delta.gmv, numFmt: "#,##0" },
    { label: "Selisih Checkout", value: (x) => x.delta.checkout, numFmt: "#,##0" },
    { label: "Selisih Views", value: (x) => x.delta.views, numFmt: "#,##0" },
    { label: "GMV Kumulatif (Rp)", value: (x) => x.d.gmv, numFmt: "#,##0" },
    { label: "Checkout Kumulatif", value: (x) => x.d.checkout, numFmt: "#,##0" },
    { label: "Views Kumulatif", value: (x) => x.d.views, numFmt: "#,##0" },
    { label: "CTR (%)", value: (x) => x.d.ctr, numFmt: "0.00" },
    { label: "CTOR (%)", value: (x) => x.d.ctor, numFmt: "0.00" },
    { label: "Rata-rata Durasi Tonton (detik)", value: (x) => x.d.avgWatchSec },
    { label: "Catatan", value: (x) => x.d.notes },
    { label: "Status Review", value: (x) => REVIEW_LABEL[x.r.review].label },
    { label: "Versi", value: (x) => x.r.versions.length },
  ];
  const filename = `rekap-live_${f.from}_sd_${f.to}`;
  const flagged = rows.filter((x) => x.r.review === "flagged" || x.r.review === "correction").length;

  return (
    <>
      <PageHeader
        title="Rekap performa"
        subtitle="GMV, checkout, dan views dihitung dari selisih angka kumulatif per shift. Laporan ditandai tetap dihitung."
        actions={
          <>
            <Button variant="secondary" disabled={!rows.length} onClick={() => exportCsv(rows, cols, filename)}>
              <Download size={16} /> CSV
            </Button>
            <Button
              variant="secondary"
              disabled={!rows.length}
              onClick={() => exportExcel(rows, cols, filename).catch(() => toast("Gagal membuat file Excel"))}
            >
              <Download size={16} /> Excel
            </Button>
          </>
        }
      />

      <Card className="mb-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Field label="Dari">
            <Input type="date" value={f.from} onChange={set("from")} />
          </Field>
          <Field label="Sampai">
            <Input type="date" value={f.to} onChange={set("to")} />
          </Field>
          <Field label="Platform">
            <Select value={f.platform} onChange={set("platform")}>
              <option value="">Semua</option>
              {data.platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Host">
            <Select value={f.host} onChange={set("host")}>
              <option value="">Semua</option>
              {data.hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Brand">
            <Select value={f.brand} onChange={set("brand")}>
              <option value="">Semua</option>
              {data.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status review">
            <Select value={f.review} onChange={set("review")}>
              <option value="">Semua</option>
              {Object.entries(REVIEW_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Sesi dilaporkan" value={num(rows.length)} />
        <Stat label="Total GMV" value={rupiahShort(sum(rows.map((x) => x.delta.gmv)))} />
        <Stat label="Total checkout" value={num(sum(rows.map((x) => x.delta.checkout)))} />
        <Stat label="Total views" value={num(sum(rows.map((x) => x.delta.views)))} />
        <Stat label="Ditandai" value={flagged} tone={flagged ? "red" : undefined} />
        <Stat label="Sesi belum lapor" value={missing} tone={missing ? "yellow" : undefined} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {data.platforms.map((p) => {
          const xs = rows.filter((x) => x.s.platformId === p.id);
          return (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <PlatformBadge name={p.name} />
                <span className="text-xs text-slate-500">{num(xs.length)} sesi dilaporkan</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{rupiahShort(sum(xs.map((x) => x.delta.gmv)))}</p>
              <p className="text-sm text-slate-600">
                {num(sum(xs.map((x) => x.delta.checkout)))} checkout · {num(sum(xs.map((x) => x.delta.views)))} views
              </p>
            </div>
          );
        })}
      </div>

      <Card>
        {rows.length ? (
          <Table head={["Tanggal", "Waktu", "Host", "Brand", "Platform", "Selisih GMV", "Selisih checkout", "Selisih views", "CTR", "CTOR", "Durasi tonton", "Status"]}>
            {rows.map(({ s, r, d, delta }) => {
              const st = REVIEW_LABEL[r.review];
              return (
                <tr key={s.id}>
                  <td className={td}>{formatDate(s.date)}</td>
                  <td className={td}>
                    {d.actualStart}–{d.actualEnd}
                  </td>
                  <td className={td}>{lookup.host(s.hostId)}</td>
                  <td className={td}>{lookup.brand(s.brandId)}</td>
                  <td className={td}>
                    <PlatformBadge name={lookup.platform(s.platformId)} />
                  </td>
                  <td className={`${td} font-medium ${delta.gmv < 0 ? "text-red-600" : ""}`} title={`Kumulatif ${num(d.gmv)}`}>
                    {signedRupiah(delta.gmv)}
                  </td>
                  <td className={td}>{signedNum(delta.checkout)}</td>
                  <td className={td}>{signedNum(delta.views)}</td>
                  <td className={td}>{percent(d.ctr)}</td>
                  <td className={td}>{percent(d.ctor)}</td>
                  <td className={td}>{seconds(d.avgWatchSec)}</td>
                  <td className={td}>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Empty>Tidak ada laporan sesuai filter.</Empty>
        )}
      </Card>
    </>
  );
}
