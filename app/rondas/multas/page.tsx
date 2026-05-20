// app/rondas/multas/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d); };
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const todayISO = () => new Date().toISOString().slice(0, 10);

type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string; orden: number };
type Ingreso = { id: number; socio: { nombres: string; apellidos: string; numeroCuenta: string }; semana: number; monto: number; observaciones: string | null; fecha: string };
type PorSocio = { socio: { nombres: string; apellidos: string; numeroCuenta: string }; semanas: number[]; total: number };
type Gasto = { id: number; descripcion: string; monto: number; fecha: string };

export default function MultasPage() {
  const [rondaId, setRondaId] = useState<number | null>(null);
  const [ronda, setRonda] = useState<{ nombre: string; activa: boolean; semanaActual: number } | null>(null);
  const [resumen, setResumen] = useState<{ totalIngresos: number; totalGastado: number; disponible: number } | null>(null);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [porSocio, setPorSocio] = useState<PorSocio[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [totalSemanas, setTotalSemanas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"ingresos" | "porSocio" | "gastos">("ingresos");

  // Form ingreso multa
  const [iSocioId, setISocioId] = useState<number | "">("");
  const [iSemana, setISemana] = useState<number | "">("");
  const [iMonto, setIMonto] = useState("");
  const [iObs, setIObs] = useState("");
  const [iFecha, setIFecha] = useState(todayISO());
  const [savingI, setSavingI] = useState(false);
  const [msgI, setMsgI] = useState<{ text: string; ok: boolean } | null>(null);

  // Form gasto
  const [gDesc, setGDesc] = useState("");
  const [gMonto, setGMonto] = useState("");
  const [gFecha, setGFecha] = useState(todayISO());
  const [savingG, setSavingG] = useState(false);
  const [msgG, setMsgG] = useState<{ text: string; ok: boolean } | null>(null);

  // Edición gasto
  const [editGastoId, setEditGastoId] = useState<number | null>(null);
  const [editGDesc, setEditGDesc] = useState("");
  const [editGMonto, setEditGMonto] = useState("");

  const toast = (set: any, text: string, ok: boolean) => {
    set({ text, ok });
    setTimeout(() => set(null), 3500);
  };

  async function cargar(id?: number) {
    const rid = id ?? rondaId;
    if (!rid) return;
    try {
      const res = await fetch(`/api/rondas/${rid}/multas`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRonda(data.ronda);
      setResumen(data.resumen);
      setIngresos(data.ingresos ?? []);
      setPorSocio(data.porSocio ?? []);
      setGastos(data.gastos ?? []);
      setSocios(data.socios ?? []);
      setTotalSemanas(data.totalSemanas ?? 0);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    async function init() {
      try {
        const r = await fetch("/api/rondas", { cache: "no-store" });
        if (r.status === 204 || !r.ok) throw new Error("No hay ronda activa");
        const data = await r.json();
        const id = Number(data.id);
        setRondaId(id);
        await cargar(id);
      } catch (e: any) { setError(e.message); setLoading(false); }
    }
    init();
  }, []);

  async function registrarIngreso() {
    if (!rondaId) return;
    setSavingI(true); setMsgI(null);
    try {
      const res = await fetch(`/api/rondas/${rondaId}/multas`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "ingreso", socioId: Number(iSocioId), semana: Number(iSemana), monto: Number(iMonto), observaciones: iObs || null, fecha: iFecha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setISocioId(""); setISemana(""); setIMonto(""); setIObs("");
      toast(setMsgI, `Multa de ${fmt(Number(iMonto))} registrada correctamente`, true);
      await cargar();
    } catch (e: any) { toast(setMsgI, e.message, false); }
    finally { setSavingI(false); }
  }

  async function registrarGasto() {
    if (!rondaId) return;
    setSavingG(true); setMsgG(null);
    try {
      const res = await fetch(`/api/rondas/${rondaId}/multas`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "gasto", descripcion: gDesc.trim(), monto: Number(gMonto), fecha: gFecha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGDesc(""); setGMonto("");
      toast(setMsgG, `Gasto de ${fmt(Number(gMonto))} registrado. Disponible: ${fmt(data.nuevoDisponible)}`, true);
      await cargar();
    } catch (e: any) { toast(setMsgG, e.message, false); }
    finally { setSavingG(false); }
  }

  async function eliminarIngreso(id: number) {
    if (!rondaId || !confirm("¿Eliminar este ingreso de multa?")) return;
    try {
      await fetch(`/api/rondas/${rondaId}/multas/ingresos/${id}`, { method: "DELETE" });
      await cargar();
    } catch { }
  }

  async function eliminarGasto(id: number) {
    if (!rondaId || !confirm("¿Eliminar este gasto?")) return;
    try {
      await fetch(`/api/rondas/${rondaId}/multas/${id}`, { method: "DELETE" });
      await cargar();
    } catch { }
  }

  async function guardarEditGasto(id: number) {
    if (!rondaId) return;
    try {
      const res = await fetch(`/api/rondas/${rondaId}/multas/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: editGDesc.trim(), monto: Number(editGMonto) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditGastoId(null);
      await cargar();
    } catch (e: any) { toast(setMsgG, e.message, false); }
  }

  const semanasDisponibles = Array.from({ length: totalSemanas }, (_, i) => i + 1);
  const canIngreso = !!iSocioId && !!iSemana && Number(iMonto) > 0;
  const canGasto = !!gDesc.trim() && Number(gMonto) > 0;

  if (loading) return <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100"/>)}</div>;
  if (error) return (
    <div className="p-4">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">{error}</div>
      <Link href="/" className="mt-3 inline-block text-sm text-blue-600 hover:underline">← Inicio</Link>
    </div>
  );

  return (
    <div className="space-y-4 p-3 sm:p-6">

      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
              </svg>
            </span>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Caja de multas</h1>
              <p className="text-xs text-gray-500 mt-0.5">{ronda?.nombre} · {totalSemanas} semana{totalSemanas !== 1 ? "s" : ""} cerrada{totalSemanas !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <Link href="/rondas/actual" className="text-xs border rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 shrink-0">← Ronda</Link>
        </div>

        {/* KPIs */}
        {resumen && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">Total multas</p>
              <p className="text-xl font-bold text-amber-700 tabular-nums">{fmt(resumen.totalIngresos)}</p>
              <p className="text-[10px] text-amber-400">{ingresos.length} registro{ingresos.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 p-3">
              <p className="text-[10px] text-red-600 font-semibold uppercase tracking-wide">Gastado</p>
              <p className="text-xl font-bold text-red-700 tabular-nums">{fmt(resumen.totalGastado)}</p>
              <p className="text-[10px] text-red-400">{gastos.length} gasto{gastos.length !== 1 ? "s" : ""}</p>
            </div>
            <div className={cn("rounded-xl border p-3", resumen.disponible > 0 ? "bg-emerald-50 border-emerald-100" : "bg-gray-50 border-gray-200")}>
              <p className={cn("text-[10px] font-semibold uppercase tracking-wide", resumen.disponible > 0 ? "text-emerald-600" : "text-gray-400")}>Disponible</p>
              <p className={cn("text-xl font-bold tabular-nums", resumen.disponible > 0 ? "text-emerald-700" : "text-gray-400")}>{fmt(resumen.disponible)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-gray-50 p-1">
        {(["ingresos", "porSocio", "gastos"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 rounded-lg py-2 text-xs sm:text-sm font-medium transition-colors",
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {t === "ingresos" ? `Registro multas (${ingresos.length})` : t === "porSocio" ? "Por socio" : `Gastos (${gastos.length})`}
          </button>
        ))}
      </div>

      {/* ── Tab: Registro de multas ── */}
      {tab === "ingresos" && (
        <div className="space-y-4">
          {/* Formulario ingreso */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">+</span>
              Registrar multa
            </h3>

            {msgI && (
              <div className={cn("mb-3 rounded-lg p-3 text-xs", msgI.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>
                {msgI.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Socio */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Socio *</label>
                <select
                  value={iSocioId}
                  onChange={e => setISocioId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400">
                  <option value="">— Seleccionar socio —</option>
                  {socios.map(s => (
                    <option key={s.id} value={s.id}>
                      #{s.orden} · {s.nombres} {s.apellidos} ({s.numeroCuenta})
                    </option>
                  ))}
                </select>
              </div>

              {/* Semana */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Semana *</label>
                <select
                  value={iSemana}
                  onChange={e => setISemana(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400">
                  <option value="">— Seleccionar semana —</option>
                  {semanasDisponibles.map(s => (
                    <option key={s} value={s}>Semana {s}</option>
                  ))}
                  {/* También permitir semana actual */}
                  {ronda && !semanasDisponibles.includes(ronda.semanaActual) && (
                    <option value={ronda.semanaActual}>Semana {ronda.semanaActual} (actual)</option>
                  )}
                </select>
              </div>

              {/* Monto */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Monto ($) *</label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={iMonto}
                  onChange={e => setIMonto(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                />
              </div>

              {/* Fecha */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Fecha</label>
                <div className="relative">
                  <input
                    id="fecha-multa-input"
                    type="date"
                    value={iFecha}
                    max={todayISO()}
                    onChange={e => setIFecha(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => (document.getElementById("fecha-multa-input") as HTMLInputElement)?.showPicker?.()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Observaciones */}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Observaciones</label>
                <input
                  type="text"
                  value={iObs}
                  onChange={e => setIObs(e.target.value)}
                  placeholder="Motivo de la multa (opcional)"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button onClick={registrarIngreso} disabled={savingI || !canIngreso}
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40">
                {savingI ? "Registrando…" : "Registrar multa"}
              </button>
            </div>
          </div>

          {/* Listado de ingresos */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-4 py-3">
              <p className="text-sm font-semibold text-gray-800">Multas registradas</p>
            </div>
            {ingresos.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">Sin multas registradas aún</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Socio</th>
                      <th className="px-4 py-3 text-center">Semana</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3 text-left">Observaciones</th>
                      <th className="px-4 py-3 text-right">Fecha</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingresos.map(i => (
                      <tr key={i.id} className="border-t hover:bg-gray-50/70">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{i.socio.nombres} {i.socio.apellidos}</p>
                          <p className="text-xs text-gray-400 font-mono">{i.socio.numeroCuenta}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{i.semana}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-700">{fmt(i.monto)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{i.observaciones || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-400">{fmtDate(i.fecha)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => eliminarIngreso(i.id)}
                            className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-2 py-1 hover:bg-red-50">
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-gray-50">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-sm font-semibold">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-700">{fmt(resumen?.totalIngresos ?? 0)}</td>
                      <td colSpan={3}/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Por socio ── */}
      {tab === "porSocio" && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3">
            <p className="text-sm font-semibold text-gray-800">Resumen de multas por socio</p>
          </div>
          {porSocio.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Sin multas registradas</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Socio</th>
                    <th className="px-4 py-3 text-center">Semanas multadas</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {porSocio.map((ps, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50/70">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{ps.socio.nombres} {ps.socio.apellidos}</p>
                        <p className="text-xs text-gray-400 font-mono">{ps.socio.numeroCuenta}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {ps.semanas.map(s => (
                            <span key={s} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-700">{fmt(ps.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${resumen && resumen.totalIngresos > 0 ? Math.min((ps.total / resumen.totalIngresos) * 100, 100) : 0}%` }}/>
                          </div>
                          <span className="text-xs text-gray-500 tabular-nums">
                            {resumen && resumen.totalIngresos > 0 ? ((ps.total / resumen.totalIngresos) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-sm">Total</td>
                    <td/>
                    <td className="px-4 py-3 text-right font-bold text-amber-700">{fmt(resumen?.totalIngresos ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Gastos ── */}
      {tab === "gastos" && (
        <div className="space-y-4">
          {/* Form gasto */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">−</span>
              Registrar gasto de la caja
            </h3>

            {msgG && (
              <div className={cn("mb-3 rounded-lg p-3 text-xs", msgG.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>
                {msgG.text}
              </div>
            )}

            {resumen && (
              <div className="mb-3 rounded-lg bg-gray-50 border p-3 text-xs flex items-center justify-between">
                <span className="text-gray-500">Disponible en caja:</span>
                <span className={cn("font-bold text-sm", resumen.disponible > 0 ? "text-emerald-600" : "text-red-500")}>{fmt(resumen.disponible)}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Descripción *</label>
                <input type="text" value={gDesc} onChange={e => setGDesc(e.target.value)}
                  placeholder="Ej: Café reunión, útiles de oficina…"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Monto ($) *</label>
                <input type="number" min="0.01" step="0.01" value={gMonto} onChange={e => setGMonto(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-200"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Fecha</label>
                <div className="relative">
                  <input id="fecha-gasto-input" type="date" value={gFecha} max={todayISO()} onChange={e => setGFecha(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"/>
                  <button type="button" tabIndex={-1}
                    onClick={() => (document.getElementById("fecha-gasto-input") as HTMLInputElement)?.showPicker?.()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button onClick={registrarGasto} disabled={savingG || !canGasto}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">
                {savingG ? "Registrando…" : "Registrar gasto"}
              </button>
            </div>
          </div>

          {/* Listado gastos */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">Gastos registrados</p>
              <span className="text-xs text-gray-400">Total: <strong className="text-red-600">{fmt(resumen?.totalGastado ?? 0)}</strong></span>
            </div>
            {gastos.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">Sin gastos registrados</div>
            ) : (
              <ul className="divide-y">
                {gastos.map(g => (
                  <li key={g.id} className="p-4">
                    {editGastoId === g.id ? (
                      <div className="space-y-2">
                        <input type="text" value={editGDesc} onChange={e => setEditGDesc(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"/>
                        <div className="flex gap-2">
                          <input type="number" step="0.01" value={editGMonto} onChange={e => setEditGMonto(e.target.value)}
                            className="w-32 rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-200"/>
                          <button onClick={() => guardarEditGasto(g.id)}
                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">Guardar</button>
                          <button onClick={() => setEditGastoId(null)}
                            className="rounded-lg border px-3 py-2 text-xs text-gray-600">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">−</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{g.descripcion}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(g.fecha)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-red-700 tabular-nums">{fmt(g.monto)}</span>
                          <button onClick={() => { setEditGastoId(g.id); setEditGDesc(g.descripcion); setEditGMonto(String(g.monto)); }}
                            className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50">Editar</button>
                          <button onClick={() => eliminarGasto(g.id)}
                            className="text-xs text-red-500 border border-red-200 rounded px-2 py-1 hover:bg-red-50">Eliminar</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
