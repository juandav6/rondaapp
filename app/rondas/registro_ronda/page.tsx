// app/rondas/registro_ronda/page.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string; saldoAhorros?: number };
type CrearRondaPayload = { montoAporte: number; fechaInicio: string; ahorroObjetivo: number; intervaloDiasCobro: number };

const fmt = (n: number | string) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n) || 0);
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "-";
  // Si viene como YYYY-MM-DD, forzar UTC noon para evitar desfase de zona horaria
  const normalized = iso.length === 10 ? `${iso}T12:00:00Z` : iso;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};
const fmtDateFull = (d: Date | null) => d ? new Intl.DateTimeFormat("es-EC", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(d) : "-";
const addDays = (iso: string | Date, days: number) => {
  if (!iso) return null;
  // Forzar UTC noon para evitar desfase por zona horaria
  const base = typeof iso === "string"
    ? (iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso))
    : new Date(iso);
  if (Number.isNaN(base.getTime())) return null;
  const noon = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12, 0, 0));
  noon.setUTCDate(noon.getUTCDate() + days);
  return noon;
};
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
type Paso = 1 | 2 | 3;

export default function RegistrarRondaPage() {
  const [paso, setPaso] = useState<Paso>(1);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [q, setQ] = useState("");
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [orden, setOrden] = useState<number[]>([]);
  const [aportesInversion, setAportesInversion] = useState<Record<number, number>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [rondaCreada, setRondaCreada] = useState<{ id: number; nombre: string } | null>(null);
  const [rondaActivaExistente, setRondaActivaExistente] = useState<{ id: number; nombre: string } | null>(null);
  const [checkingRonda, setCheckingRonda] = useState(true);
  const [form, setForm] = useState({ montoAporte: 0, fechaInicio: "", ahorroObjetivo: 0, intervaloDiasCobro: 7, esHistorica: false });
  const fechaRef = useRef<HTMLInputElement>(null);

  // Préstamos pendientes de la ronda activa
  const [prestamosPendientes, setPrestamosPendientes] = useState<{ id: number; monto: number; saldoActual: number; socio: { nombres: string; apellidos: string; numeroCuenta: string } }[]>([]);
  const [ignorarPrestamos, setIgnorarPrestamos] = useState(false);

  useEffect(() => {
    fetch("/api/socios").then(r => r.json()).then(l => setSocios(Array.isArray(l) ? l : [])).catch(() => setSocios([]));
  }, []);

  useEffect(() => {
    fetch("/api/rondas").then(r => r.status === 204 ? null : r.json()).then(async d => {
      if (d?.id) {
        setRondaActivaExistente({ id: d.id, nombre: d.nombre });
        try {
          // Intentar endpoint específico de la ronda primero
          const pRes = await fetch(`/api/rondas/${d.id}/prestamos-activos`).catch(() => null);
          if (pRes?.ok) {
            const pData = await pRes.json();
            setPrestamosPendientes(Array.isArray(pData) ? pData : (pData?.prestamos ?? []));
          } else {
            // Fallback: endpoint general
            const pRes2 = await fetch("/api/prestamos");
            if (pRes2.ok) {
              const pData2 = await pRes2.json();
              const lista = Array.isArray(pData2) ? pData2 : (pData2?.prestamos ?? []);
              setPrestamosPendientes(
                lista.filter((p: any) => p.estado === "ACTIVO")
              );
            }
          }
        } catch { /* silencioso */ }
      }
    }).catch(() => {}).finally(() => setCheckingRonda(false));
  }, []);

  const sociosConSaldo = useMemo(() => socios.filter(s => (s.saldoAhorros ?? 0) > 0), [socios]);

  useEffect(() => {
    if (paso !== 2) return;
    setAportesInversion(prev => {
      const hasValues = sociosConSaldo.some(s => (prev[s.id] ?? 0) > 0);
      if (hasValues) return prev;
      const init: Record<number, number> = {};
      sociosConSaldo.forEach(s => {
        const v = Number(s.saldoAhorros ?? 0);
        init[s.id] = Number.isFinite(v) ? v : 0;
      });
      return init;
    });
  }, [paso, sociosConSaldo]);

  const sociosFiltrados = useMemo(() => { const s = q.trim().toLowerCase(); if (!s) return socios; return socios.filter(x => [x.nombres, x.apellidos, x.numeroCuenta].some(v => v.toLowerCase().includes(s))); }, [socios, q]);
  const participantesOrdenados = orden.map(id => socios.find(s => s.id === id)).filter(Boolean) as Socio[];
  const totalFondo = sociosConSaldo.reduce((a, s) => {
    const v = Number(aportesInversion[s.id] ?? 0);
    return a + (Number.isFinite(v) ? v : 0);
  }, 0);
  const sociosEnRondaSet = useMemo(() => new Set(seleccion), [seleccion]);

  const toggleSocio = (id: number) => { setSeleccion(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); setOrden(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
  const seleccionarTodos = () => { const ids = sociosFiltrados.map(s => s.id); setSeleccion(ids); setOrden(ids); };
  const limpiarSeleccion = () => { setSeleccion([]); setOrden([]); };

  function onDragStart(i: number) { setDragIndex(i); }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(i: number) { if (dragIndex === null || dragIndex === i) return; setOrden(prev => { const n = [...prev]; const [m] = n.splice(dragIndex, 1); n.splice(i, 0, m); return n; }); setDragIndex(null); }
  function handleSwap(i: number) { if (swapIndex === null) { setSwapIndex(i); return; } if (swapIndex === i) { setSwapIndex(null); return; } setOrden(prev => { const n = [...prev]; [n[swapIndex], n[i]] = [n[i], n[swapIndex]]; return n; }); setSwapIndex(null); }
  function moveUp(i: number) { if (i <= 0) return; setOrden(prev => { const n = [...prev]; [n[i-1], n[i]] = [n[i], n[i-1]]; return n; }); }
  function moveDown(i: number) { setOrden(prev => { if (i >= prev.length-1) return prev; const n = [...prev]; [n[i+1], n[i]] = [n[i], n[i+1]]; return n; }); }

  const hayPrestamosPendientes = prestamosPendientes.length > 0 && !form.esHistorica;
  const paso1Valido = form.fechaInicio && form.montoAporte > 0 && seleccion.length > 0 && (!hayPrestamosPendientes || ignorarPrestamos);
  const paso2Valido = sociosConSaldo.every(s => { const a = aportesInversion[s.id] ?? 0; return a >= 0 && a <= (s.saldoAhorros ?? 0); });
  const fechaFinEstimada = form.fechaInicio && orden.length > 0 ? addDays(form.fechaInicio, Math.max(0, orden.length - 1) * form.intervaloDiasCobro) : null;

  async function crearRonda() {
    try {
      setCreando(true); setError(null);
      const r1 = await fetch("/api/rondas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ montoAporte: form.montoAporte, fechaInicio: form.fechaInicio, ahorroObjetivo: form.ahorroObjetivo, intervaloDiasCobro: form.intervaloDiasCobro, activa: !form.esHistorica }) });
      const ronda = await r1.json();
      if (!r1.ok) throw new Error(ronda?.error || "No se pudo crear la ronda");
      const r2 = await fetch(`/api/rondas/${ronda.id}/participantes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sociosIds: orden }) });
      const p2 = await r2.json();
      if (!r2.ok) throw new Error(p2?.error || "Error al agregar participantes");
      const r3 = await fetch(`/api/rondas/${ronda.id}/orden`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ordenIds: orden }) });
      if (!r3.ok) { const d = await r3.json(); throw new Error(d?.error || "Error al guardar el orden"); }
      const aportesConMonto = sociosConSaldo.filter(s => (aportesInversion[s.id] ?? 0) > 0);
      if (aportesConMonto.length > 0) {
        const r4 = await fetch(`/api/rondas/${ronda.id}/inversion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aportes: sociosConSaldo.map(s => ({ socioId: s.id, monto: aportesInversion[s.id] ?? 0 })) }) });
        const d4 = await r4.json();
        if (!r4.ok) throw new Error(d4?.error || "Error al registrar inversiones");
      }
      setRondaCreada({ id: ronda.id, nombre: ronda.nombre });
    } catch (e: any) { setError(e?.message ?? "Error al crear la ronda"); }
    finally { setCreando(false); }
  }

  // ── Ronda creada ──
  if (rondaCreada) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6 sm:p-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-emerald-600">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-emerald-800 mb-2">¡Ronda {rondaCreada.nombre} creada!</h1>
          <p className="text-sm text-emerald-700 mb-5">Lista con participantes, orden de recepción y fondo de inversión.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/rondas/actual" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">Ir a Ronda Actual</Link>
            <Link href="/prestamos/solicitud" className="rounded-lg border border-emerald-300 px-5 py-2.5 text-sm text-emerald-700 hover:bg-emerald-100">Crear primer préstamo</Link>
          </div>
        </div>
      </div>
    );
  }

  if (checkingRonda) {
    return <div className="p-4 space-y-3"><div className="h-32 animate-pulse rounded-xl bg-gray-100" /><div className="h-64 animate-pulse rounded-xl bg-gray-100" /></div>;
  }

  if (rondaActivaExistente && !form.esHistorica) {
    return (
      <div className="p-4 sm:p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-6 sm:p-10 max-w-md w-full shadow-sm">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-amber-600">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-amber-900 mb-2">Ya existe una ronda activa</h2>
          <p className="text-sm text-amber-700 mb-1">La ronda <strong>{rondaActivaExistente.nombre}</strong> está en curso.</p>
          <p className="text-xs text-amber-600 mb-6">Solo puede haber una ronda activa a la vez.</p>
          <div className="flex flex-col gap-2">
            <Link href="/rondas/actual" className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">Ir a la ronda activa</Link>
            <Link href="/rondas/historial" className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 px-5 py-2.5 text-sm text-amber-700 hover:bg-amber-100">Ver historial</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Stepper compacto ──
  const stepLabels = ["Configuración", "Fondo", "Confirmar"];

  return (
    <div className="space-y-4 p-3 sm:p-6">

      {/* Stepper */}
      <div className="rounded-xl border bg-white px-4 py-3 sm:px-6 sm:py-4 shadow-sm">
        <div className="flex items-center gap-1 sm:gap-2">
          {stepLabels.map((label, i) => {
            const n = (i + 1) as Paso;
            return (
              <div key={n} className="flex items-center gap-1 sm:gap-2 flex-1">
                {i > 0 && <div className={cn("h-px flex-1", paso > n ? "bg-emerald-300" : paso === n ? "bg-blue-300" : "bg-gray-200")} />}
                <button onClick={() => paso > n ? setPaso(n) : undefined}
                  className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1.5 sm:px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap",
                    paso === n ? "bg-blue-600 text-white" :
                    paso > n ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer" :
                    "bg-gray-100 text-gray-400 cursor-default")}>
                  <span className={cn("inline-flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold shrink-0",
                    paso === n ? "bg-white/20" : paso > n ? "bg-emerald-200" : "bg-gray-200")}>
                    {paso > n ? "✓" : n}
                  </span>
                  <span className="hidden xs:inline sm:inline">{label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* ── Banner préstamos pendientes ── */}
      {hayPrestamosPendientes && paso === 1 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 shadow-sm overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-rose-800">
                Hay {prestamosPendientes.length} préstamo{prestamosPendientes.length !== 1 ? "s" : ""} activo{prestamosPendientes.length !== 1 ? "s" : ""} sin cancelar
              </p>
              <p className="text-xs text-rose-600 mt-0.5">
                Se recomienda cancelar todos los préstamos antes de iniciar una nueva ronda.
              </p>
            </div>
          </div>

          {/* Lista de préstamos */}
          <ul className="border-t border-rose-100 divide-y divide-rose-100">
            {prestamosPendientes.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-rose-900 truncate">
                    {p.socio.nombres} {p.socio.apellidos}
                  </p>
                  <p className="text-xs text-rose-500 font-mono">{p.socio.numeroCuenta}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-rose-400">Saldo pendiente</p>
                  <p className="text-sm font-bold text-rose-700 tabular-nums">
                    {new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(p.saldoActual))}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* Opción de continuar de todas maneras */}
          <div className="border-t border-rose-200 bg-rose-100/50 px-4 py-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setIgnorarPrestamos(v => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${ignorarPrestamos ? "bg-rose-600" : "bg-rose-300"}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${ignorarPrestamos ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <span className="text-xs text-rose-800 font-medium">
                Entiendo el riesgo — continuar de todas maneras
              </span>
            </label>
          </div>
        </div>
      )}

      {/* ══ PASO 1 ══ */}
      {paso === 1 && (
        <>
          <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
            <h1 className="text-base sm:text-xl font-semibold mb-1">Paso 1 · Configuración y participantes</h1>
            <p className="text-xs sm:text-sm text-gray-500">Configura los parámetros, selecciona participantes y define el orden.</p>
          </div>

          {/* En móvil: secciones apiladas. En desktop: grid */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">

            {/* Parámetros */}
            <section className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-800">Parámetros de la ronda</h2>
              <div className="grid gap-3">
                <div>
                  <label className="mb-1 block text-xs sm:text-sm font-medium text-gray-700">Monto por aporte</label>
                  <input type="number" min={0} value={form.montoAporte || ""} placeholder="0.00"
                    onChange={e => setForm(f => ({ ...f, montoAporte: Number(e.target.value) }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="mb-1 block text-xs sm:text-sm font-medium text-gray-700">Ahorro objetivo por socio</label>
                  <input type="number" min={0} value={form.ahorroObjetivo || ""} placeholder="0.00"
                    onChange={e => setForm(f => ({ ...f, ahorroObjetivo: Number(e.target.value) }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="mb-1 block text-xs sm:text-sm font-medium text-gray-700">Fecha de inicio</label>
                  <input ref={fechaRef} type="date" value={form.fechaInicio}
                    onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none cursor-pointer"
                    onClick={e => (e.target as HTMLInputElement).showPicker?.()}/>
                  {form.fechaInicio && <p className="mt-1 text-xs text-gray-400">{fmtDate(form.fechaInicio)}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs sm:text-sm font-medium text-gray-700">Intervalo de cobro</label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[{ v: 7, l: "Sem." }, { v: 15, l: "Quinc." }, { v: 30, l: "Mens." }].map(opt => (
                      <button key={opt.v} onClick={() => setForm(f => ({ ...f, intervaloDiasCobro: opt.v }))}
                        className={cn("rounded-md border py-1.5 text-xs font-medium transition-colors",
                          form.intervaloDiasCobro === opt.v ? "bg-blue-600 border-blue-600 text-white" : "hover:bg-gray-50 text-gray-600")}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                  <input type="number" min={1} value={form.intervaloDiasCobro || ""} placeholder="7"
                    onChange={e => setForm(f => ({ ...f, intervaloDiasCobro: Number(e.target.value) }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  <p className="mt-1 text-xs text-gray-400">{form.intervaloDiasCobro} días entre cobros</p>
                </div>

                {/* Toggle ronda histórica */}
                <div className="rounded-lg border p-3">
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div>
                      <p className="text-xs font-medium text-gray-700">Ronda histórica (fecha pasada)</p>
                      <p className="text-xs text-gray-400 mt-0.5">Se creará como cerrada, sin bloquear nuevas rondas</p>
                    </div>
                    <div
                      onClick={() => setForm(f => ({ ...f, esHistorica: !f.esHistorica }))}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.esHistorica ? "bg-blue-600" : "bg-gray-200"}`}>
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${form.esHistorica ? "translate-x-4" : "translate-x-0"}`} />
                    </div>
                  </label>
                </div>
              </div>

              {/* Resumen compacto */}
              {seleccion.length > 0 && (
                <div className="mt-4 space-y-1 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-gray-600">
                  <div className="flex justify-between"><span>Participantes</span><strong>{seleccion.length}</strong></div>
                  <div className="flex justify-between"><span>Total por socio</span><strong>{fmt(seleccion.length * (form.montoAporte || 0))}</strong></div>
                  {fechaFinEstimada && <div className="flex justify-between"><span>Fin estimado</span><strong>{fmtDate(fechaFinEstimada.toISOString())}</strong></div>}
                </div>
              )}
            </section>

            {/* Participantes + Orden */}
            <section className="lg:col-span-2 rounded-xl border bg-white p-4 sm:p-6 shadow-sm space-y-4">
              {/* Búsqueda y controles */}
              <div>
                <h2 className="mb-3 text-sm font-semibold text-gray-800">Seleccionar participantes ({seleccion.length} sel.)</h2>
                <div className="flex gap-2 mb-2">
                  <input className="flex-1 rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="Buscar socio…" value={q} onChange={e => setQ(e.target.value)} />
                </div>
                <div className="flex gap-2 mb-2">
                  <button onClick={seleccionarTodos} className="flex-1 rounded-md border py-1.5 text-xs text-gray-600 hover:bg-gray-50">Seleccionar todos</button>
                  <button onClick={limpiarSeleccion} className="flex-1 rounded-md border py-1.5 text-xs text-gray-600 hover:bg-gray-50">Limpiar</button>
                </div>
                <ul className="divide-y rounded-lg border max-h-52 overflow-y-auto">
                  {sociosFiltrados.map(s => {
                    const checked = seleccion.includes(s.id);
                    return (
                      <li key={s.id} className={cn("flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors", checked && "bg-blue-50/60")}
                        onClick={() => toggleSocio(s.id)}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors", checked ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white")}>
                            {checked && <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                            <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-emerald-700 shrink-0 tabular-nums">{fmt(s.saldoAhorros ?? 0)}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Orden de recepción */}
              {orden.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">Orden de recepción</h3>
                    <span className="text-xs text-gray-400 hidden sm:block">Arrastra · ↑↓ para reordenar</span>
                    <span className="text-xs text-gray-400 sm:hidden">↑↓ para mover</span>
                  </div>
                  <ol className="space-y-1.5 max-h-64 overflow-y-auto">
                    {participantesOrdenados.map((s, idx) => (
                      <li key={s.id}
                        className={cn("flex items-center justify-between gap-2 rounded-lg border p-2.5 bg-white hover:bg-gray-50 text-sm", swapIndex === idx && "ring-2 ring-yellow-300")}
                        draggable onDragStart={() => onDragStart(idx)} onDragOver={onDragOver} onDrop={() => onDrop(idx)}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900 text-xs sm:text-sm">{s.nombres} {s.apellidos}</p>
                            {form.fechaInicio && <p className="text-xs text-gray-400">{fmtDateFull(addDays(form.fechaInicio, idx * form.intervaloDiasCobro))}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => moveUp(idx)} className="flex h-7 w-7 items-center justify-center rounded border text-xs hover:bg-gray-100 disabled:opacity-30" disabled={idx === 0}>↑</button>
                          <button onClick={() => moveDown(idx)} className="flex h-7 w-7 items-center justify-center rounded border text-xs hover:bg-gray-100 disabled:opacity-30" disabled={idx === participantesOrdenados.length - 1}>↓</button>
                          <button onClick={() => handleSwap(idx)}
                            className={cn("flex h-7 w-7 items-center justify-center rounded border text-xs", swapIndex === idx ? "bg-yellow-100 text-yellow-800 border-yellow-300" : "hover:bg-gray-100")}>⇄</button>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setPaso(2)} disabled={!paso1Valido}
              className={cn("w-full sm:w-auto rounded-lg px-6 py-2.5 text-sm font-medium text-white",
                !paso1Valido ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700")}>
              Continuar al fondo →
            </button>
          </div>
        </>
      )}

      {/* ══ PASO 2 ══ */}
      {paso === 2 && (
        <>
          <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
            <h1 className="text-base sm:text-xl font-semibold mb-1">Paso 2 · Fondo de inversión</h1>
            <p className="text-xs sm:text-sm text-gray-500">Define cuánto destina cada socio al fondo de préstamos.</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block"/><span className="text-gray-600">En la ronda</span></span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block"/><span className="text-gray-600">Solo fondo</span></span>
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-xs text-gray-500">Fondo total</p>
              <p className="text-lg font-bold text-blue-700 tabular-nums">{fmt(totalFondo)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { const max: Record<number, number> = {}; sociosConSaldo.forEach(s => { max[s.id] = s.saldoAhorros ?? 0; }); setAportesInversion(max); }}
                className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Máximo</button>
              <button onClick={() => { const c: Record<number, number> = {}; sociosConSaldo.forEach(s => { c[s.id] = 0; }); setAportesInversion(c); }}
                className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Limpiar</button>
            </div>
          </div>

          {/* Tabla desktop */}
          <div className="hidden sm:block rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Socio</th>
                    <th className="px-4 py-3 text-right">Saldo</th>
                    <th className="px-4 py-3 text-right">Aporte inversión</th>
                    <th className="px-4 py-3 text-right">Queda</th>
                    <th className="px-4 py-3 text-right">% Part.</th>
                  </tr>
                </thead>
                <tbody>
                  {sociosConSaldo.map(s => {
                    const saldo = s.saldoAhorros ?? 0;
                    const aporte = aportesInversion[s.id] ?? 0;
                    const resta = saldo - aporte;
                    const pct = totalFondo > 0 ? (aporte / totalFondo) * 100 : 0;
                    const excede = aporte > saldo;
                    const enRonda = sociosEnRondaSet.has(s.id);
                    return (
                      <tr key={s.id} className={cn("border-t", excede && "bg-red-50/50")}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{s.nombres} {s.apellidos}</p>
                            {enRonda
                              ? <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"><span className="h-1.5 w-1.5 rounded-full bg-blue-500"/>En ronda</span>
                              : <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-400"/>Solo fondo</span>}
                          </div>
                          <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700 font-medium">{fmt(saldo)}</td>
                        <td className="px-4 py-3 text-right">
                          <input type="number" min={0} max={saldo} step="0.01" value={aporte || ""}
                            onChange={e => { const v = Math.min(Math.max(0, Number(e.target.value || 0)), saldo); if (Number.isFinite(v)) setAportesInversion(p => ({ ...p, [s.id]: v })); }}
                            className={cn("w-32 rounded-md border px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2", excede ? "border-red-300 focus:ring-red-200" : "focus:ring-blue-200")}
                            placeholder="0.00" />
                        </td>
                        <td className={cn("px-4 py-3 text-right tabular-nums", resta < 0 ? "text-red-600" : "text-gray-700")}>{fmt(Math.max(0, resta))}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1.5 rounded-full bg-gray-200 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                            <span className="text-sm font-medium text-blue-700 tabular-nums">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(sociosConSaldo.reduce((a, s) => a + (s.saldoAhorros ?? 0), 0))}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700 tabular-nums">{fmt(totalFondo)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(sociosConSaldo.reduce((a, s) => a + Math.max(0, (s.saldoAhorros ?? 0) - (aportesInversion[s.id] ?? 0)), 0))}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tarjetas móvil fondo */}
          <div className="sm:hidden space-y-2">
            {sociosConSaldo.map(s => {
              const saldo = s.saldoAhorros ?? 0;
              const aporte = aportesInversion[s.id] ?? 0;
              const excede = aporte > saldo;
              const enRonda = sociosEnRondaSet.has(s.id);
              const pct = totalFondo > 0 ? (aporte / totalFondo) * 100 : 0;
              return (
                <div key={s.id} className={cn("rounded-xl border bg-white p-3 shadow-sm space-y-2", excede && "border-red-200")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">{s.nombres} {s.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                    </div>
                    {enRonda
                      ? <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"><span className="h-1.5 w-1.5 rounded-full bg-blue-500"/>Ronda</span>
                      : <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-400"/>Fondo</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-emerald-50 p-2">
                      <p className="text-emerald-500">Saldo disponible</p>
                      <p className="font-semibold text-emerald-700 tabular-nums mt-0.5">{fmt(saldo)}</p>
                    </div>
                    <div className={cn("rounded p-2", excede ? "bg-red-50" : "bg-blue-50")}>
                      <p className={excede ? "text-red-500" : "text-blue-500"}>Queda en ahorros</p>
                      <p className={cn("font-semibold tabular-nums mt-0.5", excede ? "text-red-700" : "text-blue-700")}>{fmt(Math.max(0, saldo - aporte))}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Aporte al fondo de inversión {pct > 0 && <span className="text-blue-600 font-medium">({pct.toFixed(1)}%)</span>}</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} max={saldo} step="0.01" value={aporte || ""}
                        onChange={e => { const v = Math.min(Math.max(0, Number(e.target.value || 0)), saldo); if (Number.isFinite(v)) setAportesInversion(p => ({ ...p, [s.id]: v })); }}
                        className={cn("flex-1 rounded-md border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2", excede ? "border-red-300 focus:ring-red-200" : "focus:ring-blue-200")}
                        placeholder="0.00" />
                      <button onClick={() => setAportesInversion(p => ({ ...p, [s.id]: saldo }))}
                        className="shrink-0 rounded-md border px-2.5 py-2 text-xs text-gray-600 hover:bg-gray-50">Max</button>
                      <button onClick={() => setAportesInversion(p => ({ ...p, [s.id]: 0 }))}
                        className="shrink-0 rounded-md border px-2.5 py-2 text-xs text-gray-600 hover:bg-gray-50">0</button>
                    </div>
                    {excede && <p className="text-xs text-red-600 mt-1">⚠️ Excede el saldo disponible</p>}
                    {aporte > 0 && <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden"><div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} /></div>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between gap-3">
            <button onClick={() => setPaso(1)} className="rounded-lg border px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">← Volver</button>
            <button onClick={() => setPaso(3)} disabled={!paso2Valido}
              className={cn("flex-1 sm:flex-none rounded-lg px-6 py-2.5 text-sm font-medium text-white",
                !paso2Valido ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700")}>
              Ver resumen →
            </button>
          </div>
        </>
      )}

      {/* ══ PASO 3 ══ */}
      {paso === 3 && (
        <>
          <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
            <h1 className="text-base sm:text-xl font-semibold mb-1">Paso 3 · Confirmar creación</h1>
            <p className="text-xs sm:text-sm text-gray-500">Revisa todos los parámetros antes de crear la ronda.</p>
          </div>

          {/* KPIs resumen */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Monto por aporte", value: fmt(form.montoAporte) },
              { label: "Ahorro objetivo", value: fmt(form.ahorroObjetivo) },
              { label: "Fecha inicio", value: fmtDate(form.fechaInicio) },
              { label: "Fin estimado", value: fechaFinEstimada ? fmtDate(fechaFinEstimada.toISOString()) : "-" },
              { label: "Participantes", value: String(seleccion.length) },
              { label: "Socios en fondo", value: String(sociosConSaldo.filter(s => (aportesInversion[s.id] ?? 0) > 0).length) },
              { label: "Fondo inversión", value: fmt(totalFondo), highlight: true },
              { label: "Intervalo", value: `${form.intervaloDiasCobro} días` },
            ].map(k => (
              <div key={k.label} className={cn("rounded-xl border p-3 sm:p-4 shadow-sm", k.highlight ? "border-blue-200 bg-blue-50" : "bg-white")}>
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={cn("mt-0.5 text-sm sm:text-lg font-semibold truncate", k.highlight ? "text-blue-700" : "text-gray-900")}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Orden */}
          <div className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Orden de recepción ({seleccion.length} socios)</h3>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {participantesOrdenados.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-xs sm:text-sm font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                    {form.fechaInicio && <p className="text-xs text-gray-400">{fmtDateFull(addDays(form.fechaInicio, idx * form.intervaloDiasCobro))}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fondo resumen */}
          {totalFondo > 0 && (
            <div className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Fondo de inversión · {fmt(totalFondo)}</h3>
              {/* Tabla desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-gray-400">
                    <tr><th className="pb-2">Socio</th><th className="pb-2 text-center">Tipo</th><th className="pb-2 text-right">Monto</th><th className="pb-2 text-right">%</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {sociosConSaldo.filter(s => (aportesInversion[s.id] ?? 0) > 0).map(s => {
                      const enRonda = sociosEnRondaSet.has(s.id);
                      return (
                        <tr key={s.id}>
                          <td className="py-2 font-medium text-gray-900">{s.nombres} {s.apellidos}</td>
                          <td className="py-2 text-center">
                            {enRonda ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"><span className="h-1.5 w-1.5 rounded-full bg-blue-500"/>En ronda</span>
                              : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-400"/>Solo fondo</span>}
                          </td>
                          <td className="py-2 text-right tabular-nums text-blue-700 font-medium">{fmt(aportesInversion[s.id] ?? 0)}</td>
                          <td className="py-2 text-right tabular-nums text-gray-600">{totalFondo > 0 ? (((aportesInversion[s.id] ?? 0) / totalFondo) * 100).toFixed(1) : 0}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Lista móvil fondo resumen */}
              <ul className="sm:hidden space-y-1.5">
                {sociosConSaldo.filter(s => (aportesInversion[s.id] ?? 0) > 0).map(s => {
                  const enRonda = sociosEnRondaSet.has(s.id);
                  const pct = totalFondo > 0 ? (((aportesInversion[s.id] ?? 0) / totalFondo) * 100).toFixed(1) : "0";
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border bg-gray-50 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium", enRonda ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")}>
                          <span className={cn("h-1 w-1 rounded-full", enRonda ? "bg-blue-500" : "bg-amber-400")} />{enRonda ? "En ronda" : "Solo fondo"}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-blue-700 tabular-nums">{fmt(aportesInversion[s.id] ?? 0)}</p>
                        <p className="text-xs text-gray-400">{pct}%</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-800">
            ⚠️ Al confirmar se creará la ronda y se transferirán los montos de inversión. Esta acción no se puede deshacer fácilmente.
          </div>

          <div className="flex justify-between gap-3">
            <button onClick={() => setPaso(2)} className="rounded-lg border px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">← Volver</button>
            <button onClick={crearRonda} disabled={creando}
              className={cn("flex-1 sm:flex-none rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm",
                creando ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700")}>
              {creando ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4"/></svg>
                  Creando ronda…
                </span>
              ) : "✓ Confirmar y crear ronda"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
