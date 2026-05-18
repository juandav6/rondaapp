// app/rondas/multas/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d); };
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Resumen = { totalMultas: number; totalGastado: number; disponible: number };
type DetalleAporte = { id: number; semana: number; multa: number; fecha: string; socio: { nombres: string; apellidos: string; numeroCuenta: string } };
type PorSocio = { socio: { nombres: string; apellidos: string; numeroCuenta: string }; semanas: number[]; total: number };
type Gasto = { id: number; descripcion: string; monto: number; fecha: string; creadoPor?: string };

export default function MultasPage() {
  const [rondaId, setRondaId] = useState<number | null>(null);
  const [ronda, setRonda] = useState<{ nombre: string; activa: boolean } | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [detalleAportes, setDetalleAportes] = useState<DetalleAporte[]>([]);
  const [porSocio, setPorSocio] = useState<PorSocio[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"resumen" | "detalle" | "gastos">("resumen");

  // Nuevo gasto
  const [descInput, setDescInput] = useState("");
  const [montoInput, setMontoInput] = useState("");
  const [fechaInput, setFechaInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [savingGasto, setSavingGasto] = useState(false);
  const [gastoError, setGastoError] = useState<string | null>(null);
  const [gastoOk, setGastoOk] = useState<string | null>(null);

  // Edición de gasto
  const [editId, setEditId] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editMonto, setEditMonto] = useState("");

  async function cargar(id?: number) {
    const rid = id ?? rondaId;
    if (!rid) return;
    try {
      const res = await fetch(`/api/rondas/${rid}/multas`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRonda(data.ronda);
      setResumen(data.resumen);
      setDetalleAportes(data.detalleAportes ?? []);
      setPorSocio(data.porSocio ?? []);
      setGastos(data.gastos ?? []);
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

  async function registrarGasto() {
    if (!rondaId) return;
    setGastoError(null); setSavingGasto(true);
    try {
      const res = await fetch(`/api/rondas/${rondaId}/multas`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: descInput.trim(), monto: Number(montoInput), fecha: fechaInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDescInput(""); setMontoInput(""); setGastoOk(`Gasto registrado. Disponible: ${fmt(data.nuevoDisponible)}`);
      setTimeout(() => setGastoOk(null), 3000);
      await cargar();
    } catch (e: any) { setGastoError(e.message); }
    finally { setSavingGasto(false); }
  }

  async function eliminarGasto(id: number) {
    if (!rondaId || !confirm("¿Eliminar este gasto?")) return;
    try {
      await fetch(`/api/rondas/${rondaId}/multas/${id}`, { method: "DELETE" });
      await cargar();
    } catch { }
  }

  async function guardarEdit(id: number) {
    if (!rondaId) return;
    try {
      const res = await fetch(`/api/rondas/${rondaId}/multas/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: editDesc.trim(), monto: Number(editMonto) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditId(null);
      await cargar();
    } catch (e: any) { setGastoError(e.message); }
  }

  if (loading) return <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100"/>)}</div>;

  if (error) return (
    <div className="p-4">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">{error}</div>
      <Link href="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">← Volver al inicio</Link>
    </div>
  );

  return (
    <div className="space-y-4 p-3 sm:p-6">

      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd"/>
              </svg>
            </span>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Caja de multas</h1>
              <p className="text-xs text-gray-500 mt-0.5">{ronda?.nombre}</p>
            </div>
          </div>
          <Link href="/rondas/actual" className="text-xs border rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 shrink-0">← Ronda actual</Link>
        </div>

        {/* KPIs */}
        {resumen && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-red-50 border border-red-100 p-3">
              <p className="text-[10px] text-red-600 font-medium uppercase tracking-wide">Total multas</p>
              <p className="text-xl font-bold text-red-700 tabular-nums">{fmt(resumen.totalMultas)}</p>
              <p className="text-[10px] text-red-400">{detalleAportes.length} registro{detalleAportes.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Gastado</p>
              <p className="text-xl font-bold text-amber-700 tabular-nums">{fmt(resumen.totalGastado)}</p>
              <p className="text-[10px] text-amber-400">{gastos.length} gasto{gastos.length !== 1 ? "s" : ""}</p>
            </div>
            <div className={cn("rounded-xl border p-3", resumen.disponible > 0 ? "bg-emerald-50 border-emerald-100" : "bg-gray-50 border-gray-200")}>
              <p className={cn("text-[10px] font-medium uppercase tracking-wide", resumen.disponible > 0 ? "text-emerald-600" : "text-gray-400")}>Disponible</p>
              <p className={cn("text-xl font-bold tabular-nums", resumen.disponible > 0 ? "text-emerald-700" : "text-gray-400")}>{fmt(resumen.disponible)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-gray-50 p-1">
        {(["resumen", "detalle", "gastos"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 rounded-lg py-2 text-xs sm:text-sm font-medium capitalize transition-colors",
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {t === "resumen" ? "Por socio" : t === "detalle" ? `Detalle (${detalleAportes.length})` : `Gastos (${gastos.length})`}
          </button>
        ))}
      </div>

      {/* Tab: Por socio */}
      {tab === "resumen" && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3">
            <p className="text-sm font-semibold text-gray-800">Multas por socio</p>
            <p className="text-xs text-gray-400 mt-0.5">Socios que han tenido multas en esta ronda</p>
          </div>
          {porSocio.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">✓ Sin multas registradas en esta ronda</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Socio</th>
                    <th className="px-4 py-3 text-center">Semanas</th>
                    <th className="px-4 py-3 text-right">Total multa</th>
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
                            <span key={s} className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-700">{fmt(ps.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full"
                              style={{ width: `${resumen ? Math.min((ps.total / resumen.totalMultas) * 100, 100) : 0}%` }}/>
                          </div>
                          <span className="text-xs text-gray-500 tabular-nums">
                            {resumen ? ((ps.total / resumen.totalMultas) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-sm">Total</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{detalleAportes.length} multas</td>
                    <td className="px-4 py-3 text-right font-bold text-red-700">{fmt(resumen?.totalMultas ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium text-gray-500">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Detalle */}
      {tab === "detalle" && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3">
            <p className="text-sm font-semibold text-gray-800">Detalle de multas por semana</p>
          </div>
          {detalleAportes.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Sin multas registradas</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-center">Semana</th>
                    <th className="px-4 py-3 text-left">Socio</th>
                    <th className="px-4 py-3 text-right">Multa</th>
                    <th className="px-4 py-3 text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {detalleAportes.map(a => (
                    <tr key={a.id} className="border-t hover:bg-gray-50/70">
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">{a.semana}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{a.socio.nombres} {a.socio.apellidos}</p>
                        <p className="text-xs text-gray-400 font-mono">{a.socio.numeroCuenta}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-700">{fmt(a.multa)}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">{fmtDate(a.fecha)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Gastos */}
      {tab === "gastos" && (
        <div className="space-y-4">
          {/* Formulario nuevo gasto */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Registrar gasto de la caja</h3>
            {gastoError && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">{gastoError}</div>}
            {gastoOk && <div className="mb-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">{gastoOk}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Descripción</label>
                <input
                  type="text"
                  value={descInput}
                  onChange={e => setDescInput(e.target.value)}
                  placeholder="Ej: Café reunión semana 5, Útiles de oficina…"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Monto ($)</label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={montoInput}
                  onChange={e => setMontoInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fecha</label>
                <div className="relative">
                  <input
                    id="fecha-gasto-input"
                    type="date"
                    value={fechaInput}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => setFechaInput(e.target.value)}
                    className="rounded-lg border px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => (document.getElementById("fecha-gasto-input") as HTMLInputElement)?.showPicker?.()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {resumen && (
                  <p className="text-xs text-gray-400">
                    Disponible: <strong className={cn(resumen.disponible > 0 ? "text-emerald-600" : "text-red-500")}>{fmt(resumen.disponible)}</strong>
                  </p>
                )}
                <button
                  onClick={registrarGasto}
                  disabled={savingGasto || !descInput.trim() || !montoInput || Number(montoInput) <= 0}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">
                  {savingGasto ? "Guardando…" : "Registrar gasto"}
                </button>
              </div>
            </div>
          </div>

          {/* Listado de gastos */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">Gastos registrados</p>
              <span className="text-xs text-gray-400">Total gastado: <strong className="text-amber-700">{fmt(resumen?.totalGastado ?? 0)}</strong></span>
            </div>
            {gastos.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">Sin gastos registrados aún</div>
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
                            className="w-32 rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-200"/>
                          <button onClick={() => guardarEdit(g.id)}
                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">Guardar</button>
                          <button onClick={() => setEditId(null)}
                            className="rounded-lg border px-3 py-2 text-xs text-gray-600">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">$</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">{g.descripcion}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(g.fecha)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-amber-700 tabular-nums">{fmt(g.monto)}</span>
                          <button onClick={() => { setEditId(g.id); setEditDesc(g.descripcion); setEditMonto(String(g.monto)); }}
                            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50">
                            Editar
                          </button>
                          <button onClick={() => eliminarGasto(g.id)}
                            className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1 hover:bg-red-50">
                            Eliminar
                          </button>
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
