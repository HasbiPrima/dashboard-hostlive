"use client";

import { useLookup } from "@/lib/store";
import { REVIEW_LABEL } from "@/lib/rules";
import { dayName, formatDate, formatStamp } from "@/lib/time";
import { num, percent, rupiah, seconds, signedNum, signedRupiah } from "@/lib/format";
import type { Delta } from "@/lib/rules";
import type { LiveReport, LiveSession, ReportData } from "@/lib/types";
import { Alert, Badge, PlatformBadge } from "./ui";

export function SessionInfo({ s }: { s: LiveSession }) {
  const lookup = useLookup();
  const items: [string, React.ReactNode][] = [
    ["Hari", dayName(s.date)],
    ["Tanggal", formatDate(s.date)],
    ["Jadwal", `${s.start}–${s.end} WIB`],
    ["Brand", lookup.brand(s.brandId)],
    ["Host", lookup.host(s.hostId)],
    ["Platform", <PlatformBadge key="p" name={lookup.platform(s.platformId)} />],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-slate-500">{k}</dt>
          <dd className="font-medium text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Metrics({ d }: { d: ReportData }) {
  const items: [string, string][] = [
    ["Waktu aktual", `${d.actualStart}–${d.actualEnd}`],
    ["GMV (kumulatif)", rupiah(d.gmv)],
    ["CTR", percent(d.ctr)],
    ["CTOR", percent(d.ctor)],
    ["Views (kumulatif)", num(d.views)],
    ["Rata-rata durasi tonton", seconds(d.avgWatchSec)],
    ["Checkout (kumulatif)", num(d.checkout)],
  ];
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="font-semibold text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
      {d.notes && <p className="mt-3 text-sm text-slate-600">Catatan: {d.notes}</p>}
    </div>
  );
}

export function ReviewStatus({ r }: { r: LiveReport }) {
  const st = REVIEW_LABEL[r.review];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Status review:</span>
        <Badge tone={st.tone}>{st.label}</Badge>
        <span className="text-slate-500">· Masuk rekap ✓</span>
      </div>
      {r.flags.length > 0 && (
        <Alert tone={r.review === "resolved" ? "blue" : "red"}>
          <p className="font-medium">Alasan ditandai:</p>
          <ul className="ml-4 list-disc">
            {r.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}

export function NotesAndVersions({ r }: { r: LiveReport }) {
  const lookup = useLookup();
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Catatan manager</h3>
        {r.notes.length ? (
          <ul className="space-y-2">
            {r.notes.map((n, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="text-slate-800">{n.text}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {lookup.user(n.by)} · {formatStamp(n.at)} · {{ note: "Catatan", correction: "Minta koreksi", resolve: "Diselesaikan" }[n.action]}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Belum ada catatan.</p>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Riwayat versi</h3>
        <ol className="space-y-2">
          {[...r.versions].reverse().map((v, i) => (
            <li key={v.no} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-900">
                Versi {v.no} {i === 0 && <Badge tone="indigo">Aktif</Badge>}
              </p>
              <p className="text-xs text-slate-500">
                {lookup.user(v.by)} · {formatStamp(v.at)}
              </p>
              <p className="mt-1 text-slate-700">
                Kumulatif: GMV {rupiah(v.data.gmv)} · Checkout {num(v.data.checkout)} · Views {num(v.data.views)}
              </p>
              {v.reason && <p className="mt-1 text-xs text-slate-600">Alasan: {v.reason}</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Hasil shift = angka kumulatif dikurangi laporan shift sebelumnya di room live yang sama. */
export function DeltaBox({ delta, prevLabel }: { delta: Delta; prevLabel?: string }) {
  const items: [string, string, number][] = [
    ["Selisih GMV", signedRupiah(delta.gmv), delta.gmv],
    ["Selisih checkout", signedNum(delta.checkout), delta.checkout],
    ["Selisih views", signedNum(delta.views), delta.views],
  ];
  return (
    <div className="rounded-xl bg-indigo-50 p-3">
      <p className="mb-2 text-xs font-medium text-indigo-900">
        Hasil shift ini {prevLabel ? `(dibanding ${prevLabel})` : "(shift pertama di room ini)"}
      </p>
      <dl className="grid grid-cols-3 gap-2">
        {items.map(([k, v, n]) => (
          <div key={k}>
            <dt className="text-xs text-indigo-700">{k}</dt>
            <dd className={`font-bold ${n < 0 ? "text-red-600" : "text-indigo-950"}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** DeltaBox untuk sesi yang sudah lapor. */
export function SessionDelta({ sessionId }: { sessionId: string }) {
  const lookup = useLookup();
  const res = lookup.result(sessionId);
  if (!res) return null;
  const prev = res.prevSessionId;
  return <DeltaBox delta={res.delta} prevLabel={prev ? `laporan ${lookup.host(lookup.sessionHost(prev))}` : undefined} />;
}
