"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash } from "lucide-react";
import { useLookup, useStore } from "@/lib/store";
import { attendanceBadge, coverageGaps, OPS_END, OPS_START, overlaps, sessionEnded, sessionStatus, validateRange } from "@/lib/rules";
import { addDays, formatDate, formatDateLong, formatStamp, toMin } from "@/lib/time";
import type { LiveSession } from "@/lib/types";
import { SessionRow } from "./shared";
import { Alert, Badge, Button, Card, cx, Empty, Field, Input, Modal, PageHeader, Select, Table, td } from "./ui";

const HOURS = Array.from({ length: 17 }, (_, i) => 8 + i);
const pos = (hhmm: string) => ((toMin(hhmm) - OPS_START) / (OPS_END - OPS_START)) * 100;
const weekdayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" });
const weekday = (date: string) => weekdayFmt.format(new Date(date + "T00:00:00Z"));
const dayOfMonth = (date: string) => Number(date.slice(8));

/** Jadwal & shift 7 hari untuk Admin dan Manager. Host hanya melihat hasilnya di halaman Jadwal miliknya. */
export function Schedule() {
  const { data, now, removeAssignment, cancelSession, toast } = useStore();
  const lookup = useLookup();
  const [weekStart, setWeekStart] = useState(now.date);
  const [date, setDate] = useState(now.date);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<LiveSession | "new" | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const moveWeek = (n: number) => {
    const start = addDays(weekStart, n * 7);
    setWeekStart(start);
    setDate(start);
  };

  const assignments = data.assignments.filter((a) => a.date === date).sort((a, b) => a.start.localeCompare(b.start));
  const sessions = data.sessions.filter((s) => s.date === date).sort((a, b) => a.start.localeCompare(b.start));
  const hostIds = [...new Set(assignments.map((a) => a.hostId))];
  const editable = (s: LiveSession) => !s.cancelled && !sessionEnded(s, now) && sessionStatus(s, lookup.report(s.id), now) === "scheduled";

  // Slot kosong = jam operasional yang belum ada sesi live, dihitung per platform aktif.
  const gapsOf = (d: string) =>
    data.platforms
      .filter((p) => p.active)
      .map((p) => ({ p, gaps: coverageGaps(data.sessions.filter((s) => s.date === d && !s.cancelled && s.platformId === p.id)) }))
      .filter((x) => x.gaps.length);
  const gaps = gapsOf(date);

  const activeHosts = data.hosts.filter((h) => h.active);

  return (
    <>
      <PageHeader
        title="Jadwal & shift"
        subtitle="Atur jadwal 7 hari. Perubahan langsung terlihat di jadwal host; host tidak bisa mengubahnya."
        actions={
          <>
            <Button variant="secondary" onClick={() => setAssignOpen(true)}>
              <Plus size={16} /> Penugasan shift
            </Button>
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} /> Sesi live
            </Button>
          </>
        }
      />

      <Card className="mb-5">
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={() => moveWeek(-1)} aria-label="Minggu sebelumnya">
            <ChevronLeft size={18} />
          </Button>
          <p className="text-sm font-medium text-slate-700">
            {formatDate(days[0])} – {formatDate(days[6])}
          </p>
          <Button size="sm" variant="ghost" onClick={() => moveWeek(1)} aria-label="Minggu berikutnya">
            <ChevronRight size={18} />
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const warn = gapsOf(d).length > 0;
            return (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={cx(
                  "relative rounded-lg py-2 text-center",
                  d === date ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100",
                )}
              >
                <span className="block text-[11px] capitalize opacity-80">{weekday(d)}</span>
                <span className="block text-base font-semibold">{dayOfMonth(d)}</span>
                {d === now.date && <span className="block text-[10px] opacity-80">Hari ini</span>}
                {warn && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400" title="Ada slot kosong" />}
              </button>
            );
          })}
        </div>
      </Card>

      <h2 className="mb-3 font-semibold text-slate-900">{formatDateLong(date)}</h2>

      {gaps.length > 0 && (
        <div className="mb-4 space-y-2">
          {gaps.map(({ p, gaps }) => (
            <Alert key={p.id} tone="yellow">
              Slot kosong <b>{p.name}</b>: belum ada sesi live {gaps.map((g) => `${g.start}–${g.end}`).join(", ")}.
            </Alert>
          ))}
        </div>
      )}

      <Card title="Timeline 08:00–24:00 WIB">
        {hostIds.length ? (
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="min-w-[720px]">
              <div className="ml-36 flex text-[11px] text-slate-400">
                {HOURS.slice(0, -1).map((h) => (
                  <span key={h} className="flex-1">
                    {String(h).padStart(2, "0")}
                  </span>
                ))}
              </div>
              {hostIds.map((hid) => (
                <div key={hid} className="flex items-center border-t border-slate-100 py-2">
                  <span className="w-36 shrink-0 truncate pr-2 text-sm font-medium text-slate-700">{lookup.host(hid)}</span>
                  <div className="relative h-10 flex-1 rounded-md bg-slate-50">
                    {assignments
                      .filter((a) => a.hostId === hid)
                      .map((a) => (
                        <div
                          key={a.id}
                          className="absolute inset-y-0 rounded-md border border-dashed border-indigo-300 bg-indigo-50"
                          style={{ left: `${pos(a.start)}%`, width: `${pos(a.end) - pos(a.start)}%` }}
                          title={`${lookup.shiftName(a)} ${a.start}–${a.end}`}
                        />
                      ))}
                    {sessions
                      .filter((s) => s.hostId === hid)
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setEditing(s)}
                          className={cx(
                            "absolute inset-y-1 overflow-hidden rounded px-1.5 text-left text-[11px] font-medium leading-tight text-white",
                            s.cancelled ? "bg-slate-300 line-through" : lookup.platform(s.platformId).includes("TikTok") ? "bg-slate-800" : "bg-orange-500",
                          )}
                          style={{ left: `calc(${pos(s.start)}% + 2px)`, width: `calc(${pos(s.end) - pos(s.start)}% - 4px)` }}
                          title={`${s.start}–${s.end} ${lookup.brand(s.brandId)} (${lookup.platform(s.platformId)})`}
                        >
                          <span className="block truncate">{lookup.brand(s.brandId)}</span>
                          <span className="block truncate opacity-75">
                            {s.start}–{s.end}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <i className="h-3 w-3 rounded border border-dashed border-indigo-300 bg-indigo-50" /> Shift
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-3 w-3 rounded bg-slate-800" /> TikTok Shop
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-3 w-3 rounded bg-orange-500" /> Shopee
                </span>
              </div>
            </div>
          </div>
        ) : (
          <Empty>Belum ada penugasan shift di tanggal ini.</Empty>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Penugasan shift">
          {assignments.length ? (
            <Table head={["Host", "Jam", "Absensi", ""]}>
              {assignments.map((a) => {
                const b = attendanceBadge(a, data.attendance[a.id], now);
                return (
                  <tr key={a.id}>
                    <td className={td}>{lookup.host(a.hostId)}</td>
                    <td className={td}>
                      {a.start}–{a.end} {a.templateId && <span className="text-slate-500">({lookup.shiftName(a).replace("Shift ", "")})</span>}
                    </td>
                    <td className={td}>
                      <Badge tone={b.tone}>{b.label}</Badge>
                    </td>
                    <td className={td}>
                      <button
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Hapus penugasan"
                        onClick={() => {
                          const res = removeAssignment(a.id);
                          toast(res.ok ? "Penugasan dihapus" : res.error);
                        }}
                      >
                        <Trash size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <Empty>Belum ada penugasan.</Empty>
          )}
        </Card>

        <Card title="Sesi live">
          {sessions.length ? (
            <div className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  s={s}
                  showHost
                  action={
                    <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                      {editable(s) ? "Ubah" : "Detail"}
                    </Button>
                  }
                />
              ))}
            </div>
          ) : (
            <Empty>Belum ada sesi.</Empty>
          )}
        </Card>
      </div>

      <Card title="Ringkasan 7 hari" className="mt-5">
        <Table head={["Host", ...days.map((d) => `${weekday(d)} ${dayOfMonth(d)}`)]}>
          {activeHosts.map((h) => (
            <tr key={h.id}>
              <td className={`${td} font-medium text-slate-900`}>{h.name}</td>
              {days.map((d) => {
                const items = data.sessions
                  .filter((s) => s.date === d && s.hostId === h.id && !s.cancelled)
                  .sort((a, b) => a.start.localeCompare(b.start));
                const shifts = data.assignments.filter((a) => a.date === d && a.hostId === h.id);
                return (
                  <td key={d} className={cx(td, "cursor-pointer text-xs", d === date && "bg-indigo-50/60")} onClick={() => setDate(d)}>
                    {items.length ? (
                      items.map((s) => (
                        <span key={s.id} className="flex items-center gap-1 whitespace-nowrap">
                          <i className={cx("h-2 w-2 rounded-full", lookup.platform(s.platformId).includes("TikTok") ? "bg-slate-800" : "bg-orange-500")} />
                          {s.start}–{s.end}
                        </span>
                      ))
                    ) : shifts.length ? (
                      shifts.map((a) => (
                        <span key={a.id} className="block whitespace-nowrap text-slate-500">
                          {a.start}–{a.end}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-300">–</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </Table>
      </Card>

      {assignOpen && <AssignModal date={date} onClose={() => setAssignOpen(false)} />}
      {editing && (
        <SessionModal
          key={editing === "new" ? "new" : editing.id}
          date={date}
          session={editing === "new" ? undefined : editing}
          readOnly={editing !== "new" && !editable(editing)}
          onClose={() => setEditing(null)}
          onCancelSession={(id) => {
            cancelSession(id);
            toast("Sesi dibatalkan");
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function AssignModal({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, addAssignment, toast } = useStore();
  const [hostId, setHostId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const existing = data.assignments.filter((a) => a.date === date && a.hostId === hostId).sort((a, b) => a.start.localeCompare(b.start));
  const rangeError = start && end ? validateRange(start, end) : undefined;

  return (
    <Modal
      open
      title={`Penugasan shift · ${formatDateLong(date)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={() => {
              const res = addAssignment(date, hostId, start.trim(), end.trim());
              if (!res.ok) return setError(res.error);
              toast("Penugasan ditambahkan & terlihat di jadwal host");
              onClose();
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <Field label="Host">
        <Select value={hostId} onChange={(e) => setHostId(e.target.value)}>
          <option value="">Pilih host</option>
          {data.hosts
            .filter((h) => h.active)
            .map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jam mulai (WIB)" hint="Paling awal 08:00">
          <Input value={start} onChange={(e) => setStart(e.target.value)} placeholder="08:00" inputMode="numeric" />
        </Field>
        <Field label="Jam selesai (WIB)" hint="Paling lambat 24:00">
          <Input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="12:00" inputMode="numeric" />
        </Field>
      </div>
      {rangeError && <p className="text-xs text-red-600">{rangeError}</p>}
      {existing.length > 0 && (
        <p className="text-xs text-slate-500">Shift host ini di tanggal tersebut: {existing.map((a) => `${a.start}–${a.end}`).join(", ")}</p>
      )}
      {error && <Alert tone="red">{error}</Alert>}
    </Modal>
  );
}

function SessionModal({
  date,
  session,
  readOnly,
  onClose,
  onCancelSession,
}: {
  date: string;
  session?: LiveSession;
  readOnly: boolean;
  onClose: () => void;
  onCancelSession: (id: string) => void;
}) {
  const { data, saveSession, toast } = useStore();
  const lookup = useLookup();
  const [f, setF] = useState({
    hostId: session?.hostId ?? "",
    brandId: session?.brandId ?? "",
    platformId: session?.platformId ?? "",
    start: session?.start ?? "",
    end: session?.end ?? "",
  });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const assignedHosts = [...new Set(data.assignments.filter((a) => a.date === date).map((a) => a.hostId))];
  // Host yang sudah live (di platform mana pun) pada jam yang diisi tidak bisa dipilih.
  const validTime = /^\d{2}:\d{2}$/.test(f.start) && /^\d{2}:\d{2}$/.test(f.end) && f.start < f.end;
  const busyWith = (hostId: string) =>
    validTime
      ? data.sessions.find((x) => x.id !== session?.id && !x.cancelled && x.date === date && x.hostId === hostId && overlaps(x.start, x.end, f.start, f.end))
      : undefined;
  const brands = data.brands.filter((b) => b.platformId === f.platformId && (b.active || b.id === f.brandId));
  const history = session ? data.audit.filter((l) => l.objectId === session.id) : [];

  return (
    <Modal
      open
      title={session ? (readOnly ? "Detail sesi" : "Ubah sesi") : "Sesi live baru"}
      onClose={onClose}
      footer={
        readOnly ? (
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        ) : (
          <>
            {session && (
              <Button variant="ghost" className="mr-auto text-red-600" onClick={() => onCancelSession(session.id)}>
                Batalkan sesi
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Batal
            </Button>
            <Button
              onClick={() => {
                const res = saveSession({ ...f, id: session?.id, date });
                if (!res.ok) return setError(res.error);
                toast(session ? "Jadwal sesi diperbarui & terlihat di jadwal host" : "Sesi dibuat & terlihat di jadwal host");
                onClose();
              }}
            >
              Simpan
            </Button>
          </>
        )
      }
    >
      {readOnly && <Alert tone="blue">Sesi yang sudah berjalan, selesai, atau dibatalkan tidak bisa diubah agar riwayat tetap utuh.</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mulai (WIB)">
          <Input value={f.start} onChange={set("start")} placeholder="16:00" inputMode="numeric" disabled={readOnly} />
        </Field>
        <Field label="Selesai (WIB)" hint="Maksimal 24:00">
          <Input value={f.end} onChange={set("end")} placeholder="18:00" inputMode="numeric" disabled={readOnly} />
        </Field>
      </div>
      <Field label="Host" hint="Hanya host yang punya shift di tanggal ini. Satu host hanya bisa live di 1 platform pada jam yang sama.">
        <Select value={f.hostId} onChange={set("hostId")} disabled={readOnly}>
          <option value="">Pilih host</option>
          {assignedHosts.map((id) => {
            const busy = busyWith(id);
            return (
              <option key={id} value={id} disabled={!!busy && id !== f.hostId}>
                {lookup.host(id)}
                {busy && ` — sedang live di ${lookup.platform(busy.platformId)} ${busy.start}–${busy.end}`}
              </option>
            );
          })}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Platform">
          <Select
            value={f.platformId}
            disabled={readOnly}
            onChange={(e) => {
              const platformId = e.target.value;
              const keep = data.brands.some((b) => b.id === f.brandId && b.platformId === platformId);
              setF({ ...f, platformId, brandId: keep ? f.brandId : "" });
            }}
          >
            <option value="">Pilih platform</option>
            {data.platforms
              .filter((p) => p.active || p.id === f.platformId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Brand" hint={f.platformId ? undefined : "Pilih platform dulu"}>
          <Select value={f.brandId} onChange={set("brandId")} disabled={readOnly || !f.platformId}>
            <option value="">Pilih brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error && <Alert tone="red">{error}</Alert>}
      {history.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-900">Riwayat perubahan</p>
          <ul className="space-y-1 text-xs text-slate-600">
            {history.map((l) => (
              <li key={l.id}>
                <b>{l.action}</b> · {lookup.user(l.actorId)} · {formatStamp(l.at)}
                {l.before && (
                  <span className="block text-slate-500">
                    {l.before} → {l.after}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
