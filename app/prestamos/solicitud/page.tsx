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
  tasaAnual: number;
  plazoMeses: number;
  fechaInicio: string;
  saldoActual: number;
  ronda: { id: number; nombre: string; activa: boolean; fechaInicio: string; fechaFin: string | null };
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

// Amortización francesa (cuota fija) preview en front
function buildPreviewSchedule(params: { principal: number; tasaAnual: number; plazoMeses: number; fechaInicio: string }) {
  const P = params.principal;
  const n = params.plazoMeses;
  const r = (params.tasaAnual / 100) / 12;

  if (!P || P <= 0 || !n || n <= 0 || params.tasaAnual < 0) return [];

  const start = new Date(`${params.fechaInicio}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];

  let cuota = 0;
  if (r === 0) cuota = P / n;
  else {
    const pow = Math.pow(1 + r, n);
    cuota = (P * (r * pow)) / (pow - 1);
  }
  cuota = round2(cuota);

  let saldo = P;
  const out: CuotaPreview[] = [];

  for (let i = 1; i <= n; i++) {
    const interes = round2(saldo * r);
    let capital = round2(cuota - interes);
    if (i === n) capital = round2(saldo);
    const newSaldo = round2(saldo - capital);

    const fechaVenc = addMonths(start, i).toISOString();

    out.push({
      numero: i,
      fechaVenc,
      cuota: round2(interes + capital),
      interes,
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

  // form
  const [qSocio, setQSocio] = useState("");
  const [socioId, setSocioId] = useState<number | null>(null);
  const [monto, setMonto] = useState<number>(0);
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

  const socioSeleccionado = useMemo(() => socios.find((s) => s.id === socioId) ?? null, [socios, socioId]);

  const sociosFiltrados = useMemo(() => {
    const s = qSocio.trim().toLowerCase();
    if (!s) return socios.slice(0, 30);
    return socios
      .filter((x) => [x.nombres, x.apellidos, x.numeroCuenta].some((v) => String(v).toLowerCase().includes(s)))
      .slice(0, 30);
  }, [socios, qSocio]);

  const preview = useMemo(() => {
    return buildPreviewSchedule({ principal: Number(monto), tasaAnual: Number(tasaAnual), plazoMeses: Number(plazoMeses), fechaInicio });
  }, [monto, tasaAnual, plazoMeses, fechaInicio]);

  const totals = useMemo(() => {
    const totalInteres = round2(preview.reduce((acc, c) => acc + (c.interes || 0), 0));
    const totalPagado = round2(preview.reduce((acc, c) => acc + (c.cuota || 0), 0));
    return { totalInteres, totalPagado };
  }, [preview]);

  async function crearPrestamo() {
    try {
      setError(null);
      setSuccess(null);

      if (!socioId) throw new Error("Selecciona un socio");
      if (!monto || monto <= 0) throw new Error("Monto inválido");
      if (tasaAnual == null || tasaAnual < 0) throw new Error("Tasa anual inválida");
      if (!plazoMeses || plazoMeses <= 0) throw new Error("Plazo inválido");
      if (!fechaInicio) throw new Error("Fecha de inicio requerida");

      setSaving(true);
      const res = await fetch("/api/prestamos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socioId,
          monto: Number(monto),
          tasaAnual: Number(tasaAnual),
          plazoMeses: Number(plazoMeses),
          fechaInicio,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo crear el préstamo");

      setPrestamoCreado(data?.prestamo ?? null);
      setSuccess("Préstamo creado correctamente");
    } catch (e: any) {
      setError(e?.message ?? "Error al crear el préstamo");
    } finally {
      setSaving(false);
    }
  }

  // ===== UI: Confirmación =====
  if (prestamoCreado) {
    const cuotas = prestamoCreado.cuotas ?? [];
    const totalInteres = round2(cuotas.reduce((acc, c) => acc + Number(c.interes || 0), 0));
    const totalPagado = round2(cuotas.reduce((acc, c) => acc + Number(c.cuota || 0), 0));
    const nextCuota = cuotas.find((c) => !c.pagada) ?? null;

    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm-1.2 13.2-2.6-2.6a1 1 0 1 0-1.4 1.4l3.3 3.3a1 1 0 0 0 1.4 0l6.9-6.9a1 1 0 1 0-1.4-1.4l-6.2 6.2Z" />
                </svg>
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Préstamo creado</h1>
                <p className="text-sm text-gray-600">
                  Socio: <strong>{prestamoCreado.socio.nombres} {prestamoCreado.socio.apellidos}</strong> • Cuenta{" "}
                  <span className="font-mono">{prestamoCreado.socio.numeroCuenta}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Ronda: <strong>{prestamoCreado.ronda.nombre}</strong> {prestamoCreado.ronda.activa ? "• (Activa)" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/prestamos/pendientes" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Ver pendientes
              </Link>
              <button
                onClick={() => {
                  setPrestamoCreado(null);
                  setSuccess(null);
                  setError(null);
                  setSocioId(null);
                  setMonto(0);
                }}
                className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Crear otro
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Monto</p>
              <p className="mt-1 text-xl font-semibold">{fmtMoney(prestamoCreado.monto)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Tasa anual</p>
              <p className="mt-1 text-xl font-semibold">{Number(prestamoCreado.tasaAnual).toFixed(2)}%</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Plazo</p>
              <p className="mt-1 text-xl font-semibold">{prestamoCreado.plazoMeses} meses</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Próximo pago</p>
              <p className="mt-1 font-semibold">
                {nextCuota ? (
                  <>
                    {fmtDate(nextCuota.fechaVenc)} • <span className="text-gray-700">{fmtMoney(nextCuota.cuota)}</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Interés total estimado</p>
              <p className="mt-1 text-xl font-semibold text-amber-600">{fmtMoney(totalInteres)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Total a pagar</p>
              <p className="mt-1 text-xl font-semibold">{fmtMoney(totalPagado)}</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
            <div className="text-sm font-medium text-gray-800">Tabla de amortización</div>
            <div className="text-xs text-gray-500">Cuotas: {cuotas.length}</div>
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
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cuotas.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-gray-50/70">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.numero}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtDate(c.fechaVenc)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(c.cuota)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmtMoney(c.interes)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{fmtMoney(c.capital)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(c.saldo)}</td>
                    <td className="px-4 py-3 text-center">
                      {c.pagada ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Pagada
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          Pendiente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {(error || success) && (
          <div className={cn("rounded-md border p-4", error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700")}>
            {error ?? success}
          </div>
        )}
      </div>
    );
  }

  // ===== UI: Formulario =====
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm1 5a1 1 0 1 0-2 0v4H7a1 1 0 1 0 0 2h4v4a1 1 0 1 0 2 0v-4h4a1 1 0 1 0 0-2h-4V7Z" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Solicitud de préstamo</h1>
              <p className="text-sm text-gray-600">Crea un préstamo y revisa la amortización antes de guardarlo.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/prestamos/pendientes" className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Ver pendientes
            </Link>
          </div>
        </div>
      </div>

      {(error || success) && (
        <div className={cn("rounded-md border p-4", error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700")}>
          {error ?? success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form */}
        <section className="rounded-xl border bg-white p-6 shadow-sm lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-900">Datos del préstamo</h2>
          <p className="mt-1 text-sm text-gray-600">Selecciona socio y completa valores.</p>

          <div className="mt-4 space-y-4">
            {/* Socio */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Socio</label>

              <div className="relative">
                <input
                  value={qSocio}
                  onChange={(e) => setQSocio(e.target.value)}
                  placeholder={loadingSocios ? "Cargando socios..." : "Buscar por nombre o cuenta..."}
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
                            className={cn(
                              "w-full text-left p-3 hover:bg-gray-50",
                              active && "bg-orange-50"
                            )}
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
                  Socio seleccionado: <strong>{socioSeleccionado.nombres} {socioSeleccionado.apellidos}</strong>
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
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
                placeholder="0.00"
              />
            </div>

            {/* Tasa y plazo */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tasa anual (%)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={tasaAnual}
                  onChange={(e) => setTasaAnual(Number(e.target.value))}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
                />
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
              disabled={saving || !socioId || !monto || monto <= 0 || !plazoMeses || plazoMeses <= 0 || tasaAnual < 0}
              className={cn(
                "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white",
                saving || !socioId || !monto || monto <= 0 || !plazoMeses || plazoMeses <= 0 || tasaAnual < 0
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
                      Interés total aprox.: <strong className="text-amber-700">{fmtMoney(totals.totalInteres)}</strong>{" "}
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
                      Ingresa socio, monto, tasa, plazo y fecha para generar la amortización.
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
            Tip: si quieres una tasa mensual, divide tu tasa anual entre 12 (ej. 24% anual → 2% mensual).
          </div>
        </section>
      </div>
    </div>
  );
}
