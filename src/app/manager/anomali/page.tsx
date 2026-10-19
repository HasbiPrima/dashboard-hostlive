"use client";

import { useState } from "react";
import { useLookup, useStore } from "@/lib/store";
import { latestData, REVIEW_LABEL } from "@/lib/rules";
import { formatDate } from "@/lib/time";
import { signedRupiah } from "@/lib/format";
import type { LiveReport } from "@/lib/types";
import { Metrics, NotesAndVersions, ReviewStatus, SessionDelta, SessionInfo } from "@/components/report";
import { Alert, Badge, Button, Card, cx, Empty, PageHeader, Segmented, Textarea } from "@/components/ui";

export default function AnomalyQueue() {
  const { data } = useStore();
  const lookup = useLookup();
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessionOf = (r: LiveReport) => data.sessions.find((s) => s.id === r.sessionId)!;
  const list = data.reports
    .filter((r) => r.status === "submitted" && (tab === "open" ? r.review === "flagged" || r.review === "correction" : r.review === "resolved"))
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  const selected = list.find((r) => r.id === selectedId) ?? list[0];

  return (
    <>
      <PageHeader
        title="Antrean anomali"
        subtitle="Laporan yang ditandai tetap masuk rekap. Tinjau, beri catatan, minta koreksi, atau selesaikan."
        actions={
          <Segmented
            value={tab}
            onChange={(v) => {
              setTab(v);
              setSelectedId(null);
            }}
            options={[
              { value: "open", label: "Perlu ditinjau" },
              { value: "resolved", label: "Selesai" },
            ]}
          />
        }
      />
      {list.length === 0 ? (
        <Empty>{tab === "open" ? "Tidak ada laporan yang perlu ditinjau 🎉" : "Belum ada flag yang diselesaikan."}</Empty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <ul className="space-y-2">
            {list.map((r) => {
              const s = sessionOf(r);
              const st = REVIEW_LABEL[r.review];
              return (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={cx(
                      "w-full rounded-xl border bg-white p-3 text-left",
                      selected?.id === r.id ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200 hover:border-slate-300",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">{lookup.host(s.hostId)}</span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {lookup.brand(s.brandId)} · {formatDate(s.date)} {s.start}
                    </p>
                    <p className="mt-1 truncate text-xs text-red-600">{r.flags[0]}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{signedRupiah(lookup.result(s.id)?.delta.gmv ?? 0)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
          {selected && <Detail key={selected.id} r={selected} />}
        </div>
      )}
    </>
  );
}

function Detail({ r }: { r: LiveReport }) {
  const { data, reviewReport, toast } = useStore();
  const s = data.sessions.find((x) => x.id === r.sessionId)!;
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const act = (action: "note" | "correction" | "resolve", msg: string) => {
    const res = reviewReport(r.id, action, text);
    if (!res.ok) return setError(res.error);
    setText("");
    setError("");
    toast(msg);
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="space-y-4">
          <SessionInfo s={s} />
          <ReviewStatus r={r} />
          <SessionDelta sessionId={s.id} />
          <Metrics d={latestData(r)!} />
        </div>
      </Card>
      {r.review !== "resolved" && (
        <Card title="Tindak lanjut">
          <div className="space-y-3">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis catatan untuk host / hasil pengecekan…" />
            {error && <Alert tone="red">{error}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => act("note", "Catatan ditambahkan")}>
                Tambah catatan
              </Button>
              <Button variant="secondary" onClick={() => act("correction", "Host diminta mengoreksi laporan")}>
                Minta koreksi
              </Button>
              <Button onClick={() => act("resolve", "Flag diselesaikan")}>Selesaikan</Button>
            </div>
            <p className="text-xs text-slate-500">“Minta koreksi” wajib disertai catatan. Semua tindakan tercatat di audit log.</p>
          </div>
        </Card>
      )}
      <Card>
        <NotesAndVersions r={r} />
      </Card>
    </div>
  );
}
