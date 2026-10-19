"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";
import { useStore } from "@/lib/store";
import { homeOf, ROLE_LABEL } from "@/components/AppShell";
import { Alert, Badge, Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const { data, user, now, login } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) router.replace(homeOf(user.role));
  }, [user, router]);

  // Host dikelompokkan per platform sesi hari ini, lalu diurutkan sesuai shift (Shift 1 → Shift 4).
  const todayShift = (hostId?: string) => data.assignments.find((a) => a.date === now.date && a.hostId === hostId);
  // Nomor shift = urutan jam mulai hari ini (Shift 1 = paling pagi).
  const todayStarts = [...new Set(data.assignments.filter((a) => a.date === now.date).map((a) => a.start))].sort();
  const hosts = data.users
    .filter((u) => u.role === "host" && u.active)
    .map((u) => {
      const a = todayShift(u.hostId);
      const platformId = data.sessions.find((s) => s.assignmentId === a?.id)?.platformId ?? "";
      return { u, a, platformId };
    })
    .sort((x, y) => (x.a?.start ?? "99").localeCompare(y.a?.start ?? "99"));
  const hostGroups = [...data.platforms.map((p) => ({ id: p.id, label: `Host ${p.name}` })), { id: "", label: "Host lain" }]
    .map((g) => ({ ...g, items: hosts.filter((h) => h.platformId === g.id) }))
    .filter((g) => g.items.length);
  const staff = data.users.filter((u) => u.role !== "host" && u.active);
  const shiftLabel = (a?: (typeof hosts)[number]["a"]) =>
    a ? `Shift ${todayStarts.indexOf(a.start) + 1} · ${a.start}–${a.end}` : "Tidak ada shift hari ini";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = data.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || !password) return setError("Email atau kata sandi salah");
    if (!u.active) return setError("Akun ini dinonaktifkan. Hubungi Admin.");
    login(u.id);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Radio size={26} />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">LiveOps</h1>
          <p className="text-sm text-slate-500">Jadwal, absensi & laporan live TikTok Shop dan Shopee</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@agency.id" autoComplete="username" />
          </Field>
          <Field label="Kata sandi">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </Field>
          {error && <Alert tone="red">{error}</Alert>}
          <Button type="submit" className="w-full">
            Masuk
          </Button>
        </form>

        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Akun demo (sekali klik)</p>
          <div className="space-y-2">
            {hostGroups.map((g) => (
              <div key={g.id} className="space-y-2">
                <p className="pt-1 text-xs font-semibold text-slate-700">{g.label}</p>
                {g.items.map(({ u, a }) => (
                  <DemoButton key={u.id} name={u.name} sub={shiftLabel(a)} badge="Host" onClick={() => login(u.id)} />
                ))}
              </div>
            ))}
            <p className="pt-1 text-xs font-semibold text-slate-700">Manajemen</p>
            {staff.map((u) => (
              <DemoButton key={u.id} name={u.name} sub={u.email} badge={ROLE_LABEL[u.role]} onClick={() => login(u.id)} />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Tip: buka beberapa tab dan login sebagai host berbeda di tiap tab — data tersinkron otomatis.</p>
        </div>
      </div>
    </main>
  );
}

function DemoButton({ name, sub, badge, onClick }: { name: string; sub: string; badge: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left text-sm ring-1 ring-slate-200 hover:ring-indigo-300"
    >
      <span>
        <span className="block font-medium text-slate-900">{name}</span>
        <span className="text-xs text-slate-500">{sub}</span>
      </span>
      <Badge tone="indigo">{badge}</Badge>
    </button>
  );
}
