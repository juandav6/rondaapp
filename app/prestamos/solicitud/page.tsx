// app/prestamos/solicitud/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Socio = { id: number; numeroCuenta: string; nombres: string; apellidos: string };
type CuotaPreview = { numero: number; fechaVenc: string; cuota: number; interes: number; capital: number; saldo: number; esParcial?: boolean };
type PrestamoCreado = { id: number; estado: string; monto: number; tasaAnual: number; plazoSemanas: number; fechaInicio: string; saldoActual: number; ronda: { id: number; nombre: string }; socio: { id: number; numeroCuenta: string; nombres: string; apellidos: string }; cuotas: any[] };
type RondaInfo = { id: number; nombre: string; fechaFin: string | null; totalParticipantes: number; fondoTotal: number; fondoPrestado: number; fondoDisponible: number };

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const fmtMoney = (n: number | null | undefined) => { if (n == null || Number.isNaN(Number(n))) return "-"; return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n)); };
const fmtDate = (iso: string | null | undefined) => { if (!iso) return "-"; const d = new Date(iso); if (Number.isNaN(d.getTime())) return "-"; return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d); };
const todayDateOnly = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function addDays(date: Date, days: number): Date { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

function buildPreviewSchedule(params: { principal: number; tasaMensualPct: number; plazoSemanas: number; fechaInicio: string }): CuotaPreview[] {
  const { principal: P, tasaMensualPct, plazoSemanas, fechaInicio } = params;
  if (!P || P <= 0 || plazoSemanas <= 0 || tasaMensualPct < 0) return [];
  const start = new Date(`${fechaInicio}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];
  const interesMensual = round2(P * (tasaMensualPct / 100));
  const mesesCompletos = Math.floor(plazoSemanas / 4);
  const semanasRestantes = plazoSemanas % 4;
  const totalCuotas = mesesCompletos + (semanasRestantes > 0 ? 1 : 0);
  if (totalCuotas === 0) return [];
  const capitalPorCuota = round2(P / totalCuotas);
  let saldo = P, diaAcumulado = 0;
  const out: CuotaPreview[] = [];
  for (let i = 1; i <= totalCuotas; i++) {
    const esUltima = i === totalCuotas;
    const esParcial = esUltima && semanasRestantes > 0;
    diaAcumulado += esParcial ? semanasRestantes * 7 : 28;
    const capital = esUltima ? round2(saldo) : capitalPorCuota;
    const interes = esParcial ? round2(interesMensual * (semanasRestantes / 4)) : interesMensual;
    const newSaldo = round2(saldo - capital);
    out.push({ numero: i, fechaVenc: addDays(start, diaAcumulado).toISOString(), cuota: round2(capital + interes), interes, capital, saldo: newSaldo, esParcial });
    saldo = newSaldo;
  }
  return out;
}

function SinRondaActiva() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 border-2 border-orange-100 mb-5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-orange-300">
          <path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/>
          <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z" clipRule="evenodd"/>
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">No hay una ronda activa</h2>
      <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-6">Los préstamos requieren un fondo de inversión de la ronda activa. Primero crea una ronda.</p>
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Link href="/rondas/registro_ronda" className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">+ Crear ronda</Link>
        <Link href="/prestamos/pendientes" className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Ver préstamos</Link>
      </div>
    </div>
  );
}

export default function PrestamoSolicitudPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [loadingSocios, setLoadingSocios] = useState(true);
  const [loadingRonda, setLoadingRonda] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rondaInfo, setRondaInfo] = useState<RondaInfo | null>(null);
  const [sinRonda, setSinRonda] = useState(false);
  const [qSocio, setQSocio] = useState("");
  const [socioId, setSocioId] = useState<number | null>(null);
  const [monto, setMonto] = useState<number>(0);
  const [tasaAnual, setTasaAnual] = useState<number>(2);
  const [plazoSemanas, setPlazoSemanas] = useState<number>(4);
  const [fechaInicio, setFechaInicio] = useState<string>(todayDateOnly());
  const [prestamoCreado, setPrestamoCreado] = useState<PrestamoCreado | null>(null);
  // Tabs móvil: "form" | "amortizacion"
  const [mobileTab, setMobileTab] = useState<"form" | "amortizacion">("form");

  useEffect(() => {
    fetch("/api/socios").then(r => r.json()).then(d => setSocios(Array.isArray(d) ? d : [])).catch(() => setSocios([])).finally(() => setLoadingSocios(false));
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoadingRonda(true);
        const rRes = await fetch("/api/rondas");
        if (rRes.status === 204 || !rRes.ok) { if (alive) { setSinRonda(true); setLoadingRonda(false); } return; }
        const rData = await rRes.json();
        if (!alive || !rData?.id) { if (alive) { setSinRonda(true); setLoadingRonda(false); } return; }
        const rondaId = Number(rData.id);
        const totalParticipantes = Array.isArray(rData.participaciones) ? rData.participaciones.length : 0;
        let fondoTotal = 0;
        try { const invRes = await fetch(`/api/rondas/${rondaId}/inversion`); if (invRes.ok) { const invData = await invRes.json(); fondoTotal = Number(invData?.totalFondo ?? 0); } } catch { }
        let fondoPrestado = 0;
        try { const presRes = await fetch("/api/prestamos"); if (presRes.ok) { const presData = await presRes.json(); const prestamos = Array.isArray(presData?.prestamos) ? presData.prestamos : []; fondoPrestado = prestamos.filter((p: any) => p.ronda?.id === rondaId && p.estado === "ACTIVO").reduce((acc: number, p: any) => acc + Number(p.monto ?? 0), 0); } } catch { }
        if (alive) { setRondaInfo({ id: rondaId, nombre: String(rData.nombre ?? "Ronda activa"), fechaFin: rData.fechaFinISO ?? rData.fechaFinDate ?? null, totalParticipantes, fondoTotal, fondoPrestado, fondoDisponible: Math.max(0, fondoTotal - fondoPrestado) }); setSinRonda(false); }
      } catch { if (alive) setSinRonda(true); }
      finally { if (alive) setLoadingRonda(false); }
    }
    load();
    return () => { alive = false; };
  }, []);

  const maxPlazoSemanas = useMemo(() => rondaInfo?.totalParticipantes ?? null, [rondaInfo]);
  const excedeMaximo = useMemo(() => rondaInfo != null && !!monto && monto > rondaInfo.fondoDisponible, [monto, rondaInfo]);
  const excedePlazo = useMemo(() => maxPlazoSemanas != null && plazoSemanas > maxPlazoSemanas, [plazoSemanas, maxPlazoSemanas]);
  const socioSeleccionado = useMemo(() => socios.find(s => s.id === socioId) ?? null, [socios, socioId]);
  const sociosFiltrados = useMemo(() => { const s = qSocio.trim().toLowerCase(); if (!s) return socios.slice(0, 30); return socios.filter(x => [x.nombres, x.apellidos, x.numeroCuenta].some(v => v.toLowerCase().includes(s))).slice(0, 30); }, [socios, qSocio]);
  const preview = useMemo(() => buildPreviewSchedule({ principal: monto, tasaMensualPct: tasaAnual, plazoSemanas, fechaInicio }), [monto, tasaAnual, plazoSemanas, fechaInicio]);
  const totals = useMemo(() => ({ totalInteres: round2(preview.reduce((a, c) => a + c.interes, 0)), totalPagado: round2(preview.reduce((a, c) => a + c.cuota, 0)) }), [preview]);
  const plazoInfo = useMemo(() => { const m = Math.floor(plazoSemanas / 4), s = plazoSemanas % 4; if (m === 0) return `${plazoSemanas} sem.`; if (s === 0) return `${m} mes${m !== 1 ? "es" : ""}`; return `${m} mes${m !== 1 ? "es" : ""} y ${s} sem.`; }, [plazoSemanas]);
  const formInvalid = saving || !socioId || !monto || monto <= 0 || plazoSemanas <= 0 || tasaAnual < 0 || excedeMaximo || excedePlazo;

  async function crearPrestamo() {
    try {
      setError(null); setSuccess(null);
      if (!socioId) throw new Error("Selecciona un socio");
      if (!monto || monto <= 0) throw new Error("Monto inválido");
      if (rondaInfo && monto > rondaInfo.fondoDisponible) throw new Error(`El monto no puede exceder el fondo disponible (${fmtMoney(rondaInfo.fondoDisponible)}).`);
      if (maxPlazoSemanas != null && plazoSemanas > maxPlazoSemanas) throw new Error(`El plazo no puede exceder ${maxPlazoSemanas} semanas.`);
      setSaving(true);
      const res = await fetch("/api/prestamos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ socioId, monto, tasaAnual, plazoSemanas, fechaInicio }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo crear el préstamo");
      setPrestamoCreado(data?.prestamo ?? null);
      setSuccess("Préstamo creado correctamente");
      if (rondaInfo) setRondaInfo(prev => prev ? { ...prev, fondoPrestado: prev.fondoPrestado + monto, fondoDisponible: Math.max(0, prev.fondoDisponible - monto) } : prev);
    } catch (e: any) { setError(e?.message ?? "Error"); }
    finally { setSaving(false); }
  }

  if (loadingRonda) return <div className="p-4 space-y-3"><div className="h-32 animate-pulse rounded-xl bg-gray-100" /><div className="h-64 animate-pulse rounded-xl bg-gray-100" /></div>;
  if (sinRonda) return <SinRondaActiva />;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/>
                <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z" clipRule="evenodd"/>
              </svg>
            </span>
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl font-semibold tracking-tight">Solicitud de préstamo</h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {rondaInfo?.nombre}
                {maxPlazoSemanas != null && <> · Plazo máx: <strong className="text-orange-700">{maxPlazoSemanas} sem.</strong></>}
              </p>
            </div>
          </div>
          <Link href="/prestamos/pendientes" className="shrink-0 rounded-lg border px-3 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-50">Ver pendientes</Link>
        </div>

        {/* Fondo — 3 chips en móvil */}
        {rondaInfo && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <p className="text-[10px] sm:text-xs text-blue-600 font-medium">Fondo total</p>
              <p className="mt-0.5 text-sm sm:text-xl font-bold text-blue-800 tabular-nums truncate">{fmtMoney(rondaInfo.fondoTotal)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <p className="text-[10px] sm:text-xs text-amber-600 font-medium">Prestado</p>
              <p className="mt-0.5 text-sm sm:text-xl font-bold text-amber-800 tabular-nums truncate">{fmtMoney(rondaInfo.fondoPrestado)}</p>
            </div>
            <div className={cn("rounded-lg border p-3", rondaInfo.fondoDisponible > 0 ? "bg-emerald-50 border-emerald-100" : "bg-gray-50 border-gray-200")}>
              <p className={cn("text-[10px] sm:text-xs font-medium", rondaInfo.fondoDisponible > 0 ? "text-emerald-600" : "text-gray-500")}>Disponible</p>
              <p className={cn("mt-0.5 text-sm sm:text-xl font-bold tabular-nums truncate", rondaInfo.fondoDisponible > 0 ? "text-emerald-800" : "text-gray-400")}>{fmtMoney(rondaInfo.fondoDisponible)}</p>
            </div>
          </div>
        )}
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {prestamoCreado && (
        <div className="rounded-xl border bg-white p-4 shadow-sm flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-sm">✅ Préstamo creado</p>
            <p className="text-xs text-gray-500 mt-0.5">{prestamoCreado.socio.nombres} · {fmtMoney(prestamoCreado.monto)}</p>
          </div>
          <Link href="/prestamos/pendientes" className="shrink-0 rounded-lg bg-orange-600 px-3 py-2 text-xs font-medium text-white hover:bg-orange-700">Ir a pendientes</Link>
        </div>
      )}

      {/* Tabs móvil */}
      <div className="flex rounded-lg border bg-gray-50 p-1 lg:hidden">
        <button onClick={() => setMobileTab("form")}
          className={cn("flex-1 rounded-md py-2 text-sm font-medium transition-colors", mobileTab === "form" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
          Formulario
        </button>
        <button onClick={() => setMobileTab("amortizacion")}
          className={cn("flex-1 rounded-md py-2 text-sm font-medium transition-colors", mobileTab === "amortizacion" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
          Amortización {preview.length > 0 && <span className="ml-1 text-xs text-orange-600">({preview.length})</span>}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">

        {/* ── Formulario ── */}
        <section className={cn("rounded-xl border bg-white p-4 sm:p-6 shadow-sm", mobileTab !== "form" && "hidden lg:block")}>
          <h2 className="mb-4 text-base font-semibold text-gray-900">Datos del préstamo</h2>
          <div className="grid gap-4">

            {/* Socio */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Socio</label>
              <input value={qSocio} onChange={e => setQSocio(e.target.value)} placeholder="Buscar…"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200" />
              <div className="mt-2 max-h-44 overflow-auto rounded-lg border">
                {loadingSocios ? <div className="p-3 text-sm text-gray-500">Cargando...</div>
                  : sociosFiltrados.length === 0 ? <div className="p-3 text-sm text-gray-500">Sin coincidencias.</div>
                  : <ul className="divide-y">
                      {sociosFiltrados.map(s => (
                        <li key={s.id}>
                          <button type="button" onClick={() => setSocioId(s.id)}
                            className={cn("w-full text-left p-3 hover:bg-gray-50", s.id === socioId && "bg-orange-50")}>
                            <p className="font-medium text-gray-900 truncate text-sm">{s.nombres} {s.apellidos}</p>
                            <p className="text-xs text-gray-500 font-mono">{s.numeroCuenta}</p>
                          </button>
                        </li>
                      ))}
                    </ul>}
              </div>
              {socioSeleccionado && <p className="mt-1 text-xs text-emerald-600">✓ <strong>{socioSeleccionado.nombres} {socioSeleccionado.apellidos}</strong></p>}
            </div>

            {/* Monto */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Monto</label>
              <input type="number" min={0} step="0.01" value={monto || ""} onChange={e => setMonto(Number(e.target.value))} placeholder="0.00"
                className={cn("w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1", excedeMaximo ? "border-red-300 focus:ring-red-200" : "focus:border-orange-500 focus:ring-orange-200")} />
              {rondaInfo && <p className={cn("mt-1 text-xs", excedeMaximo ? "text-red-600 font-medium" : "text-gray-400")}>
                {excedeMaximo ? "⚠️ Excede fondo. " : ""}Disponible: <strong>{fmtMoney(rondaInfo.fondoDisponible)}</strong>
              </p>}
            </div>

            {/* Interés + Plazo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Interés mensual (%)</label>
                <input type="number" min={0} step="0.01" value={tasaAnual} onChange={e => setTasaAnual(Number(e.target.value))}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Plazo (semanas)</label>
                <input type="number" min={1} step="1" value={plazoSemanas} onChange={e => setPlazoSemanas(Number(e.target.value))}
                  className={cn("w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1", excedePlazo ? "border-red-300 focus:ring-red-200" : "focus:border-orange-500 focus:ring-orange-200")} />
                <p className={cn("mt-1 text-xs", excedePlazo ? "text-red-600 font-medium" : "text-gray-400")}>
                  {excedePlazo ? `⚠️ Máx. ${maxPlazoSemanas} · ` : ""}{plazoInfo}
                </p>
              </div>
            </div>

            {/* Fecha */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de inicio</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200" />
            </div>

            {/* Resumen rápido móvil */}
            {preview.length > 0 && (
              <div className="rounded-lg bg-orange-50 border border-orange-100 p-3 text-xs space-y-1 lg:hidden">
                <div className="flex justify-between"><span className="text-gray-500">Cuotas</span><strong>{preview.length}</strong></div>
                <div className="flex justify-between"><span className="text-gray-500">Cuota base</span><strong>{fmtMoney(preview[0]?.cuota)}</strong></div>
                <div className="flex justify-between"><span className="text-gray-500">Interés total</span><strong className="text-amber-700">{fmtMoney(totals.totalInteres)}</strong></div>
                <div className="flex justify-between border-t pt-1"><span className="text-gray-500">Total a pagar</span><strong className="text-orange-700">{fmtMoney(totals.totalPagado)}</strong></div>
              </div>
            )}

            <button onClick={crearPrestamo} disabled={formInvalid}
              className={cn("mt-1 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white", formInvalid ? "bg-orange-300 cursor-not-allowed" : "bg-orange-600 hover:bg-orange-700")}>
              {saving ? "Guardando…" : "Crear préstamo"}
            </button>
          </div>
        </section>

        {/* ── Amortización ── */}
        <section className={cn("rounded-xl border bg-white shadow-sm lg:col-span-2 overflow-hidden", mobileTab !== "amortizacion" && "hidden lg:block")}>
          <div className="border-b bg-gray-50 p-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Amortización</h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {preview.length ? (<>
                  Cuota: <strong>{fmtMoney(preview[0]?.cuota)}</strong>
                  <span className="mx-1.5 text-gray-300">·</span>
                  Interés: <strong className="text-amber-700">{fmtMoney(totals.totalInteres)}</strong>
                  <span className="mx-1.5 text-gray-300">·</span>
                  Total: <strong>{fmtMoney(totals.totalPagado)}</strong>
                </>) : "Completa los datos para ver la tabla."}
              </p>
            </div>
            {preview.length > 0 && (
              <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">{preview.length} cuota{preview.length !== 1 ? "s" : ""} · {plazoInfo}</span>
            )}
          </div>

          {/* Tabla desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Vence</th>
                  <th className="px-4 py-3 text-right">Cuota</th>
                  <th className="px-4 py-3 text-right">Interés</th>
                  <th className="px-4 py-3 text-right">Capital</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {preview.length === 0
                  ? <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">Ingresa los datos para generar la amortización.</td></tr>
                  : preview.map(c => (
                    <tr key={c.numero} className={cn("border-t hover:bg-gray-50/70", c.esParcial && "bg-amber-50/50")}>
                      <td className="px-4 py-3 font-medium">{c.numero}</td>
                      <td className="px-4 py-3 text-gray-700">{fmtDate(c.fechaVenc)}{c.esParcial && <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">parcial</span>}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtMoney(c.cuota)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmtMoney(c.interes)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{fmtMoney(c.capital)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(c.saldo)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas móvil amortización */}
          <ul className="sm:hidden divide-y">
            {preview.length === 0
              ? <li className="p-8 text-center text-sm text-gray-400">Ingresa los datos del formulario para ver la amortización.</li>
              : preview.map(c => (
                <li key={c.numero} className={cn("p-3 space-y-2", c.esParcial && "bg-amber-50/40")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">{c.numero}</span>
                      <span className="text-sm text-gray-700">{fmtDate(c.fechaVenc)}</span>
                      {c.esParcial && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">parcial</span>}
                    </div>
                    <span className="font-semibold text-sm tabular-nums">{fmtMoney(c.cuota)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <div className="rounded bg-amber-50 p-1.5">
                      <p className="text-amber-500">Interés</p>
                      <p className="font-semibold text-amber-700 tabular-nums">{fmtMoney(c.interes)}</p>
                    </div>
                    <div className="rounded bg-emerald-50 p-1.5">
                      <p className="text-emerald-500">Capital</p>
                      <p className="font-semibold text-emerald-700 tabular-nums">{fmtMoney(c.capital)}</p>
                    </div>
                    <div className="rounded bg-gray-50 p-1.5">
                      <p className="text-gray-400">Saldo</p>
                      <p className="font-semibold text-gray-700 tabular-nums">{fmtMoney(c.saldo)}</p>
                    </div>
                  </div>
                </li>
              ))}
          </ul>

          <div className="border-t bg-gray-50 px-4 py-2.5 text-xs text-gray-400">
            Cuota mensual cada 4 semanas · Interés = capital × % mensual · Última cuota proporcional si hay semanas sobrantes
          </div>
        </section>
      </div>
    </div>
  );
}
