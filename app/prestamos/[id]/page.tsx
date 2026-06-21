"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Cuota = {
  id: number;
  numero: number;
  fechaVenc: string;
  cuota: number;
  interes: number;
  capital: number;
  saldo: number;
  pagada: boolean;
  fechaPago: string | null;
};

type Prestamo = {
  id: number;
  estado: string;
  monto: number;
  saldoActual: number;
  tasaAnual: number;
  plazoMeses: number;
  fechaInicio: string;
  socio: { id: number; nombres: string; apellidos: string; numeroCuenta: string };
  ronda: { id: number; nombre: string; activa: boolean };
  cuotas: Cuota[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMoney = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n));
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};

const daysOverdue = (fechaVenc: string) => {
  const diff = Date.now() - new Date(fechaVenc).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
};

const progressPct = (p: Prestamo) => {
  const pagadas = p.cuotas.filter((c) => c.pagada).length;
  return Math.round((pagadas / p.plazoMeses) * 100);
};

// ─── Modal de Pago ────────────────────────────────────────────────────────────

function PayModal({
  cuota,
  onClose,
  onPaid,
}: {
  cuota: Cuota;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().slice(0, 10));
  const overdue = daysOverdue(cuota.fechaVenc);

  async function handlePay() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/prestamos/cuotas/${cuota.id}/pagar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fechaPago }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error al registrar pago");
      onPaid();
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in">
        {/* header */}
        <div
          className="px-6 py-5"
          style={{
            background: overdue > 0
              ? "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)"
              : "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white text-lg"
                style={{ background: overdue > 0 ? "#dc2626" : "#2563eb" }}
              >
                💳
              </span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Registrar pago
                </h2>
                <p
                  className="text-sm"
                  style={{ color: overdue > 0 ? "#b91c1c" : "#1d4ed8" }}
                >
                  Cuota #{cuota.numero} · vence {fmtDate(cuota.fechaVenc)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-500 hover:bg-white/60"
            >
              ✕
            </button>
          </div>
        </div>

        {/* body */}
        <div className="px-6 py-5 space-y-4">
          {overdue > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              ⚠️ Esta cuota está vencida hace <strong>{overdue} días</strong>.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Capital", value: fmtMoney(cuota.capital) },
              { label: "Interés", value: fmtMoney(cuota.interes) },
              { label: "Total cuota", value: fmtMoney(cuota.cuota) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-gray-50 px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-gray-600">Saldo tras este pago</span>
            <span className="text-sm font-semibold text-gray-900">
              {fmtMoney(cuota.saldo)}
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Fecha de pago</label>
            <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex gap-3 border-t px-6 py-4 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handlePay}
            disabled={loading}
            className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: overdue > 0 ? "#dc2626" : "#2563eb" }}
          >
            {loading ? "Procesando…" : `Confirmar pago ${fmtMoney(cuota.cuota)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrestamoDetallePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const id = Number(params.id);
  const payParam = searchParams.get("pay");

  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCuota, setSelectedCuota] = useState<Cuota | null>(null);

  const fetchPrestamo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/prestamos/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo cargar el préstamo");
      setPrestamo(data.prestamo ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar préstamo");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPrestamo();
  }, [fetchPrestamo]);

  // abrir modal si viene ?pay=cuotaId
  useEffect(() => {
    if (!prestamo || !payParam) return;
    const cuota = prestamo.cuotas.find((c) => c.id === Number(payParam) && !c.pagada);
    if (cuota) setSelectedCuota(cuota);
  }, [prestamo, payParam]);

  function handlePaid() {
    setSelectedCuota(null);
    router.replace(`/prestamos/${id}`);
    fetchPrestamo();
  }

  function handleCloseModal() {
    setSelectedCuota(null);
    router.replace(`/prestamos/${id}`);
  }

  // ── loading ──
  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  // ── error ──
  if (error || !prestamo) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <p className="text-lg font-semibold">No se pudo cargar el préstamo</p>
          <p className="mt-1 text-sm">{error}</p>
          <Link href="/prestamos/pendientes" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            ← Volver a pendientes
          </Link>
        </div>
      </div>
    );
  }

  const cuotasPagadas = prestamo.cuotas.filter((c) => c.pagada).length;
  const pct = progressPct(prestamo);
  const nextCuota = prestamo.cuotas.find((c) => !c.pagada) ?? null;
  const estadoColor =
    prestamo.estado === "ACTIVO"
      ? { bg: "bg-blue-100", text: "text-blue-700" }
      : prestamo.estado === "MORA"
      ? { bg: "bg-rose-100", text: "text-rose-700" }
      : { bg: "bg-gray-100", text: "text-gray-700" };

  return (
    <>
      {selectedCuota && (
        <PayModal
          cuota={selectedCuota}
          onClose={handleCloseModal}
          onPaid={handlePaid}
        />
      )}

      <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
          <Link href="/prestamos/pendientes" className="hover:text-gray-800">
            Préstamos
          </Link>
          <span>/</span>
          <span className="text-gray-800 font-medium">Préstamo #{prestamo.id}</span>
        </div>

        {/* header card */}
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div
            className="px-6 py-5"
            style={{
              background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
              borderBottom: "1px solid #bae6fd",
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {prestamo.socio.nombres} {prestamo.socio.apellidos}
                  </h1>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${estadoColor.bg} ${estadoColor.text}`}
                  >
                    {prestamo.estado}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Cuenta{" "}
                  <span className="font-mono font-medium text-gray-800">
                    {prestamo.socio.numeroCuenta}
                  </span>{" "}
                  · Ronda{" "}
                  <span className="font-medium text-gray-800">
                    {prestamo.ronda.nombre}
                  </span>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={fetchPrestamo}
                  className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-sky-50"
                >
                  Actualizar
                </button>
                {nextCuota && (
                  <button
                    onClick={() => setSelectedCuota(nextCuota)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Registrar pago
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* stats */}
          <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
            {[
              { label: "Monto original", value: fmtMoney(prestamo.monto) },
              { label: "Saldo actual", value: fmtMoney(prestamo.saldoActual), highlight: true },
              { label: "Tasa anual", value: `${prestamo.tasaAnual}%` },
              { label: "Plazo", value: `${prestamo.plazoMeses} meses` },
            ].map((s) => (
              <div key={s.label} className="px-5 py-4">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p
                  className={`mt-1 text-xl font-semibold ${
                    s.highlight ? "text-blue-700" : "text-gray-900"
                  }`}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* progress */}
          <div className="px-6 py-4 border-t bg-gray-50">
            <div className="flex justify-between text-xs text-gray-600 mb-2">
              <span>
                {cuotasPagadas} de {prestamo.plazoMeses} cuotas pagadas
              </span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, #3b82f6, #0ea5e9)",
                }}
              />
            </div>
          </div>
        </div>

        {/* próximo pago */}
        {nextCuota && (
          <div
            className="rounded-xl border p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            style={{
              background:
                daysOverdue(nextCuota.fechaVenc) > 0
                  ? "linear-gradient(135deg,#fef2f2,#fee2e2)"
                  : "linear-gradient(135deg,#f0fdf4,#dcfce7)",
              borderColor:
                daysOverdue(nextCuota.fechaVenc) > 0 ? "#fca5a5" : "#86efac",
            }}
          >
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{
                  color:
                    daysOverdue(nextCuota.fechaVenc) > 0 ? "#b91c1c" : "#15803d",
                }}
              >
                {daysOverdue(nextCuota.fechaVenc) > 0
                  ? `⚠️ Vencido hace ${daysOverdue(nextCuota.fechaVenc)} días`
                  : "✅ Próximo pago"}
              </p>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {fmtMoney(nextCuota.cuota)}{" "}
                <span className="text-sm font-normal text-gray-600">
                  · vence {fmtDate(nextCuota.fechaVenc)}
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Capital {fmtMoney(nextCuota.capital)} + Interés{" "}
                {fmtMoney(nextCuota.interes)}
              </p>
            </div>
            <button
              onClick={() => setSelectedCuota(nextCuota)}
              className="self-start sm:self-auto rounded-lg px-4 py-2.5 text-sm font-medium text-white"
              style={{
                background:
                  daysOverdue(nextCuota.fechaVenc) > 0 ? "#dc2626" : "#16a34a",
              }}
            >
              Pagar ahora
            </button>
          </div>
        )}

        {/* tabla de cuotas */}
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              Tabla de amortización
            </h2>
            <span className="text-xs text-gray-500">
              {prestamo.plazoMeses} cuotas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[700px] text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Vencimiento</th>
                  <th className="px-4 py-3 text-right">Capital</th>
                  <th className="px-4 py-3 text-right">Interés</th>
                  <th className="px-4 py-3 text-right">Cuota</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {prestamo.cuotas.map((c) => {
                  const od = !c.pagada ? daysOverdue(c.fechaVenc) : 0;
                  return (
                    <tr
                      key={c.id}
                      className={`border-t transition-colors ${
                        c.pagada
                          ? "bg-gray-50/60 text-gray-400"
                          : od > 0
                          ? "bg-rose-50/50 hover:bg-rose-50"
                          : "hover:bg-blue-50/30"
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{c.numero}</td>
                      <td className="px-4 py-3">
                        <span className={c.pagada ? "" : od > 0 ? "text-rose-700 font-medium" : ""}>
                          {fmtDate(c.fechaVenc)}
                        </span>
                        {c.pagada && c.fechaPago && (
                          <div className="text-xs text-gray-400">
                            Pagado {fmtDate(c.fechaPago)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtMoney(c.capital)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtMoney(c.interes)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {fmtMoney(c.cuota)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtMoney(c.saldo)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.pagada ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Pagada
                          </span>
                        ) : od > 0 ? (
                          <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                            {od}d mora
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!c.pagada && (
                          <button
                            onClick={() => setSelectedCuota(c)}
                            className={`rounded-md px-2.5 py-1.5 text-xs font-medium text-white ${
                              od > 0
                                ? "bg-rose-600 hover:bg-rose-700"
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                          >
                            Pagar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
