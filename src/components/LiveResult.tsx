"use client";

import { useLookup, useStore } from "@/lib/store";
import { SESSION_LABEL, sessionStatus, type ShiftResult } from "@/lib/rules";
import { formatDateLong } from "@/lib/time";
import { num, rupiah, signedNum, signedRupiah, sum } from "@/lib/format";
import type { LiveSession } from "@/lib/types";
import { Badge, cx, PlatformBadge } from "./ui";

type Row = { s: LiveSession; res?: ShiftResult; shift: string; no: number; status: keyof typeof SESSION_LABEL };

const totals = (rows: Row[]) => {
  const done = rows.filter((x) => x.res);
  const t = (k: "gmv" | "checkout" | "views") => sum(done.map((x) => x.res!.delta[k]));
  return { gmv: t("gmv"), checkout: t("checkout"), views: t("views"), reported: done.length, count: rows.length };
};

/**
 * Hasil live hari ini, dipisah per platform. Host mengisi angka kumulatif; tiap baris menampilkan selisih
 * dengan shift sebelumnya di platform yang sama (= hasil shift itu). Total = jumlah selisih.
 * Bila dilihat host (highlightHostId diisi), rincian host lain disembunyikan sesuai PRD bagian 6.
 */
export function LiveResult({ highlightHostId }: { highlightHostId?: string }) {
  const { data, now } = useStore();
  const lookup = useLookup();

  // Nomor shift = urutan jam mulai sesi hari ini (Shift 1 = paling pagi).
  const starts = [...new Set(data.sessions.filter((s) => s.date === now.date && !s.cancelled).map((s) => s.start))].sort();
  const rows: Row[] = data.sessions
    .filter((s) => s.date === now.date && !s.cancelled)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => {
      const assignment = data.assignments.find((a) => a.id === s.assignmentId);
      return {
        s,
        res: lookup.result(s.id),
        shift: assignment ? lookup.shiftName(assignment).replace(/^Shift ?/, "") : "",
        no: starts.indexOf(s.start) + 1,
        status: sessionStatus(s, lookup.report(s.id), now),
      };
    });
  if (!rows.length) return null;

  const platformIds = [...new Set(rows.map((x) => x.s.platformId))].sort((a, b) => lookup.platform(b).localeCompare(lookup.platform(a)));
  const groups = platformIds.map((id) => ({ id, rows: rows.filter((x) => x.s.platformId === id) }));
  const all = totals(rows);
  const brands = [...new Set(rows.map((x) => x.s.brandId))];

  return (
    <section className="overflow-hidden rounded-xl border border-indigo-200 bg-white">
      <div className="bg-indigo-600 px-4 py-4 text-white sm:px-5">
        <p className="text-sm font-medium text-indigo-100">Hasil live hari ini {groups.length > 1 && "· semua platform"}</p>
        <p className="text-xs text-indigo-200">
          {formatDateLong(now.date)}
          {brands.length === 1 && ` · ${lookup.brand(brands[0])}`}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Big label="Total GMV" value={rupiah(all.gmv)} className="col-span-3 sm:col-span-1" />
          <Big label="Total checkout" value={num(all.checkout)} className="col-span-3 min-[400px]:col-span-1 sm:col-span-1" />
          <Big label="Total views" value={num(all.views)} className="col-span-3 min-[400px]:col-span-2 sm:col-span-1" />
        </div>
        <p className="mt-3 text-xs text-indigo-100">
          {all.reported} dari {all.count} laporan masuk
        </p>
      </div>

      {groups.length > 1 && (
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 sm:px-5">
          {groups.map((g) => {
            const t = totals(g.rows);
            return (
              <div key={g.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <PlatformBadge name={lookup.platform(g.id)} />
                  <span className="text-xs text-slate-500">
                    {t.reported}/{t.count} shift lapor
                  </span>
                </div>
                <p className="mt-2 text-xl font-bold text-slate-900">{rupiah(t.gmv)}</p>
                <p className="text-sm text-slate-600">
                  {num(t.checkout)} checkout · {num(t.views)} views
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(t.reported / t.count) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {groups.map((g) => (
        <div key={g.id}>
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 sm:px-5">
            <PlatformBadge name={lookup.platform(g.id)} />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Rincian per shift</span>
          </div>
          <div className="hidden grid-cols-[1fr_repeat(3,8.5rem)] gap-3 border-b border-slate-100 px-5 py-2 text-xs font-medium uppercase tracking-wide text-slate-400 sm:grid">
            <span>Shift</span>
            <span className="text-right">Selisih GMV</span>
            <span className="text-right">Selisih checkout</span>
            <span className="text-right">Selisih views</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {g.rows.map((row) => (
              <ShiftRow
                key={row.s.id}
                row={row}
                rows={g.rows}
                me={row.s.hostId === highlightHostId}
                hidden={!!highlightHostId && row.s.hostId !== highlightHostId}
                showBrand={brands.length > 1}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function ShiftRow({ row, rows, me, hidden, showBrand }: { row: Row; rows: Row[]; me: boolean; hidden: boolean; showBrand: boolean }) {
  const lookup = useLookup();
  const { s, res, shift, no, status } = row;
  const neg = (n: number) => (n < 0 ? "text-red-600" : "text-slate-900");
  const noOf = (id: string) => rows.find((x) => x.s.id === id)?.no;
  return (
    <li className={cx("grid gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[1fr_repeat(3,8.5rem)] sm:items-center sm:px-5", me && "bg-indigo-50/60")}>
      <div className="min-w-0">
        <p className="font-medium text-slate-900">
          Shift {no}
          {shift && ` · ${shift}`}{" "}
          <span className="font-normal text-slate-500">
            {s.start}–{s.end}
          </span>
        </p>
        {!hidden && (
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            {lookup.host(s.hostId)}
            {me && <span className="text-indigo-600">(Anda)</span>}
            {showBrand && <span>· {lookup.brand(s.brandId)}</span>}
          </p>
        )}
        {res && !hidden && (
          <p className="text-xs text-slate-400">
            Kumulatif: {rupiah(res.cum.gmv)} · {num(res.cum.checkout)} CO · {num(res.cum.views)} views
            {res.skipped.length > 0 && <span className="text-amber-600"> · termasuk Shift {res.skipped.map(noOf).join(", ")} (belum lapor)</span>}
          </p>
        )}
      </div>
      {hidden ? (
        <div className="sm:col-span-3 sm:text-right">
          {res ? <Badge tone="green">Sudah lapor</Badge> : <Badge tone={SESSION_LABEL[status].tone}>{SESSION_LABEL[status].label}</Badge>}
        </div>
      ) : res ? (
        <>
          <Delta label="GMV" value={signedRupiah(res.delta.gmv)} className={neg(res.delta.gmv)} />
          <Delta label="Checkout" value={signedNum(res.delta.checkout)} className={neg(res.delta.checkout)} />
          <Delta label="Views" value={signedNum(res.delta.views)} className={neg(res.delta.views)} />
        </>
      ) : (
        <div className="sm:col-span-3 sm:text-right">
          <Badge tone={SESSION_LABEL[status].tone}>{SESSION_LABEL[status].label}</Badge>
        </div>
      )}
    </li>
  );
}

function Big({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-indigo-200">{label}</p>
      <p className="text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
    </div>
  );
}

function Delta({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <p className="flex justify-between gap-2 text-sm sm:block sm:text-right">
      <span className="text-xs text-slate-500 sm:hidden">Selisih {label}</span>
      <span className={cx("font-semibold", className)}>{value}</span>
    </p>
  );
}
