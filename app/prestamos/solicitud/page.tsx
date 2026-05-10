// app/prestamos/solicitud/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Socio = { id: number; numeroCuenta: string; nombres: string; apellidos: string };

type CuotaPreview = {
  numero: number; fechaVenc: string; cuota: number;
  interes: number; capital: number; saldo: number; esParcial?: boolean;
};

type PrestamoCreado = {
  id: number; estado: string; monto: number; tasaAnual: number;
  plazoMeses: number; fechaInicio: string; saldoActual: number;
  ronda: { id: number; nombre: string; activa: boolean; fechaInicio: string; fechaFin: string | null };
  socio: { id: number; numeroCuenta: string; nombres: string; apellidos: string };
  cuotas: Array<{ id: number; numero: number; fechaVenc: string; cuota: number; interes: number; capital: number; saldo: number; pagada: boolean; fechaPago: string | null }>;
};

type RondaInfo = {
  id: number;
  nombre: string;
  fechaFin: string | null;
  totalParticipantes: number;
  fondoTotal: number;
  fondoPrestado: number;
  fondoDisponible: number;
};

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const fmtMoney = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n));
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

const todayDateOnly = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function addDays(date: Date, days: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + days); return d;
}

function buildPreviewSchedule(params: {
  principal: number; tasaMensualPct: number;
  plazoSemanas: number; fechaInicio: string;
}): CuotaPreview[] {
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
  let saldo = P;
  let diaAcumulado = 0;
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-orange-50 border-2 border-orange-100 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10 text-orange-300">
          <path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" />
          <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM18.75 9a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM4.5 9.75A.75.75 0 0 1 5.25 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75V9.75Z" clipRule="evenodd" />
          <path d="M2.25 18a.75.75 0 0 0 0 1.5c5.4 0 10.63.722 15.6 2.075 1.19.324 2.4-.558 2.4-1.82V18.75a.75.75 0 0 0-.75-.75H2.25Z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">No hay una ronda activa</h2>
      <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-8">
        Los préstamos se otorgan con el fondo de inversión de la ronda activa.
        Primero debes crear e iniciar una ronda para poder solicitar préstamos.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/rondas/registro_ronda"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
          + Crear nueva ronda
        </Link>
        <Link href="/prestamos/pendientes"
          className="inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
          Ver préstamos existentes
        </Link>
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

  // Cargar socios
  useEffect(() => {
    fetch("/api/socios")
      .then(r => r.json())
      .then(d => setSocios(Array.isArray(d) ? d : []))
      .catch(() => setSocios([]))
      .finally(() => setLoadingSocios(false));
  }, []);

  // Cargar ronda activa y fondo
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoadingRonda(true);
        const rRes = await fetch("/api/rondas");
        if (rRes.status === 204 || !rRes.ok) {
          if (alive) { setSinRonda(true); setLoadingRonda(false); }
          return;
        }
        const rData = await rRes.json();
        if (!alive || !rData?.id) {
          if (alive) { setSinRonda(true); setLoadingRonda(false); }
          return;
        }

        const rondaId = Number(rData.id);
        const fechaFin: string | null = rData.fechaFinISO ?? rData.fechaFinDate ?? null;

        // Máximo de semanas = número de participantes
        const totalParticipantes = Array.isArray(rData.participaciones)
          ? rData.participaciones.length
          : 0;

        // Fondo de inversión
        let fondoTotal = 0;
        try {
          const invRes = await fetch(`/api/rondas/${rondaId}/inversion`);
          if (invRes.ok) {
            const invData = await invRes.json();
            fondoTotal = Number(invData?.totalFondo ?? 0);
          }
        } catch { }

        // Total prestado
        let fondoPrestado = 0;
        try {
          const presRes = await fetch("/api/prestamos");
          if (presRes.ok) {
            const presData = await presRes.json();
            const prestamos = Array.isArray(presData?.prestamos) ? presData.prestamos : [];
            fondoPrestado = prestamos
              .filter((p: any) => p.ronda?.id === rondaId && p.estado === "ACTIVO")
              .reduce((acc: number, p: any) => acc + Number(p.monto ?? 0), 0);
          }
        } catch { }

        if (alive) {
          setRondaInfo({
            id: rondaId,
            nombre: String(rData.nombre ?? "Ronda activa"),
            fechaFin,
            totalParticipantes,
            fondoTotal,
            fondoPrestado,
            fondoDisponible: Math.max(0, fondoTotal - fondoPrestado),
          });
          setSinRonda(false);
        }
      } catch {
        if (alive) setSinRonda(true);
      } finally {
        if (alive) setLoadingRonda(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  // Máximo de semanas basado en participantes (no en fechas)
  const maxPlazoSemanas = useMemo(() => {
    if (!rondaInfo?.totalParticipantes) return null;
    return rondaInfo.totalParticipantes;
  }, [rondaInfo]);

  const excedeMaximo = useMemo(() =>
    rondaInfo != null && !!monto && monto > rondaInfo.fondoDisponible,
    [monto, rondaInfo]
  );
  const excedePlazo = useMemo(() =>
    maxPlazoSemanas != null && plazoSemanas > maxPlazoSemanas,
    [plazoSemanas, maxPlazoSemanas]
  );

  const socioSeleccionado = useMemo(() => socios.find(s => s.id === socioId) ?? null, [socios, socioId]);
  const sociosFiltrados = useMemo(() => {
    const s = qSocio.trim().toLowerCase();
    if (!s) return socios.slice(0, 30);
    return socios.filter(x => [x.nombres, x.apellidos, x.numeroCuenta].some(v => v.toLowerCase().includes(s))).slice(0, 30);
  }, [socios, qSocio]);

  const preview = useMemo(() =>
    buildPreviewSchedule({ principal: monto, tasaMensualPct: tasaAnual, plazoSemanas, fechaInicio }),
    [monto, tasaAnual, plazoSemanas, fechaInicio]
  );
  const totals = useMemo(() => ({
    totalInteres: round2(preview.reduce((a, c) => a + c.interes, 0)),
    totalPagado: round2(preview.reduce((a, c) => a + c.cuota, 0)),
  }), [preview]);

  const plazoInfo = useMemo(() => {
    const m = Math.floor(plazoSemanas / 4), s = plazoSemanas % 4;
    if (m === 0) return `${plazoSemanas} sem.`;
    if (s === 0) return `${m} mes${m !== 1 ? "es" : ""}`;
    return `${m} mes${m !== 1 ? "es" : ""} y ${s} sem.`;
  }, [plazoSemanas]);

  const formInvalid = saving || !socioId || !monto || monto <= 0 || plazoSemanas <= 0 || tasaAnual < 0 || excedeMaximo || excedePlazo;

  async function crearPrestamo() {
    try {
      setError(null); setSuccess(null);
      if (!socioId) throw new Error("Selecciona un socio");
      if (!monto || monto <= 0) throw new Error("Monto inválido");
      if (tasaAnual < 0) throw new Error("Interés inválido");
      if (plazoSemanas <= 0) throw new Error("Plazo inválido");
      if (!fechaInicio) throw new Error("Fecha de inicio requerida");
      if (rondaInfo && monto > rondaInfo.fondoDisponible)
        throw new Error(`El monto no puede exceder el fondo disponible (${fmtMoney(rondaInfo.fondoDisponible)}).`);
      if (maxPlazoSemanas != null && plazoSemanas > maxPlazoSemanas)
        throw new Error(`El plazo no puede exceder ${maxPlazoSemanas} semanas (${maxPlazoSemanas} participantes).`);
      setSaving(true);
      const res = await fetch("/api/prestamos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId, monto, tasaAnual, plazoSemanas, fechaInicio }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo crear el préstamo");
      setPrestamoCreado(data?.prestamo ?? null);
      setSuccess("Préstamo creado correctamente");
      if (rondaInfo) setRondaInfo(prev => prev ? {
        ...prev,
        fondoPrestado: prev.fondoPrestado + monto,
        fondoDisponible: Math.max(0, prev.fondoDisponible - monto),
      } : prev);
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally { setSaving(false); }
  }

  if (loadingRonda) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (sinRonda) return <SinRondaActiva />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-orange-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" />
                <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM18.75 9a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM4.5 9.75A.75.75 0 0 1 5.25 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75V9.75Z" clipRule="evenodd" />
                <path d="M2.25 18a.75.75 0 0 0 0 1.5c5.4 0 10.63.722 15.6 2.075 1.19.324 2.4-.558 2.4-1.82V18.75a.75.75 0 0 0-.75-.75H2.25Z" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Solicitud de préstamo</h1>
              <p className="text-sm text-gray-500">
                Ronda: <strong className="text-gray-800">{rondaInfo?.nombre}</strong>
                {rondaInfo?.fechaFin && <> · Fin: <strong className="text-gray-800">{fmtDate(rondaInfo.fechaFin)}</strong></>}
                {maxPlazoSemanas != null && (
                  <> · Plazo máx: <strong className="text-orange-700">{maxPlazoSemanas} sem.</strong>
                  <span className="text-gray-400"> ({rondaInfo?.totalParticipantes} participantes)</span></>
                )}
              </p>
            </div>
          </div>
          <Link href="/prestamos/pendientes" className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Ver pendientes
          </Link>
        </div>

        {/* Fondo de inversión */}
        {rondaInfo && (
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
              <p className="text-xs text-blue-600 font-medium">Fondo total de inversión</p>
              <p className="mt-1 text-xl font-bold text-blue-800 tabular-nums">{fmtMoney(rondaInfo.fondoTotal)}</p>
              <p className="text-xs text-blue-500 mt-0.5">Aportado por los socios</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
              <p className="text-xs text-amber-600 font-medium">Ya prestado</p>
              <p className="mt-1 text-xl font-bold text-amber-800 tabular-nums">{fmtMoney(rondaInfo.fondoPrestado)}</p>
              <p className="text-xs text-amber-500 mt-0.5">Préstamos activos</p>
            </div>
            <div className={cn("rounded-lg border p-4", rondaInfo.fondoDisponible > 0 ? "bg-emerald-50 border-emerald-100" : "bg-gray-50 border-gray-200")}>
              <p className={cn("text-xs font-medium", rondaInfo.fondoDisponible > 0 ? "text-emerald-600" : "text-gray-500")}>Disponible para préstamos</p>
              <p className={cn("mt-1 text-xl font-bold tabular-nums", rondaInfo.fondoDisponible > 0 ? "text-emerald-800" : "text-gray-400")}>
                {fmtMoney(rondaInfo.fondoDisponible)}
              </p>
              <p className={cn("text-xs mt-0.5", rondaInfo.fondoDisponible > 0 ? "text-emerald-500" : "text-gray-400")}>
                {rondaInfo.fondoDisponible > 0 ? "Máximo por préstamo" : "Sin fondos disponibles"}
              </p>
            </div>
          </div>
        )}
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-700">{success}</div>}

      {prestamoCreado && (
        <div className="rounded-xl border bg-white p-6 shadow-sm flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">✅ Préstamo creado</h2>
            <p className="mt-1 text-sm text-gray-600">
              Socio: <strong>{prestamoCreado.socio.nombres} {prestamoCreado.socio.apellidos}</strong>
              <span className="mx-2 text-gray-300">·</span>
              Monto: <strong>{fmtMoney(prestamoCreado.monto)}</strong>
            </p>
          </div>
          <Link href="/prestamos/pendientes" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
            Ir a pendientes
          </Link>
        </div>
      )}

      {rondaInfo && rondaInfo.fondoDisponible <= 0 && rondaInfo.fondoTotal > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          ⚠️ El fondo de préstamos está completamente utilizado.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Formulario */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Datos del préstamo</h2>
          <div className="grid gap-4">
            {/* Socio */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Socio</label>
              <input value={qSocio} onChange={e => setQSocio(e.target.value)} placeholder="Buscar…"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200" />
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border">
                {loadingSocios
                  ? <div className="p-3 text-sm text-gray-500">Cargando...</div>
                  : sociosFiltrados.length === 0
                    ? <div className="p-3 text-sm text-gray-500">Sin coincidencias.</div>
                    : <ul className="divide-y">
                        {sociosFiltrados.map(s => (
                          <li key={s.id}>
                            <button type="button" onClick={() => setSocioId(s.id)}
                              className={cn("w-full text-left p-3 hover:bg-gray-50", s.id === socioId && "bg-orange-50")}>
                              <p className="font-medium text-gray-900 truncate">{s.nombres} {s.apellidos}</p>
                              <p className="text-xs text-gray-500 truncate">Cuenta <span className="font-mono">{s.numeroCuenta}</span></p>
                            </button>
                          </li>
                        ))}
                      </ul>
                }
              </div>
              {socioSeleccionado && (
                <p className="mt-1 text-xs text-gray-500">✓ <strong>{socioSeleccionado.nombres} {socioSeleccionado.apellidos}</strong></p>
              )}
            </div>

            {/* Monto */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Monto (principal)</label>
              <input type="number" min={0} step="0.01" value={monto || ""} onChange={e => setMonto(Number(e.target.value))} placeholder="0.00"
                className={cn("w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1",
                  excedeMaximo ? "border-red-300 focus:ring-red-200" : "focus:border-orange-500 focus:ring-orange-200")} />
              {rondaInfo && (
                <p className={cn("mt-1 text-xs", excedeMaximo ? "text-red-600 font-medium" : "text-gray-500")}>
                  {excedeMaximo ? "⚠️ Excede el fondo disponible. " : ""}
                  Disponible: <strong>{fmtMoney(rondaInfo.fondoDisponible)}</strong>
                </p>
              )}
            </div>

            {/* Interés + Plazo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Interés mensual (%)</label>
                <input type="number" min={0} step="0.01" value={tasaAnual} onChange={e => setTasaAnual(Number(e.target.value))}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200" />
                <p className="mt-1 text-xs text-gray-400">% sobre el capital</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Plazo (semanas)</label>
                <input type="number" min={1} step="1" value={plazoSemanas} onChange={e => setPlazoSemanas(Number(e.target.value))}
                  className={cn("w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1",
                    excedePlazo ? "border-red-300 focus:ring-red-200" : "focus:border-orange-500 focus:ring-orange-200")} />
                <p className={cn("mt-1 text-xs", excedePlazo ? "text-red-600 font-medium" : "text-gray-400")}>
                  {excedePlazo ? `⚠️ Máx. ${maxPlazoSemanas} sem. ` : ""}{plazoInfo}
                  {maxPlazoSemanas != null && !excedePlazo && <> · Máx: <strong>{maxPlazoSemanas}</strong></>}
                </p>
              </div>
            </div>

            {/* Fecha */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de inicio</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200" />
            </div>

            <button onClick={crearPrestamo} disabled={formInvalid}
              className={cn("mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-white",
                formInvalid ? "bg-orange-300 cursor-not-allowed" : "bg-orange-600 hover:bg-orange-700")}>
              {saving ? "Guardando…" : "Crear préstamo"}
            </button>
          </div>
        </section>

        {/* Preview amortización */}
        <section className="rounded-xl border bg-white shadow-sm lg:col-span-2 overflow-hidden">
          <div className="border-b bg-gray-50 p-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Amortización (previsualización)</h2>
              <p className="text-sm text-gray-600">
                {preview.length ? (<>
                  Cuota base: <strong>{fmtMoney(preview[0]?.cuota)}</strong>
                  <span className="mx-2 text-gray-300">•</span>
                  Interés total: <strong className="text-amber-700">{fmtMoney(totals.totalInteres)}</strong>
                  <span className="mx-2 text-gray-300">•</span>
                  Total: <strong>{fmtMoney(totals.totalPagado)}</strong>
                </>) : "Completa los datos para ver la tabla."}
              </p>
            </div>
            {preview.length > 0 && (
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 whitespace-nowrap">
                {preview.length} cuota{preview.length !== 1 ? "s" : ""} · {plazoInfo}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
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
                  ? <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Ingresa los datos para generar la amortización.</td></tr>
                  : preview.map(c => (
                    <tr key={c.numero} className={cn("border-t hover:bg-gray-50/70", c.esParcial && "bg-amber-50/50")}>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.numero}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {fmtDate(c.fechaVenc)}
                        {c.esParcial && <span className="ml-2 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">parcial</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtMoney(c.cuota)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmtMoney(c.interes)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{fmtMoney(c.capital)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(c.saldo)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="border-t bg-gray-50 p-4 text-xs text-gray-500">
            Cuota mensual cada 4 semanas · Interés = capital × %mensual · Última cuota proporcional si hay semanas sobrantes
          </div>
        </section>
      </div>
    </div>
  );
}
