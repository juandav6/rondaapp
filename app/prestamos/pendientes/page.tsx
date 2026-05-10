// app/prestamos/pendientes/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PrestamoPendiente = {
  id: number; estado: string; monto: number; saldoActual: number;
  tasaAnual: number; plazoMeses: number; cuotasPagadas?: number; totalCuotas?: number;
  socio: { id: number; nombres: string; apellidos: string; numeroCuenta: string };
  ronda: { id: number; nombre: string; activa: boolean };
  nextPayment: null | { cuotaId: number; fechaVenc: string; cuota: number };
  daysOverdue: number;
};

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const fmt = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n));
};
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

export default function PrestamosPendientesPage() {
  const [items, setItems] = useState<PrestamoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<PrestamoPendiente | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function fetchPendientes() {
    try {
      setLoading(true); setError(null);
      const res = await fetch("/api/prestamos");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error");
      setItems(Array.isArray(data?.prestamos) ? data.prestamos : []);
    } catch (e: any) { setError(e?.message); setItems([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchPendientes(); }, []);

  async function cancelarPrestamo() {
    if (!cancelTarget) return;
    try {
      setCancelling(true); setCancelError(null);
      const res = await fetch(`/api/prestamos/${cancelTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error");
      setSuccess(`Préstamo de ${cancelTarget.socio.nombres} cancelado correctamente.`);
      setTimeout(() => setSuccess(null), 4000);
      setCancelTarget(null); await fetchPendientes();
    } catch (e: any) { setCancelError(e?.message); }
    finally { setCancelling(false); }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let base = items;
    if (showOnlyOverdue) base = base.filter(x => x.daysOverdue > 0);
    if (!s) return base;
    return base.filter(p =>
      [p.socio?.nombres, p.socio?.apellidos, p.socio?.numeroCuenta, p.ronda?.nombre]
        .filter(Boolean).join(" ").toLowerCase().includes(s)
    );
  }, [items, q, showOnlyOverdue]);

  const totals = useMemo(() => ({
    totalSaldo: filtered.reduce((a, x) => a + Number(x.saldoActual || 0), 0),
    totalPrestado: filtered.reduce((a, x) => a + Number(x.monto || 0), 0),
    overdueCount: filtered.filter(x => x.daysOverdue > 0).length,
  }), [filtered]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/>
                <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75Z" clipRule="evenodd"/>
              </svg>
            </span>
            <div>
              <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Préstamos pendientes</h1>
              <p className="text-xs sm:text-sm text-gray-500">Pagos, mora y saldos actuales</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={fetchPendientes} className="rounded-lg border px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50">↺</button>
            <Link href="/prestamos/solicitud" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">+ Nuevo</Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">Saldo</p>
            <p className="mt-0.5 text-sm sm:text-lg font-semibold tabular-nums">{fmt(totals.totalSaldo)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">Prestado</p>
            <p className="mt-0.5 text-sm sm:text-lg font-semibold tabular-nums">{fmt(totals.totalPrestado)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">En mora</p>
            <p className="mt-0.5 text-sm sm:text-lg font-semibold text-rose-600">{totals.overdueCount}</p>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">✅ {success}</div>}

      {/* Lista */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {/* Filtros */}
        <div className="flex flex-col gap-2 p-3 border-b bg-gray-50 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar socio, cuenta o ronda…"
              className="w-full rounded-md border px-3 py-2 text-sm pl-8 focus:border-blue-500 focus:outline-none" />
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none">
              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 4.2 12.05l3.725 3.725a.75.75 0 1 0 1.06-1.06l-3.724-3.725A6.75 6.75 0 0 0 10.5 3.75Z" clipRule="evenodd"/>
            </svg>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 shrink-0">
            <input type="checkbox" checked={showOnlyOverdue} onChange={e => setShowOnlyOverdue(e.target.checked)} className="h-4 w-4" />
            Solo vencidos
          </label>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded bg-gray-100" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No hay préstamos con esos filtros.</div>
        ) : (
          <>
            {/* Tabla — desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
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
                    const overdue = p.daysOverdue > 0;
                    const puedeCancelar = (p.cuotasPagadas ?? 0) === 0;
                    return (
                      <tr key={p.id} className="border-t hover:bg-gray-50/70">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{p.socio.nombres} {p.socio.apellidos}</p>
                          <p className="text-xs text-gray-400 font-mono">{p.socio.numeroCuenta}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700">{p.ronda.nombre}</p>
                          {p.ronda.activa && <span className="text-xs text-emerald-600 font-medium">Activa</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(p.saldoActual)}</td>
                        <td className="px-4 py-3">
                          {p.nextPayment ? (
                            <div>
                              <p className="text-gray-900">{fmtDate(p.nextPayment.fechaVenc)}</p>
                              <p className="text-xs text-gray-400">{fmt(p.nextPayment.cuota)}</p>
                            </div>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            overdue ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-500")}>
                            {overdue ? `${p.daysOverdue}d` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1.5">
                            <Link href={`/prestamos/${p.id}`} className="rounded border px-2 py-1 text-xs hover:bg-gray-50">Ver</Link>
                            {p.nextPayment && (
                              <Link href={`/prestamos/${p.id}?pay=${p.nextPayment.cuotaId}`}
                                className={cn("rounded px-2 py-1 text-xs text-white font-medium", overdue ? "bg-rose-600" : "bg-blue-600")}>
                                Pagar
                              </Link>
                            )}
                            {puedeCancelar && (
                              <button onClick={() => { setCancelTarget(p); setCancelError(null); }}
                                className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100">
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

            {/* Tarjetas — móvil */}
            <ul className="md:hidden divide-y">
              {filtered.map(p => {
                const overdue = p.daysOverdue > 0;
                const puedeCancelar = (p.cuotasPagadas ?? 0) === 0;
                return (
                  <li key={p.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{p.socio.nombres} {p.socio.apellidos}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.socio.numeroCuenta} · {p.ronda.nombre}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold tabular-nums">{fmt(p.saldoActual)}</p>
                        {overdue && (
                          <span className="inline-flex rounded-full bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-700">
                            {p.daysOverdue}d mora
                          </span>
                        )}
                      </div>
                    </div>
                    {p.nextPayment && (
                      <p className="text-xs text-gray-500">
                        Próx. pago: <strong className="text-gray-700">{fmtDate(p.nextPayment.fechaVenc)}</strong>
                        <span className="mx-1">·</span>{fmt(p.nextPayment.cuota)}
                      </p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Link href={`/prestamos/${p.id}`}
                        className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50">Ver</Link>
                      {p.nextPayment && (
                        <Link href={`/prestamos/${p.id}?pay=${p.nextPayment.cuotaId}`}
                          className={cn("rounded-md px-3 py-1.5 text-xs font-medium text-white", overdue ? "bg-rose-600" : "bg-blue-600")}>
                          Pagar
                        </Link>
                      )}
                      {puedeCancelar && (
                        <button onClick={() => { setCancelTarget(p); setCancelError(null); }}
                          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                          Cancelar
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="border-t bg-gray-50 p-3 text-xs text-gray-400">
          El botón <strong>Cancelar</strong> solo aparece si el préstamo no tiene cuotas pagadas.
        </div>
      </div>

      {/* Modal cancelar */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => !cancelling && setCancelTarget(null)} />
          <div className="relative z-50 w-full sm:max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-start gap-3 mb-4">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-lg">⚠</span>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Cancelar préstamo</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Préstamo de <strong>{cancelTarget.socio.nombres} {cancelTarget.socio.apellidos}</strong> por <strong>{fmt(cancelTarget.monto)}</strong> · {cancelTarget.ronda.nombre}
                </p>
                <p className="mt-1 text-xs text-gray-400">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            {cancelError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{cancelError}</div>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelTarget(null)} disabled={cancelling}
                className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Mantener</button>
              <button onClick={cancelarPrestamo} disabled={cancelling}
                className={cn("rounded-md px-4 py-2 text-sm font-medium text-white", cancelling ? "bg-red-400" : "bg-red-600 hover:bg-red-700")}>
                {cancelling ? "Cancelando…" : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
