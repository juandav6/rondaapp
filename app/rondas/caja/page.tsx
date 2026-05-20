// app/rondas/caja/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d); };
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const todayISO = () => new Date().toISOString().slice(0, 10);

type Mov = { id: number; tipo: string; monto: number; socio: any; semana: number | null; descripcion: string | null; fecha: string; prestamoExpressId: number | null };
type PorSocio = { socio: any; multas: any[]; intereses: any[]; totalMultas: number; totalIntereses: number };
type Resumen = { totalMultas: number; totalIntereses: number; totalIngresos: number; totalGastos: number; saldoCaja: number };

const TIPO_CFG: Record<string, { label: string; color: string; bg: string; border: string; signo: string }> = {
  MULTA:           { label: "Multa",          color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",  signo: "+" },
  INTERES_EXPRESS: { label: "Interés express", color: "text-indigo-700",  bg: "bg-indigo-50",  border: "border-indigo-200", signo: "+" },
  GASTO:           { label: "Gasto",           color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",    signo: "−" },
};

export default function CajaPage() {
  const [rondaId, setRondaId] = useState<number | null>(null);
  const [ronda, setRonda] = useState<any>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [movimientos, setMovimientos] = useState<Mov[]>([]);
  const [porSocio, setPorSocio] = useState<PorSocio[]>([]);
  const [socios, setSocios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"movimientos" | "porSocio" | "gastos">("movimientos");

  // Form gasto
  const [gDesc, setGDesc] = useState("");
  const [gMonto, setGMonto] = useState("");
  const [gFecha, setGFecha] = useState(todayISO());
  const [savingG, setSavingG] = useState(false);
  const [msgG, setMsgG] = useState<{ text: string; ok: boolean } | null>(null);

  // Edit gasto
  const [editId, setEditId] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editMonto, setEditMonto] = useState("");

  const showMsg = (set: any, text: string, ok: boolean) => { set({ text, ok }); setTimeout(() => set(null), 3500); };

  async function cargar(id?: number) {
    const rid = id ?? rondaId;
    if (!rid) return;
    try {
      const [cajaRes, sociosRes] = await Promise.all([
        fetch(`/api/rondas/${rid}/caja`, { cache: "no-store" }),
        fetch(`/api/rondas/${rid}/inversion/transferir`, { cache: "no-store" }),
      ]);
      const caja = await cajaRes.json();
      if (!cajaRes.ok) throw new Error(caja.error);
      setRonda(caja.ronda);
      setResumen(caja.resumen);
      setMovimientos(caja.movimientos ?? []);
      setPorSocio(caja.porSocio ?? []);
      if (sociosRes.ok) {
        const sd = await sociosRes.json();
        setSocios(sd.socios ?? []);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    async function init() {
      try {
        const r = await fetch("/api/rondas", { cache: "no-store" });
        if (r.status === 204 || !r.ok) throw new Error("No hay ronda activa");
        const d = await r.json();
        setRondaId(d.id);
        await cargar(d.id);
      } catch (e: any) { setError(e.message); setLoading(false); }
    }
    init();
  }, []);

  async function registrarGasto() {
    if (!rondaId) return;
    setSavingG(true);
    try {
      const res = await fetch(`/api/rondas/${rondaId}/caja`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "GASTO", monto: Number(gMonto), descripcion: gDesc.trim(), fecha: gFecha }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setGDesc(""); setGMonto("");
      showMsg(setMsgG, `Gasto registrado. Saldo restante: ${fmt((resumen?.saldoCaja ?? 0) - Number(gMonto))}`, true);
      await cargar();
    } catch (e: any) { showMsg(setMsgG, e.message, false); }
    finally { setSavingG(false); }
  }

  async function eliminarMov(id: number) {
    if (!rondaId || !confirm("¿Eliminar este movimiento?")) return;
    await fetch(`/api/rondas/${rondaId}/caja/${id}`, { method: "DELETE" });
    await cargar();
  }

  async function guardarEdit(id: number) {
    if (!rondaId) return;
    try {
      const res = await fetch(`/api/rondas/${rondaId}/caja/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto: Number(editMonto), descripcion: editDesc }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditId(null);
      await cargar();
    } catch (e: any) { showMsg(setMsgG, e.message, false); }
  }

  const gastos = movimientos.filter(m => m.tipo === "GASTO");
  const ingresos = movimientos.filter(m => m.tipo !== "GASTO");

  if (loading) return <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100"/>)}</div>;
  if (error) return <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>;

  return (
    <div className="space-y-4 p-3 sm:p-6">

      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM2.273 8.625A4.483 4.483 0 0 1 5.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 6H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z"/>
              </svg>
            </span>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Caja Común</h1>
              <p className="text-xs text-gray-500 mt-0.5">{ronda?.nombre} · Multas + Intereses express + Gastos</p>
            </div>
          </div>
          <Link href="/rondas/actual" className="text-xs border rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 shrink-0">← Ronda</Link>
        </div>

        {/* KPIs */}
        {resumen && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <p className="text-[10px] text-amber-600 font-semibold uppercase">Multas</p>
              <p className="text-lg font-bold text-amber-700 tabular-nums">{fmt(resumen.totalMultas)}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
              <p className="text-[10px] text-indigo-600 font-semibold uppercase">Interés express</p>
              <p className="text-lg font-bold text-indigo-700 tabular-nums">{fmt(resumen.totalIntereses)}</p>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <p className="text-[10px] text-blue-600 font-semibold uppercase">Total ingresos</p>
              <p className="text-lg font-bold text-blue-700 tabular-nums">{fmt(resumen.totalIngresos)}</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 p-3">
              <p className="text-[10px] text-red-500 font-semibold uppercase">Gastos</p>
              <p className="text-lg font-bold text-red-700 tabular-nums">{fmt(resumen.totalGastos)}</p>
            </div>
            <div className={cn("rounded-xl border p-3 sm:col-span-1 col-span-2", resumen.saldoCaja > 0 ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200")}>
              <p className={cn("text-[10px] font-bold uppercase", resumen.saldoCaja > 0 ? "text-emerald-600" : "text-gray-400")}>Saldo en caja</p>
              <p className={cn("text-xl font-bold tabular-nums", resumen.saldoCaja > 0 ? "text-emerald-700" : "text-gray-400")}>{fmt(resumen.saldoCaja)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-gray-50 p-1">
        {([
          { key: "movimientos", label: `Movimientos (${movimientos.length})` },
          { key: "porSocio", label: `Por socio (${porSocio.length})` },
          { key: "gastos", label: `Gastos (${gastos.length})` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("flex-1 rounded-lg py-2 text-xs sm:text-sm font-medium transition-colors",
              tab === t.key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Movimientos */}
      {tab === "movimientos" && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3 flex items-center gap-3">
            <div className="flex gap-2 flex-wrap">
              {Object.entries(TIPO_CFG).map(([tipo, cfg]) => {
                const total = movimientos.filter(m => m.tipo === tipo).reduce((s, m) => s + m.monto, 0);
                return total > 0 ? (
                  <span key={tipo} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border", cfg.bg, cfg.color, cfg.border)}>
                    {cfg.label}: {fmt(total)}
                  </span>
                ) : null;
              })}
            </div>
          </div>
          {movimientos.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Sin movimientos registrados</div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Socio / Descripción</th>
                      <th className="px-4 py-3 text-center">Semana</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3 text-right">Fecha</th>
                      <th className="px-4 py-3"/>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map(m => {
                      const cfg = TIPO_CFG[m.tipo] ?? TIPO_CFG.GASTO;
                      return (
                        <tr key={m.id} className="border-t hover:bg-gray-50/70">
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border", cfg.bg, cfg.color, cfg.border)}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {m.socio ? (
                              <div>
                                <p className="font-medium text-gray-900">{m.socio.nombres} {m.socio.apellidos}</p>
                                {m.descripcion && <p className="text-xs text-gray-400">{m.descripcion}</p>}
                              </div>
                            ) : (
                              <p className="text-gray-700">{m.descripcion}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {m.semana ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">{m.semana}</span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">
                            <span className={m.tipo === "GASTO" ? "text-red-600" : "text-emerald-600"}>
                              {cfg.signo}{fmt(m.monto)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-400">{fmtDate(m.fecha)}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => eliminarMov(m.id)}
                              className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-2 py-1 hover:bg-red-50">
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Móvil */}
              <ul className="sm:hidden divide-y">
                {movimientos.map(m => {
                  const cfg = TIPO_CFG[m.tipo] ?? TIPO_CFG.GASTO;
                  return (
                    <li key={m.id} className="p-3 flex items-start gap-3">
                      <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border", cfg.bg, cfg.color, cfg.border)}>
                        {cfg.signo}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {m.socio ? `${m.socio.nombres} ${m.socio.apellidos}` : m.descripcion}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn("text-[10px] rounded-full px-1.5 py-0.5 font-semibold", cfg.bg, cfg.color)}>{cfg.label}</span>
                              {m.semana && <span className="text-[10px] text-gray-400">Sem. {m.semana}</span>}
                              <span className="text-[10px] text-gray-400">{fmtDate(m.fecha)}</span>
                            </div>
                            {m.descripcion && m.socio && <p className="text-xs text-gray-400 mt-0.5">{m.descripcion}</p>}
                          </div>
                          <span className={cn("text-sm font-bold tabular-nums shrink-0", m.tipo === "GASTO" ? "text-red-600" : "text-emerald-600")}>
                            {cfg.signo}{fmt(m.monto)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Tab: Por socio */}
      {tab === "porSocio" && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3">
            <p className="text-sm font-semibold text-gray-800">Detalle por socio</p>
            <p className="text-xs text-gray-400 mt-0.5">Multas e intereses express acumulados</p>
          </div>
          {porSocio.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Sin ingresos registrados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Socio</th>
                    <th className="px-4 py-3 text-right">Multas</th>
                    <th className="px-4 py-3 text-right">Interés express</th>
                    <th className="px-4 py-3 text-right">Total aportado</th>
                    <th className="px-4 py-3 text-left">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {porSocio.map((ps, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50/70">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{ps.socio.nombres} {ps.socio.apellidos}</p>
                        <p className="text-xs text-gray-400 font-mono">{ps.socio.numeroCuenta}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {ps.totalMultas > 0 ? (
                          <span className="font-semibold text-amber-700">{fmt(ps.totalMultas)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {ps.totalIntereses > 0 ? (
                          <span className="font-semibold text-indigo-700">{fmt(ps.totalIntereses)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">
                        {fmt(ps.totalMultas + ps.totalIntereses)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {ps.multas.map((m, j) => (
                            <span key={`m${j}`} className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                              Sem.{m.semana} {fmt(m.monto)}
                            </span>
                          ))}
                          {ps.intereses.map((m, j) => (
                            <span key={`i${j}`} className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                              Express sem.{m.semana} {fmt(m.monto)}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-sm">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-700 tabular-nums">{fmt(resumen?.totalMultas ?? 0)}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700 tabular-nums">{fmt(resumen?.totalIntereses ?? 0)}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(resumen?.totalIngresos ?? 0)}</td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Gastos */}
      {tab === "gastos" && (
        <div className="space-y-4">
          {/* Form gasto */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Registrar gasto</h3>

            {msgG && (
              <div className={cn("mb-3 rounded-lg p-3 text-xs", msgG.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>
                {msgG.text}
              </div>
            )}

            {resumen && (
              <div className="mb-3 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs">
                <span className="text-gray-600">Disponible en caja:</span>
                <span className={cn("font-bold text-sm", resumen.saldoCaja > 0 ? "text-emerald-700" : "text-red-600")}>{fmt(resumen.saldoCaja)}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Descripción *</label>
                <input type="text" value={gDesc} onChange={e => setGDesc(e.target.value)}
                  placeholder="Ej: Café reunión, útiles, transporte…"
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
                  <input id="fecha-gasto-caja" type="date" value={gFecha} max={todayISO()} onChange={e => setGFecha(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"/>
                  <button type="button" tabIndex={-1}
                    onClick={() => (document.getElementById("fecha-gasto-caja") as HTMLInputElement)?.showPicker?.()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={registrarGasto} disabled={savingG || !gDesc.trim() || !gMonto || Number(gMonto) <= 0}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">
                {savingG ? "Registrando…" : "Registrar gasto"}
              </button>
            </div>
          </div>

          {/* Listado gastos */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">Gastos registrados</p>
              <span className="text-xs text-gray-400">Total: <strong className="text-red-600">{fmt(resumen?.totalGastos ?? 0)}</strong></span>
            </div>
            {gastos.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">Sin gastos aún</div>
            ) : (
              <ul className="divide-y">
                {gastos.map(g => (
                  <li key={g.id} className="p-4">
                    {editId === g.id ? (
                      <div className="space-y-2">
                        <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"/>
                        <div className="flex gap-2">
                          <input type="number" step="0.01" value={editMonto} onChange={e => setEditMonto(e.target.value)}
                            className="w-32 rounded-lg border px-3 py-2 text-sm text-right"/>
                          <button onClick={() => guardarEdit(g.id)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">Guardar</button>
                          <button onClick={() => setEditId(null)} className="rounded-lg border px-3 py-2 text-xs text-gray-600">Cancelar</button>
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
                          <button onClick={() => { setEditId(g.id); setEditDesc(g.descripcion ?? ""); setEditMonto(String(g.monto)); }}
                            className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50">Editar</button>
                          <button onClick={() => eliminarMov(g.id)}
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
