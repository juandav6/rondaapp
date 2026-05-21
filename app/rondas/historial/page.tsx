// app/rondas/historial/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type Ronda = {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string | null;
  activa: boolean;
  reporteGeneradoAt?: string | null;
};

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function StatusBadge({ activa }: { activa: boolean }) {
  return (
    <span className={classNames(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
      activa ? "bg-green-50 text-green-700 ring-green-200" : "bg-gray-50 text-gray-700 ring-gray-200"
    )}>
      <span className={classNames("h-1.5 w-1.5 rounded-full", activa ? "bg-green-500" : "bg-gray-400")} />
      {activa ? "Activa" : "Finalizada"}
    </span>
  );
}

export default function HistorialRondasPage() {
  const [rondas, setRondas] = useState<Ronda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Ronda | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [regenerando, setRegenerando] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"nombre" | "fechaInicio" | "fechaFin" | "activa">("fechaInicio");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  async function fetchHistorial() {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/rondas/historial", { cache: "no-store" });
      if (!r.ok) throw new Error("No se pudo obtener el historial");
      const data = await r.json();
      setRondas(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e?.message ?? "Error desconocido"); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchHistorial(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? rondas.filter(r => {
      const estado = r.activa ? "activa" : "finalizada";
      return r.nombre.toLowerCase().includes(q) || estado.includes(q) ||
        formatDate(r.fechaInicio).toLowerCase().includes(q) ||
        formatDate(r.fechaFin).toLowerCase().includes(q);
    }) : rondas;

    return [...base].sort((a, b) => {
      if (sortKey === "fechaInicio" || sortKey === "fechaFin") {
        const da = a[sortKey] ? new Date(String(a[sortKey])).getTime() : 0;
        const db = b[sortKey] ? new Date(String(b[sortKey])).getTime() : 0;
        return sortDir === "asc" ? da - db : db - da;
      }
      if (sortKey === "activa") return sortDir === "asc" ? (a.activa ? 1 : 0) - (b.activa ? 1 : 0) : (b.activa ? 1 : 0) - (a.activa ? 1 : 0);
      const cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), "es", { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rondas, query, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const visible = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function handleSort(key: typeof sortKey) {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  async function regenerarExcel(id: number, nombre: string) {
    try {
      setRegenerando(id); setError(null);
      const res = await fetch(`/api/rondas/${id}/reporte/regenerar`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error al generar");
      setSuccess(`Excel de ${nombre} generado correctamente.`);
      setTimeout(() => setSuccess(null), 3500);
      // Recargar para mostrar el botón de descarga
      await fetchHistorial();
    } catch (e: any) {
      setError(e?.message ?? "Error al generar el Excel");
    } finally {
      setRegenerando(null);
    }
  }

  function openDelete(r: Ronda) { setToDelete(r); setConfirmOpen(true); }
  function closeDelete() { if (deleting) return; setConfirmOpen(false); setToDelete(null); }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      setDeleting(true); setError(null); setSuccess(null);
      const res = await fetch(`/api/rondas/${toDelete.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo eliminar");
      setSuccess(`Ronda ${toDelete.nombre} eliminada. Secuencia RD actualizada.`);
      setTimeout(() => setSuccess(null), 3500);
      closeDelete(); await fetchHistorial();
    } catch (e: any) { setError(e?.message ?? "Error al eliminar"); }
    finally { setDeleting(false); }
  }

  return (
    <div className="space-y-4 p-3 sm:p-6">
      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4a2 2 0 0 1 2-2h5.17a2 2 0 0 1 1.414.586l3.83 3.828A2 2 0 0 1 19 7.828V20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4zM8 6v14h9V8h-3a2 2 0 0 1-2-2V3H8z" />
            </svg>
          </span>
          <div>
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Historial de rondas</h1>
            <p className="text-xs sm:text-sm text-gray-500">{rondas.length} rondas registradas</p>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {/* Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input type="text" value={query}
            onChange={e => { setPage(1); setQuery(e.target.value); }}
            placeholder="Buscar por nombre, fecha o estado…"
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100" />
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
            <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 4.2 12.05l3.725 3.725a.75.75 0 1 0 1.06-1.06l-3.724-3.725A6.75 6.75 0 0 0 10.5 3.75Z" clipRule="evenodd"/>
          </svg>
        </div>
        <button onClick={fetchHistorial}
          className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 shrink-0">
          ↺
        </button>
      </div>

      {/* ── Tabla desktop ── */}
      <div className="hidden sm:block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
              <tr>
                {([
                  { key: "nombre", label: "Nombre" },
                  { key: "fechaInicio", label: "Fecha inicio" },
                  { key: "fechaFin", label: "Fecha fin" },
                  { key: "activa", label: "Estado" },
                ] as const).map(c => (
                  <th key={c.key} onClick={() => handleSort(c.key)}
                    className="cursor-pointer px-4 py-3 select-none">
                    <div className="flex items-center gap-1">
                      <span>{c.label}</span>
                      {sortKey === c.key && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-gray-400">
                          {sortDir === "asc" ? <path d="M12 8l-4 4h8l-4-4z"/> : <path d="M12 16l4-4H8l4 4z"/>}
                        </svg>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 w-full animate-pulse rounded bg-gray-100" /></td>
                  ))}
                </tr>
              ))}
              {!loading && visible.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">No hay rondas que coincidan.</td></tr>
              )}
              {!loading && visible.map(r => (
                <tr key={r.id} className="border-t hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(r.fechaInicio)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(r.fechaFin)}</td>
                  <td className="px-4 py-3"><StatusBadge activa={r.activa} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Si es activa: botón regenerar siempre visible + descargar si existe */}
                      {r.activa ? (
                        <div className="flex gap-1.5">
                          {r.reporteGeneradoAt && (
                            <a href={`/api/rondas/${r.id}/reporte`} download
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                              title={`Excel generado el ${new Date(r.reporteGeneradoAt).toLocaleDateString("es-EC")}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                                <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd"/>
                              </svg>
                              Descargar
                            </a>
                          )}
                          <button onClick={() => regenerarExcel(r.id, r.nombre)} disabled={regenerando === r.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            title="Regenerar Excel con datos actualizados">
                            {regenerando === r.id ? (
                              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                                <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4"/>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                                <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z" clipRule="evenodd"/>
                              </svg>
                            )}
                            {regenerando === r.id ? "Generando…" : "Actualizar Excel"}
                          </button>
                        </div>
                      ) : (
                        /* Ronda cerrada: solo descargar o generar si no existe */
                        r.reporteGeneradoAt ? (
                          <a href={`/api/rondas/${r.id}/reporte`} download
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            title={`Reporte generado el ${new Date(r.reporteGeneradoAt).toLocaleDateString("es-EC")}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                              <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd"/>
                            </svg>
                            Excel ✓
                          </a>
                        ) : (
                          <button onClick={() => regenerarExcel(r.id, r.nombre)} disabled={regenerando === r.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                            {regenerando === r.id ? "Generando…" : "Generar Excel"}
                          </button>
                        )
                      )}
                      <Link href={`/rondas/${r.id}/resultados`}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                        Ver resultados
                      </Link>
                      <button onClick={() => openDelete(r)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <span>Mostrando <strong>{visible.length}</strong> de <strong>{filtered.length}</strong></span>
            <div className="flex items-center gap-2">
              <button className="rounded-md border px-2.5 py-1 disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe === 1}>Anterior</button>
              <span className="tabular-nums">{pageSafe} / {totalPages}</span>
              <button className="rounded-md border px-2.5 py-1 disabled:opacity-50" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}>Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Tarjetas móvil ── */}
      <div className="sm:hidden space-y-2">
        {loading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
        {!loading && visible.length === 0 && (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">No hay rondas que coincidan.</div>
        )}
        {!loading && visible.map(r => (
          <div key={r.id} className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{r.nombre}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(r.fechaInicio)} → {formatDate(r.fechaFin)}
                </p>
              </div>
              <StatusBadge activa={r.activa} />
            </div>
            <div className="flex gap-2 pt-1">
              {r.reporteGeneradoAt ? (
                <a href={`/api/rondas/${r.id}/reporte`} download
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700 hover:bg-emerald-100 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd"/>
                  </svg>
                  Excel ✓
                </a>
              ) : (
                <button onClick={() => regenerarExcel(r.id, r.nombre)}
                  disabled={regenerando === r.id}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 flex items-center gap-1">
                  {regenerando === r.id ? "Generando…" : "Generar Excel"}
                </button>
              )}
              <Link href={`/rondas/${r.id}/resultados`}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-center text-xs font-medium text-white hover:bg-blue-700">
                Ver resultados
              </Link>
              <button onClick={() => openDelete(r)}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-100">
                Eliminar
              </button>
            </div>
          </div>
        ))}

        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2 text-sm text-gray-600">
            <span className="text-xs text-gray-400">{visible.length} de {filtered.length}</span>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe === 1}>← Anterior</button>
              <button className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}>Siguiente →</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal confirmación */}
      {confirmOpen && toDelete && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <div className="fixed inset-0 bg-black/30" onClick={closeDelete} />
          <div className="relative z-[90] w-full sm:max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm.75 5.5a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 1.5 0v-6ZM12 17.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
                </svg>
              </span>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">Eliminar ronda</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Vas a eliminar <strong>{toDelete.nombre}</strong> y todos sus datos (aportes, ahorros, préstamos, etc.).
                </p>
                <p className="mt-1.5 text-xs text-gray-400">La secuencia RD se recalculará automáticamente.</p>
              </div>
              <button onClick={closeDelete} disabled={deleting} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={closeDelete} disabled={deleting} className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmDelete} disabled={deleting}
                className={classNames("rounded-md px-4 py-2 text-sm text-white", deleting ? "bg-red-400" : "bg-red-600 hover:bg-red-700")}>
                {deleting ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
