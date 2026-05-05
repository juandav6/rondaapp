// app/prestamos/solicitud/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Socio = {
  id: number;
  numeroCuenta: string;
  nombres: string;
  apellidos: string;
};

type CuotaPreview = {
  numero: number;
  fechaVenc: string; // ISO
  cuota: number;
  interes: number;
  capital: number;
  saldo: number;
};

type PrestamoCreado = {
  id: number;
  estado: string;
  monto: number;
  tasaAnual: number; // (lo seguimos llamando así para no romper tu API, pero se usa como % total del préstamo)
  plazoMeses: number;
  fechaInicio: string;
  saldoActual: number;
  ronda: {
    id: number;
    nombre: string;
    activa: boolean;
    fechaInicio: string;
    fechaFin: string | null;
  };
  socio: { id: number; numeroCuenta: string; nombres: string; apellidos: string };
  cuotas: Array<{
    id: number;
    numero: number;
    fechaVenc: string;
    cuota: number;
    interes: number;
    capital: number;
    saldo: number;
    pagada: boolean;
    fechaPago: string | null;
  }>;
};

// ===== Utils =====
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const fmtMoney = (n: number | null | undefined, locale = "es-EC", currency = "USD") => {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(n));
};

const fmtDate = (iso: string | null | undefined, locale = "es-EC") => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

const todayDateOnly = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * ✅ NUEVA FÓRMULA (interés plano):
 * interes_mensual = (valor * %interes) / nro_meses
 * capital_mensual = valor / nro_meses
 * cuota = interes_mensual + capital_mensual (fija)
 *
 * Nota: `tasaAnual` aquí se usa como "% de interés total del préstamo" (no anual),
 * para respetar tu UI/API actual.
 */
function buildPreviewSchedule(params: {
  principal: number;
  tasaInteresPct: number;
  plazoMeses: number;
  fechaInicio: string;
}) {
  const P = params.principal;
  const n = params.plazoMeses;
  const pct = params.tasaInteresPct / 100;

  if (!P || P <= 0 || !n || n <= 0 || params.tasaInteresPct < 0) return [];

  const start = new Date(`${params.fechaInicio}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];

  // ✅ Interés mensual fijo = principal × tasa mensual
  const interesMensual = round2(P * pct);      // $300 × 2% = $6/mes
  const capitalMensual = round2(P / n);         // $300 / 6 = $50/mes

  let saldo = P;
  const out: CuotaPreview[] = [];

  for (let i = 1; i <= n; i++) {
    const capital = i === n ? round2(saldo) : capitalMensual;
    const newSaldo = round2(saldo - capital);
    const fechaVenc = addMonths(start, i).toISOString();

    out.push({
      numero: i,
      fechaVenc,
      cuota: round2(interesMensual + capital),  // $6 + $50 = $56/mes
      interes: interesMensual,
      capital,
      saldo: newSaldo,
    });

    saldo = newSaldo;
  }

  return out;
}

export default function PrestamoSolicitudPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [loadingSocios, setLoadingSocios] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  // ✅ Límite por ahorros de la ronda
  const [maxMontoRonda, setMaxMontoRonda] = useState<number | null>(null);
  const [rondaActivaInfo, setRondaActivaInfo] = useState<{ id: number; nombre: string } | null>(null);

  // form
  const [qSocio, setQSocio] = useState("");
  const [socioId, setSocioId] = useState<number | null>(null);
  const [monto, setMonto] = useState<number>(0);

  // OJO: lo seguimos llamando "tasaAnual" para no romper tu payload,
  // pero ahora se interpreta como "% total del préstamo".
  const [tasaAnual, setTasaAnual] = useState<number>(24);

  const [plazoMeses, setPlazoMeses] = useState<number>(6);
  const [fechaInicio, setFechaInicio] = useState<string>(todayDateOnly());

  const [prestamoCreado, setPrestamoCreado] = useState<PrestamoCreado | null>(null);

  useEffect(() => {
    setLoadingSocios(true);
    fetch("/api/socios")
      .then((r) => r.json())
      .then((data) => setSocios(Array.isArray(data) ? data : []))
      .catch(() => setSocios([]))
      .finally(() => setLoadingSocios(false));
  }, []);

  // ✅ intenta obtener el máximo permitido (ahorros totales de la ronda activa)
  useEffect(() => {
    let alive = true;

    async function loadMax() {
      try {
        // Intenta varios endpoints (elige el que tengas). El primero que responda, gana.
        const candidates = [
          "/api/rondas/activa/resumen", // ideal: { ronda: {id,nombre}, totalAhorrosRonda }
          "/api/rondas/activa", // alternativa: { id, nombre, totalAhorros } o similar
          "/api/rondas/actual/resumen",
          "/api/rondas/actual",
        ];

        for (const url of candidates) {
          const r = await fetch(url);
          if (!r.ok) continue;
          const data = await r.json().catch(() => null);

          // Normaliza posibles shapes
          const ronda =
            data?.ronda ??
            (data?.id ? { id: data.id, nombre: data.nombre } : null);

          const totalAhorros =
            data?.totalAhorrosRonda ??
            data?.totalAhorros ??
            data?.total_ahorros ??
            data?.resumen?.totalAhorros ??
            data?.resumen?.total_ahorros ??
            null;

          if (alive && ronda?.id && typeof totalAhorros === "number") {
            setRondaActivaInfo({ id: Number(ronda.id), nombre: String(ronda.nombre ?? "Ronda activa") });
            setMaxMontoRonda(Number(totalAhorros));
            return;
          }
        }

        // si no hay endpoint aún, dejamos null (no bloquea)
        if (alive) {
          setMaxMontoRonda(null);
          setRondaActivaInfo(null);
        }
      } catch {
        if (alive) {
          setMaxMontoRonda(null);
          setRondaActivaInfo(null);
        }
      }
    }

    loadMax();
    return () => {
      alive = false;
    };
  }, []);

  const socioSeleccionado = useMemo(() => socios.find((s) => s.id === socioId) ?? null, [socios, socioId]);

  const sociosFiltrados = useMemo(() => {
    const s = qSocio.trim().toLowerCase();
    if (!s) return socios.slice(0, 30);
    return socios
      .filter((x) => [x.nombres, x.apellidos, x.numeroCuenta].some((v) => String(v).toLowerCase().includes(s)))
      .slice(0, 30);
  }, [socios, qSocio]);

  const preview = useMemo(() => {
    return buildPreviewSchedule({
      principal: Number(monto),
      tasaInteresPct: Number(tasaAnual),
      plazoMeses: Number(plazoMeses),
      fechaInicio,
    });
  }, [monto, tasaAnual, plazoMeses, fechaInicio]);

  const totals = useMemo(() => {
    const totalInteres = round2(preview.reduce((acc, c) => acc + (c.interes || 0), 0));
    const totalPagado = round2(preview.reduce((acc, c) => acc + (c.cuota || 0), 0));
    return { totalInteres, totalPagado };
  }, [preview]);

  const excedeMaximo = useMemo(() => {
    if (maxMontoRonda == null) return false;
    if (!monto) return false;
    return Number(monto) > Number(maxMontoRonda);
  }, [monto, maxMontoRonda]);

  async function crearPrestamo() {
    try {
      setError(null);
      setSuccess(null);

      if (!socioId) throw new Error("Selecciona un socio");
      if (!monto || monto <= 0) throw new Error("Monto inválido");
      if (tasaAnual == null || tasaAnual < 0) throw new Error("Interés (%) inválido");
      if (!plazoMeses || plazoMeses <= 0) throw new Error("Plazo inválido");
      if (!fechaInicio) throw new Error("Fecha de inicio requerida");

      // ✅ regla: no puede exceder ahorros de la ronda
      if (maxMontoRonda != null && Number(monto) > Number(maxMontoRonda)) {
        throw new Error(`El monto del préstamo no puede exceder los ahorros de la ronda (${fmtMoney(maxMontoRonda)}).`);
      }

      setSaving(true);
      const res = await fetch("/api/prestamos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socioId,
          monto: Number(monto),
          tasaAnual: Number(tasaAnual), // (se usa como % total)
          plazoMeses: Number(plazoMeses),
          fechaInicio,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo crear el préstamo");

      setPrestamoCreado(data?.prestamo ?? null);
      setSuccess("Préstamo creado correctamente");
    } catch (e: any) {
      setError(e?.message ?? "Error al crear préstamo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-orange-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 1.5a10.5 10.5 0 1 0 10.5 10.5A10.512 10.512 0 0 0 12 1.5Zm.75 6a.75.75 0 0 0-1.5 0v4.19c0 .3.18.57.46.69l3.75 1.6a.75.75 0 1 0 .58-1.38l-3.29-1.4Z" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Solicitud de préstamo</h1>
              <p className="text-sm text-gray-600">
                Genera amortización y registra el préstamo en la ronda activa.
              </p>
              {maxMontoRonda != null && (
                <p className="mt-1 text-xs text-gray-500">
                  Límite por ahorros{rondaActivaInfo ? ` (${rondaActivaInfo.nombre})` : ""}:{" "}
                  <strong className="text-gray-800">{fmtMoney(maxMontoRonda)}</strong>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/prestamos/pendientes" className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Ver pendientes
            </Link>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-700">{success}</div>}

      {/* Created */}
      {prestamoCreado && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">✅ Préstamo creado</h2>
              <p className="mt-1 text-sm text-gray-600">
                Socio: <strong>{prestamoCreado.socio.nombres} {prestamoCreado.socio.apellidos}</strong>{" "}
                <span className="mx-2 text-gray-300">•</span>
                Monto: <strong>{fmtMoney(prestamoCreado.monto)}</strong>{" "}
                <span className="mx-2 text-gray-300">•</span>
                Estado: <strong>{prestamoCreado.estado}</strong>
              </p>
            </div>
            <Link href="/prestamos/pendientes" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
              Ir a pendientes
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-orange-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M3 6.75A2.25 2.25 0 0 1 5.25 4.5h13.5A2.25 2.25 0 0 1 21 6.75v10.5A2.25 2.25 0 0 1 18.75 19.5H5.25A2.25 2.25 0 0 1 3 17.25V6.75Zm3 .75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5H6Z" />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Datos del préstamo</h2>
              <p className="text-sm text-gray-600">Selecciona socio, monto, interés (%) y plazo.</p>
            </div>
          </div>

          <div className="grid gap-4">
            {/* Socio */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Socio</label>
              <div className="relative">
                <input
                  value={qSocio}
                  onChange={(e) => setQSocio(e.target.value)}
                  placeholder="Buscar por nombre o cuenta…"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">⌘K</span>
              </div>

              <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
                {loadingSocios ? (
                  <div className="p-3 text-sm text-gray-600">Cargando...</div>
                ) : sociosFiltrados.length === 0 ? (
                  <div className="p-3 text-sm text-gray-600">No hay coincidencias.</div>
                ) : (
                  <ul className="divide-y">
                    {sociosFiltrados.map((s) => {
                      const active = s.id === socioId;
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => setSocioId(s.id)}
                            className={cn("w-full text-left p-3 hover:bg-gray-50", active && "bg-orange-50")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-gray-900">
                                  {s.nombres} {s.apellidos}
                                </p>
                                <p className="truncate text-xs text-gray-500">
                                  Cuenta <span className="font-mono">{s.numeroCuenta}</span>
                                </p>
                              </div>
                              {active && (
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                                  Seleccionado
                                </span>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {socioSeleccionado && (
                <p className="mt-2 text-xs text-gray-500">
                  Socio seleccionado:{" "}
                  <strong>
                    {socioSeleccionado.nombres} {socioSeleccionado.apellidos}
                  </strong>
                </p>
              )}
            </div>

            {/* Monto */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Monto (principal)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={monto || ""}
                onChange={(e) => setMonto(Number(e.target.value))}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1",
                  excedeMaximo
                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                    : "focus:border-orange-500 focus:ring-orange-200"
                )}
                placeholder="0.00"
              />
              {maxMontoRonda != null && (
                <p className={cn("mt-1 text-xs", excedeMaximo ? "text-red-600" : "text-gray-500")}>
                  Máximo permitido: <strong>{fmtMoney(maxMontoRonda)}</strong>
                </p>
              )}
            </div>

            {/* Interés y plazo */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Interés (%)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={tasaAnual}
                  onChange={(e) => setTasaAnual(Number(e.target.value))}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Interés total del préstamo (se reparte entre los meses).
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Plazo (meses)</label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={plazoMeses}
                  onChange={(e) => setPlazoMeses(Number(e.target.value))}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
                />
              </div>
            </div>

            {/* Fecha inicio */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
              />
              <p className="mt-1 text-xs text-gray-500">Las cuotas se vencen mes a mes desde esta fecha.</p>
            </div>

            <button
              onClick={crearPrestamo}
              disabled={
                saving ||
                !socioId ||
                !monto ||
                monto <= 0 ||
                !plazoMeses ||
                plazoMeses <= 0 ||
                tasaAnual < 0 ||
                excedeMaximo
              }
              className={cn(
                "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white",
                saving ||
                  !socioId ||
                  !monto ||
                  monto <= 0 ||
                  !plazoMeses ||
                  plazoMeses <= 0 ||
                  tasaAnual < 0 ||
                  excedeMaximo
                  ? "bg-orange-300 opacity-80"
                  : "bg-orange-600 hover:bg-orange-700"
              )}
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                    <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" />
                  </svg>
                  Guardando…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm1 14.59 5.3-5.3a1 1 0 0 0-1.42-1.42L13 13.76l-2.3-2.29a1 1 0 0 0-1.42 1.42l3 3a1 1 0 0 0 1.42 0Z" />
                  </svg>
                  Crear préstamo
                </>
              )}
            </button>

            <p className="text-xs text-gray-500">
              Nota: se asigna automáticamente a la <strong>ronda activa</strong>.
            </p>
          </div>
        </section>

        {/* Preview */}
        <section className="rounded-xl border bg-white shadow-sm lg:col-span-2 overflow-hidden">
          <div className="border-b bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Amortización (previsualización)</h2>
                <p className="text-sm text-gray-600">
                  {preview.length ? (
                    <>
                      Cuota aprox.: <strong>{fmtMoney(preview[0].cuota)}</strong>{" "}
                      <span className="mx-2 text-gray-300">•</span>
                      Interés total aprox.:{" "}
                      <strong className="text-amber-700">{fmtMoney(totals.totalInteres)}</strong>{" "}
                      <span className="mx-2 text-gray-300">•</span>
                      Total a pagar aprox.: <strong>{fmtMoney(totals.totalPagado)}</strong>
                    </>
                  ) : (
                    "Completa los datos para ver la tabla."
                  )}
                </p>
              </div>

              {preview.length > 0 && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  {plazoMeses} cuotas
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600 sticky top-0 z-10">
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
                {preview.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-600">
                      Ingresa socio, monto, interés, plazo y fecha para generar la amortización.
                    </td>
                  </tr>
                ) : (
                  preview.map((c) => (
                    <tr key={c.numero} className="border-t hover:bg-gray-50/70">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.numero}</td>
                      <td className="px-4 py-3 text-gray-700">{fmtDate(c.fechaVenc)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(c.cuota)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmtMoney(c.interes)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{fmtMoney(c.capital)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(c.saldo)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t bg-gray-50 p-4 text-xs text-gray-600">
            Fórmula usada: <strong>valor × %interés mensual</strong> por cuota (interés plano sobre saldo inicial).
          </div>
        </section>
      </div>
    </div>
  );
}
