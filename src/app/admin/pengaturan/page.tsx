"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { DEFAULT_ANOMALY } from "@/lib/rules";
import { rupiah } from "@/lib/format";
import type { AnomalySettings } from "@/lib/types";
import { Alert, Button, Card, Field, Input, PageHeader } from "@/components/ui";

const FIELDS: { key: keyof AnomalySettings; label: string; hint: string; unit: string }[] = [
  { key: "maxCtr", label: "CTR maksimal", hint: "Laporan ditandai bila CTR di atas nilai ini", unit: "%" },
  { key: "maxCtor", label: "CTOR maksimal", hint: "Laporan ditandai bila CTOR di atas nilai ini", unit: "%" },
  { key: "maxGmvPerCheckout", label: "GMV per checkout maksimal", hint: "Rata-rata nilai per checkout (Rp)", unit: "Rp" },
  { key: "maxDurationDiff", label: "Selisih durasi maksimal", hint: "Beda durasi aktual vs jadwal", unit: "menit" },
];

const toForm = (s: AnomalySettings) => Object.fromEntries(FIELDS.map((f) => [f.key, String(s[f.key])])) as Record<keyof AnomalySettings, string>;

export default function SettingsPage() {
  const { settings, saveSettings, toast } = useStore();
  const [form, setForm] = useState(() => toForm(settings));
  const [error, setError] = useState("");

  const parse = (): AnomalySettings =>
    Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key].replace(/\./g, "").replace(",", "."))])) as unknown as AnomalySettings;

  return (
    <>
      <PageHeader title="Pengaturan" subtitle="Ambang flag anomali laporan" />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card title="Ambang flag anomali">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <Field key={f.key} label={`${f.label} (${f.unit})`} hint={f.hint}>
                  <Input inputMode="decimal" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                </Field>
              ))}
            </div>
            {error && <Alert tone="red">{error}</Alert>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setForm(toForm(DEFAULT_ANOMALY))}>
                Kembalikan bawaan
              </Button>
              <Button
                onClick={() => {
                  const res = saveSettings(parse());
                  if (!res.ok) return setError(res.error);
                  setError("");
                  toast("Ambang anomali disimpan & tercatat di audit log");
                }}
              >
                Simpan
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Aturan yang selalu aktif">
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-slate-600">
            <li>Ada checkout tetapi GMV Rp 0 (atau sebaliknya)</li>
            <li>Checkout melebihi jumlah views</li>
            <li>Angka kumulatif lebih kecil dari laporan shift sebelumnya</li>
            <li>Dikirim melewati batas 1 jam</li>
            <li>Revisi setelah manager meminta koreksi</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Laporan yang ditandai tetap masuk rekap. Perubahan ambang hanya berlaku untuk laporan yang dikirim setelahnya. Bawaan: CTR {DEFAULT_ANOMALY.maxCtr}%, CTOR{" "}
            {DEFAULT_ANOMALY.maxCtor}%, {rupiah(DEFAULT_ANOMALY.maxGmvPerCheckout)} per checkout, {DEFAULT_ANOMALY.maxDurationDiff} menit.
          </p>
        </Card>
      </div>
    </>
  );
}
