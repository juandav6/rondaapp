// app/prestamos/pendientes/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PrestamoPendiente = {
  id: number;
  estado: string;
  monto: number;
  saldoActual: number;
  tasaAnual: number;
  plazoMeses: number;
  cuotasPagadas?: number;   // cuántas cuotas han sido pagadas
  totalCuotas?: number;
  socio: { id: number; nombres: string; apellidos: string; numeroCuenta: string };
  ronda: { id: number; nombre: string; activa: boolean };
  nextPayment: null | { cuotaId: number; fechaVenc: string; cuota: number };
  daysOverdue: number;
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

export default function PrestamosPendientesPage() {
  const [items, setItems] = useState<PrestamoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);

  // Modal cancelar
  const [cancelTarget, setCancelTarget] = useState<PrestamoPendiente | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function fetchPendientes() {
    try {
      setLoading(true); setError(null);
      const res = await fetch("/api/prestamos");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudieron cargar préstamos");
      setItems(Array.isArray(data?.prestamos) ? data.prestamos : []);
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPendientes(); }, []);

  async function cancelarPrestamo() {
    if (!cancelTarget) return;
    try {
      setCancelling(true); setCancelError(null);
      const res = await fetch(`/api/prestamos/${cancelTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo cancelar");
      setSuccess(`Préstamo #${cancelTarget.id} de ${cancelTarget.socio.nombres} cancelado correctamente.`);
      setTimeout(() => setSuccess(null), 4000);
      setCancelTarget(null);
      await fetchPendientes();
    } catch (e: any) {
      setCancelError(e?.message ?? "Error al cancelar");
    } finally {
      setCancelling(false);
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let base = items;
    if (showOnlyOverdue) base = base.filter(x => (x.daysOverdue ?? 0) > 0);
    if (!s) return base;
    return base.filter(p =>
      [p.socio?.nombres, p.socio?.apellidos, p.socio?.numeroCuenta, p.ronda?.nombre, String(p.monto), String(p.saldoActual)]
        .filter(Boolean).join(" ").toLowerCase().includes(s)
    );
  }, [items, q, showOnlyOverdue]);

  const totals = useMemo(() => ({
    totalSaldo: filtered.reduce((acc, x) => acc + Number(x.saldoActual || 0), 0),
    totalPrestado: filtered.reduce((acc, x) => acc + Number(x.monto || 0), 0),
    overdueCount: filtered.filter(x => (x.daysOverdue ?? 0) > 0).length,
  }), [filtered]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm1 5a1 1 0 1 0-2 0v4H7a1 1 0 1 0 0 2h4v4a1 1 0 1 0 2 0v-4h4a1 1 0 1 0 0-2h-4V7Z" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Préstamos pendientes</h1>
              <p className="text-sm text-gray-600">
                Próximos pagos, mora y saldos actuales.
                <span className="mx-2 text-gray-300">·</span>
                <Link className="text-blue-700 hover:underline" href="/prestamos/solicitud">Crear préstamo</Link>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchPendientes} className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Actualizar</button>
            <Link href="/prestamos/solicitud" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Nuevo préstamo</Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-gray-500">Total saldo (filtrado)</p>
            <p className="mt-1 text-2xl font-semibold">{fmtMoney(totals.totalSaldo)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-gray-500">Total prestado (filtrado)</p>
            <p className="mt-1 text-2xl font-semibold">{fmtMoney(totals.totalPrestado)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-gray-500">En mora</p>
            <p className="mt-1 text-2xl font-semibold text-rose-600">{totals.overdueCount}</p>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">✅ {success}</div>}

      {/* Tabla */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-gray-800">Listado</div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar socio, cuenta o ronda…"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
                <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 4.2 12.05l3.725 3.725a.75.75 0 1 0 1.06-1.06l-3.724-3.725A6.75 6.75 0 0 0 10.5 3.75Zm-5.25 6.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z" clipRule="evenodd" />
              </svg>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={showOnlyOverdue} onChange={e => setShowOnlyOverdue(e.target.checked)} className="h-4 w-4" />
              Solo vencidos
            </label>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded bg-gray-100" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No hay préstamos pendientes con esos filtros.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3">Socio</th>
                  <th className="px-4 py-3">Ronda</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3">Próximo pago</th>
                  <th className="px-4 py-3 text-center">Mora</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const overdue = (p.daysOverdue ?? 0) > 0;
                  // Puede cancelarse si no hay cuotas pagadas
                  const puedeCancelar = (p.cuotasPagadas ?? 0) === 0;

                  return (
                    <tr key={p.id} className="border-t hover:bg-gray-50/70">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.socio.nombres} {p.socio.apellidos}</p>
                        <p className="text-xs text-gray-500">Cuenta <span className="font-mono">{p.socio.numeroCuenta}</span></p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <p className="font-medium">{p.ronda.nombre}</p>
                        {p.ronda.activa && (
                          <span className="mt-0.5 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Activa</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtMoney(p.saldoActual)}</td>
                      <td className="px-4 py-3">
                        {p.nextPayment ? (
                          <div>
                            <p className="font-medium text-gray-900">{fmtDate(p.nextPayment.fechaVenc)}</p>
                            <p className="text-xs text-gray-500">{fmtMoney(p.nextPayment.cuota)}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Sin cuotas pendientes</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          overdue ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-600")}>
                          {overdue ? `${p.daysOverdue} días` : "0 días"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link href={`/prestamos/${p.id}`}
                            className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-gray-50">
                            Ver
                          </Link>
                          {p.nextPayment && (
                            <Link href={`/prestamos/${p.id}?pay=${p.nextPayment.cuotaId}`}
                              className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium text-white",
                                overdue ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700")}>
                              Pagar
                            </Link>
                          )}
                          {puedeCancelar && (
                            <button onClick={() => { setCancelTarget(p); setCancelError(null); }}
                              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                              title="Cancelar préstamo (sin cuotas pagadas)">
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t bg-gray-50 p-4 text-xs text-gray-500">
          El botón <strong>Cancelar</strong> solo aparece si el préstamo no tiene cuotas pagadas.
        </div>
      </div>

      {/* ── Modal cancelar ── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => !cancelling && setCancelTarget(null)} />
          <div className="relative z-50 w-full sm:max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
            <div className="flex items-start gap-3 mb-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                </svg>
              </span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Cancelar préstamo</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Vas a cancelar el préstamo de{" "}
                  <strong>{cancelTarget.socio.nombres} {cancelTarget.socio.apellidos}</strong>{" "}
                  por <strong>{fmtMoney(cancelTarget.monto)}</strong> en la ronda{" "}
                  <strong>{cancelTarget.ronda.nombre}</strong>.
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Esta acción eliminará el préstamo y todas sus cuotas. No se puede deshacer.
                </p>
              </div>
            </div>

            {cancelError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {cancelError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelTarget(null)} disabled={cancelling}
                className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                No, mantener
              </button>
              <button onClick={cancelarPrestamo} disabled={cancelling}
                className={cn("rounded-md px-4 py-2 text-sm font-medium text-white",
                  cancelling ? "bg-red-400" : "bg-red-600 hover:bg-red-700")}>
                {cancelling ? "Cancelando…" : "Sí, cancelar préstamo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
