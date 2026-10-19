"use client";

import Link from "next/link";
import { useState } from "react";
import { useLookup, useStore } from "@/lib/store";
import { sessionStatus } from "@/lib/rules";
import { addDays, formatStamp } from "@/lib/time";
import { num, rupiah, rupiahShort, sum } from "@/lib/format";
import type { LiveSession } from "@/lib/types";
import { Card, Field, Input, PageHeader, PlatformBadge, Stat, Table, td } from "@/components/ui";
import { LiveResult } from "@/components/LiveResult";

export default function AdminHome() {
  const { data, now } = useStore();
  const lookup = useLookup();
  const [from, setFrom] = useState(addDays(now.date, -6));
  const [to, setTo] = useState(now.date);

  const sessions = data.sessions.filter((s) => !s.cancelled && s.date >= from && s.date <= to);
  const reported = sessions.map((s) => ({ s, r: lookup.report(s.id) })).filter((x) => x.r?.status === "submitted");
  // Hasil per shift = selisih angka kumulatif, agar tidak terhitung dobel.
  const total = (xs: typeof reported, k: "gmv" | "checkout" | "views") => sum(xs.map((x) => lookup.result(x.s.id)?.delta[k] ?? 0));
  const gmv = (xs: typeof reported) => total(xs, "gmv");
  const missing = sessions.filter((s) => sessionStatus(s, lookup.report(s.id), now) === "missing").length;
  const flagged = reported.filter((x) => x.r!.review === "flagged" || x.r!.review === "correction").length;

  const breakdown = (key: (s: LiveSession) => string, name: (id: string) => string) => {
    const groups = new Map<string, typeof reported>();
    reported.forEach((x) => groups.set(key(x.s), [...(groups.get(key(x.s)) ?? []), x]));
    return [...groups.entries()]
      .map(([id, xs]) => ({ id, name: name(id), count: xs.length, gmv: gmv(xs), checkout: total(xs, "checkout"), views: total(xs, "views") }))
      .sort((a, b) => b.gmv - a.gmv);
  };

  const perPlatform = breakdown((s) => s.platformId, lookup.platform);
  const tables = [
    { title: "Per brand", rows: breakdown((s) => s.brandId, lookup.brand) },
    { title: "Per host", rows: breakdown((s) => s.hostId, lookup.host) },
  ];

  return (
    <>
      <PageHeader
        title="Ringkasan operasional"
        subtitle="Gambaran umum seluruh sesi, laporan, dan konfigurasi"
        actions={
          <div className="flex gap-2">
            <Field label="Dari">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
            </Field>
            <Field label="Sampai">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
            </Field>
          </div>
        }
      />

      <div className="mb-5">
        <LiveResult />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total sesi" value={num(sessions.length)} />
        <Stat label="Total GMV" value={rupiahShort(gmv(reported))} />
        <Stat label="Sesi tanpa laporan" value={missing} tone={missing ? "yellow" : undefined} />
        <Stat label="Laporan ditandai" value={flagged} tone={flagged ? "red" : undefined} />
      </div>

      <Card title="Per platform" className="mt-5">
        <Table head={["Platform", "Sesi", "GMV", "Checkout", "Views"]}>
          {perPlatform.map((r) => (
            <tr key={r.id}>
              <td className={td}>
                <PlatformBadge name={r.name} />
              </td>
              <td className={td}>{r.count}</td>
              <td className={`${td} font-medium`}>{rupiah(r.gmv)}</td>
              <td className={td}>{num(r.checkout)}</td>
              <td className={td}>{num(r.views)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {tables.map((t) => (
          <Card key={t.title} title={t.title}>
            <Table head={["Nama", "Sesi", "GMV"]}>
              {t.rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{r.name}</td>
                  <td className={td}>{r.count}</td>
                  <td className={`${td} font-medium`}>{rupiah(r.gmv)}</td>
                </tr>
              ))}
            </Table>
          </Card>
        ))}
      </div>

      <Card title="Aktivitas terbaru" className="mt-5" action={<Link href="/admin/audit" className="text-sm text-indigo-600">Audit log</Link>}>
        <ul className="divide-y divide-slate-100 text-sm">
          {data.audit.slice(0, 6).map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <b className="font-medium text-slate-900">{l.action}</b> <span className="text-slate-600">— {l.summary}</span>
              </span>
              <span className="text-xs text-slate-400">
                {lookup.user(l.actorId)} · {formatStamp(l.at)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
