"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLookup, useStore } from "@/lib/store";
import { deadlineOf, diff, emptyForm, type FormErrors, latestData, pastDeadline, sessionEnded, toForm, validateReport } from "@/lib/rules";
import { toHHMM } from "@/lib/time";
import { num, rupiah } from "@/lib/format";
import type { LiveReport, LiveSession, ReportData, ReportForm } from "@/lib/types";
import { DeltaBox, Metrics, NotesAndVersions, ReviewStatus, SessionDelta, SessionInfo } from "@/components/report";
import { Alert, Button, Card, Empty, Field, Input, Modal, Textarea } from "@/components/ui";

export default function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { data, user } = useStore();
  const lookup = useLookup();
  const s = data.sessions.find((x) => x.id === sessionId);
  const r = s ? lookup.report(s.id) : undefined;
  const [editing, setEditing] = useState(false);

  const back = (
    <Link href="/host/laporan" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
      <ArrowLeft size={16} /> Kembali
    </Link>
  );

  // Host hanya boleh membuka sesi miliknya sendiri.
  if (!s || s.hostId !== user?.hostId)
    return (
      <>
        {back}
        <Empty>Sesi tidak ditemukan.</Empty>
      </>
    );

  const submitted = r?.status === "submitted";
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        {back}
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{submitted && !editing ? "Detail laporan" : submitted ? "Revisi laporan" : "Isi laporan sesi"}</h1>
      </div>
      <Card>
        <SessionInfo s={s} />
      </Card>

      {submitted && !editing ? (
        <>
          <Card title="Hasil sesi" action={<Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Revisi laporan</Button>}>
            <div className="space-y-4">
              {r.review === "correction" && <Alert tone="yellow">Manager meminta koreksi. Lihat catatan di bawah lalu klik “Revisi laporan”.</Alert>}
              <ReviewStatus r={r} />
              <SessionDelta sessionId={s.id} />
              <Metrics d={latestData(r)!} />
            </div>
          </Card>
          <Card>
            <NotesAndVersions r={r} />
          </Card>
        </>
      ) : (
        <ReportFormCard key={editing ? "edit" : "new"} s={s} r={r} onCancel={submitted ? () => setEditing(false) : undefined} />
      )}
    </div>
  );
}

const FIELDS: { key: keyof ReportForm; label: string; hint?: string; placeholder?: string; mode: "numeric" | "decimal" | "text" }[] = [
  { key: "actualStart", label: "Waktu mulai (aktual)", placeholder: "16:00", mode: "numeric", hint: "Format HH:MM" },
  { key: "actualEnd", label: "Waktu selesai (aktual)", placeholder: "18:00", mode: "numeric", hint: "Maksimal 24:00" },
  { key: "gmv", label: "GMV kumulatif (Rp)", placeholder: "12500000", mode: "numeric" },
  { key: "checkout", label: "Checkout kumulatif", placeholder: "120", mode: "numeric" },
  { key: "views", label: "Views kumulatif", placeholder: "15000", mode: "numeric" },
  { key: "ctr", label: "CTR (%)", placeholder: "7,5", mode: "decimal", hint: "0–100" },
  { key: "ctor", label: "CTOR (%)", placeholder: "9,2", mode: "decimal", hint: "0–100" },
  { key: "avgWatchSec", label: "Rata-rata Durasi Tonton (detik)", placeholder: "75", mode: "numeric" },
];

const emptyData: ReportData = { actualStart: "", actualEnd: "", gmv: 0, ctr: 0, ctor: 0, views: 0, avgWatchSec: 0, checkout: 0, notes: "" };
const toInt = (v: string) => (/^\d[\d.]*$/.test(v.trim()) ? Number(v.replace(/\./g, "")) : undefined);

function ReportFormCard({ s, r, onCancel }: { s: LiveSession; r?: LiveReport; onCancel?: () => void }) {
  const { now, saveDraft, submitReport, toast } = useStore();
  const lookup = useLookup();
  const router = useRouter();
  const prev = lookup.previous(s);
  const prevLabel = prev ? `laporan ${lookup.host(prev.session.hostId)} (${prev.session.start}–${prev.session.end})` : undefined;
  const [form, setForm] = useState<ReportForm>(() => r?.draft ?? (r?.versions.length ? toForm(latestData(r)!) : emptyForm(s)));
  const [errors, setErrors] = useState<FormErrors>({});
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [confirm, setConfirm] = useState<ReportData | null>(null);
  const [submitError, setSubmitError] = useState("");

  const ended = sessionEnded(s, now);
  const late = pastDeadline(s, now);
  const deadline = deadlineOf(s);
  const minutesLeft = deadline - now.minutes - (now.date > s.date ? 1440 : 0);

  const set = (k: keyof ReportForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function review() {
    const { data, errors } = validateReport(form);
    setErrors(errors);
    if (late && !reason.trim()) setReasonError("Wajib diisi karena melewati batas 1 jam");
    if (data && (!late || reason.trim())) setConfirm(data);
  }

  function send() {
    if (!confirm) return;
    const res = submitReport(s.id, confirm, reason);
    if (!res.ok) {
      setSubmitError(res.error ?? "Gagal mengirim");
      setConfirm(null);
      return;
    }
    toast(
      res.flags?.length
        ? "Laporan terkirim. Hasil live hari ini diperbarui (ditandai untuk ditinjau manager)."
        : "Laporan terkirim. Hasil live hari ini sudah diperbarui.",
    );
    router.push("/host");
  }

  if (s.cancelled) return <Alert tone="red">Sesi ini dibatalkan, tidak perlu laporan.</Alert>;
  if (!ended) return <Alert tone="blue">Laporan bisa diisi setelah sesi selesai pukul {s.end} WIB.</Alert>;

  const typed = { gmv: toInt(form.gmv), checkout: toInt(form.checkout), views: toInt(form.views) };
  const gmvPreview = typed.gmv != null ? rupiah(typed.gmv) : undefined;
  const preview =
    typed.gmv != null && typed.checkout != null && typed.views != null
      ? diff({ ...emptyData, gmv: typed.gmv, checkout: typed.checkout, views: typed.views }, prev?.data)
      : undefined;

  return (
    <Card title="Metrik sesi">
      <div className="space-y-4">
        {late ? (
          <Alert tone="red">
            Sudah melewati batas 1 jam (batas {toHHMM(deadline % 1440)} WIB). Laporan tetap bisa dikirim, tapi <b>alasan wajib diisi</b>.
          </Alert>
        ) : (
          <Alert tone="yellow">
            Batas kirim pukul <b>{toHHMM(deadline % 1440)} WIB</b> (sisa {minutesLeft} menit).
          </Alert>
        )}

        <Alert tone="blue">
          Isi <b>GMV, checkout, dan views kumulatif</b> persis seperti di dashboard live saat shift Anda berakhir. Hasil shift Anda dihitung dari selisihnya.
          {prev ? (
            <span className="mt-1 block">
              Acuan {prevLabel}: <b>{rupiah(prev.data.gmv)}</b> · {num(prev.data.checkout)} checkout · {num(prev.data.views)} views
            </span>
          ) : (
            <span className="mt-1 block">Anda shift pertama yang lapor di room live ini, jadi selisih = angka yang Anda isi.</span>
          )}
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              error={errors[f.key]}
              hint={f.key === "gmv" ? gmvPreview ?? "Angka saja, tanpa Rp" : f.hint}
            >
              <Input
                inputMode={f.mode}
                value={form[f.key]}
                placeholder={f.placeholder}
                invalid={!!errors[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </Field>
          ))}
        </div>
        {preview && <DeltaBox delta={preview} prevLabel={prevLabel} />}

        <Field label="Catatan (opsional)">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Kendala, produk terlaris, dsb." />
        </Field>

        {late && (
          <Field label="Alasan terlambat / revisi" error={reasonError}>
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError("");
              }}
              placeholder="Contoh: pesanan baru masuk setelah live ditutup"
            />
          </Field>
        )}

        {submitError && <Alert tone="red">{submitError}</Alert>}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel}>
              Batal
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                saveDraft(s.id, form);
                toast("Draft disimpan");
              }}
            >
              Simpan draft
            </Button>
          )}
          <Button onClick={review}>{onCancel ? "Kirim revisi" : "Kirim laporan"}</Button>
        </div>
      </div>

      <Modal
        open={!!confirm}
        title="Periksa sebelum mengirim"
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Ubah lagi
            </Button>
            <Button onClick={send}>Ya, kirim</Button>
          </>
        }
      >
        {confirm && <DeltaBox delta={diff(confirm, prev?.data)} prevLabel={prevLabel} />}
        {confirm && <Metrics d={confirm} />}
        <p className="text-sm text-slate-500">Laporan langsung masuk rekap. Bila ada angka tidak wajar, laporan akan ditandai untuk ditinjau manager.</p>
      </Modal>
    </Card>
  );
}
