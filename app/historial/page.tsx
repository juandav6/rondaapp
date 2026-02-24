"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// Tipos
export type Ronda = {
  id: number;
  nombre: string;
  fechaInicio: string; // ISO
  fechaFin: string | null; // ISO | null
  activa: boolean;
};

// Utilidades
function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(iso: string | null, locale = "es-EC") {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function StatusBadge({ activa }: { activa: boolean }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        activa ? "bg-green-50 text-green-700 ring-green-200" : "bg-gray-50 text-gray-700 ring-gray-200"
      )}
      title={activa ? "Ronda activa" : "Ronda finalizada"}
    >
      <span className={classNames("h-1.5 w-1.5 rounded-full", activa ? "bg-green-500" : "bg-gray-400")} />
      {activa ? "Activa" : "Finalizada"}
    </span>
  );
}

export default function HistorialRondasPage() {
  const [rondas, setRondas] = useState<Ronda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // toast simple
  const [success, setSuccess] = useState<string | null>(null);

  // confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Ronda | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"nombre" | "fechaInicio" | "fechaFin" | "activa">("fechaInicio");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  async function fetchHistorial() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/rondas/historial", { cache: "no-store" });
      if (!r.ok) throw new Error("No se pudo obtener el historial");
      const data = await r.json();
      setRondas(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistorial();
  }, []);

  // Filtro + orden
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? rondas.filter((r) => {
          const estado = r.activa ? "activa" : "finalizada";
          return (
            r.nombre.toLowerCase().includes(q) ||
            estado.includes(q) ||
            formatDate(r.fechaInicio).toLowerCase().includes(q) ||
            formatDate(r.fechaFin).toLowerCase().includes(q)
          );
        })
      : rondas;

    const sorted = [...base].sort((a, b) => {
      let va: any = a[sortKey as keyof Ronda] as any;
      let vb: any = b[sortKey as keyof Ronda] as any;

      if (sortKey === "fechaInicio" || sortKey === "fechaFin") {
        const da = va ? new Date(String(va)).getTime() : 0;
        const db = vb ? new Date(String(vb)).getTime() : 0;
        return sortDir === "asc" ? da - db : db - da;
      }

      if (sortKey === "activa") {
        const da = a.activa ? 1 : 0;
        const db = b.activa ? 1 : 0;
        return sortDir === "asc" ? da - db : db - da;
      }

      const cmp = String(va ?? "").localeCompare(String(vb ?? ""), "es", { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [rondas, query, sortKey, sortDir]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const visible = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function handleSort(key: typeof sortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function openDelete(r: Ronda) {
    setToDelete(r);
    setConfirmOpen(true);
  }

  function closeDelete() {
    if (deleting) return;
    setConfirmOpen(false);
    setToDelete(null);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      setDeleting(true);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/rondas/${toDelete.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo eliminar la ronda");

      setSuccess(`Ronda ${toDelete.nombre} eliminada correctamente. Secuencia RD actualizada.`);
      setTimeout(() => setSuccess(null), 3500);

      closeDelete();
      await fetchHistorial();
    } catch (e: any) {
      setError(e?.message ?? "Error al eliminar la ronda");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4a2 2 0 0 1 2-2h5.17a2 2 0 0 1 1.414.586l3.83 3.828A2 2 0 0 1 19 7.828V20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4zM8 6v14h9V8h-3a2 2 0 0 1-2-2V3H8z" />
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Historial de rondas</h1>
            <p className="text-sm text-gray-600">Consulta todas las rondas creadas, resultados y administración.</p>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-700">{success}</div>}

      {/* Buscador */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
            placeholder="Buscar por nombre, fecha o estado…"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:shadow focus:shadow-blue-100"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          >
            <path
              fillRule="evenodd"
              d="M10.5 3.75a6.75 6.75 0 1 0 4.2 12.05l3.725 3.725a.75.75 0 1 0 1.06-1.06l-3.724-3.725A6.75 6.75 0 0 0 10.5 3.75Zm-5.25 6.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <button
          onClick={fetchHistorial}
          className="inline-flex items-center justify-center rounded-lg border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Recargar
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
              <tr>
                {[
                  { key: "nombre", label: "Nombre" },
                  { key: "fechaInicio", label: "Fecha inicio" },
                  { key: "fechaFin", label: "Fecha fin" },
                  { key: "activa", label: "Estado" },
                ].map((c) => (
                  <th
                    key={c.key}
                    onClick={() => handleSort(c.key as any)}
                    className="cursor-pointer px-4 py-3 select-none"
                    title={`Ordenar por ${c.label}`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{c.label}</span>
                      {sortKey === c.key && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-gray-500">
                          {sortDir === "asc" ? <path d="M12 8l-4 4h8l-4-4z" /> : <path d="M12 16l4-4H8l4 4z" />}
                        </svg>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-t">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={`s-${i}-${j}`} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-600">
                    No hay rondas que coincidan con la búsqueda.
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.nombre}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(r.fechaInicio)}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(r.fechaFin)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge activa={r.activa} />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/rondas/${r.id}/resultados`}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 hover:shadow"
                        >
                          Ver resultados
                        </Link>

                        <button
                          onClick={() => openDelete(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                          title="Eliminar ronda y todos sus datos"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 3a1 1 0 0 0-1 1v1H4.75a.75.75 0 0 0 0 1.5h.64l.86 12.02A2.25 2.25 0 0 0 8.49 22h7.02a2.25 2.25 0 0 0 2.24-2.48L16.89 7.5h.64a.75.75 0 0 0 0-1.5H16V4a1 1 0 0 0-1-1H9Zm1.5 3V4.5h3V6h-3Z" />
                          </svg>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <span>
              Mostrando <strong>{visible.length}</strong> de <strong>{filtered.length}</strong> rondas
            </span>
            <div className="flex items-center gap-2">
              <button className="rounded-md border px-2.5 py-1 disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe === 1}>
                Anterior
              </button>
              <span className="tabular-nums">
                {pageSafe} / {totalPages}
              </span>
              <button className="rounded-md border px-2.5 py-1 disabled:opacity-50" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}>
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Modal confirmación ===== */}
      {confirmOpen && toDelete && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <div className="fixed inset-0 bg-black/30" onClick={closeDelete} />
          <div className="relative z-[90] w-full sm:max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm.75 5.5a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 1.5 0v-6ZM12 17.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Eliminar ronda</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Vas a eliminar <strong>{toDelete.nombre}</strong> y <strong>todos</strong> sus datos (aportes, ahorros, participaciones, responsables, préstamos, etc.).
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Después de eliminar, la secuencia se recalculará para mantener RD0001… sin huecos.
                  </p>
                </div>
              </div>

              <button onClick={closeDelete} className="text-gray-400 hover:text-gray-600" disabled={deleting} title="Cerrar">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.4 5l12.6 12.6-1.4 1.4L5 6.4 6.4 5z" />
                  <path d="M18.6 5L5.9 17.6l1.4 1.4L20 6.4 18.6 5z" />
                </svg>
              </button>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeDelete} disabled={deleting} className="rounded-md border px-4 py-2 text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className={classNames(
                  "rounded-md px-4 py-2 text-white",
                  deleting ? "bg-red-400" : "bg-red-600 hover:bg-red-700"
                )}
              >
                {deleting ? "Eliminando…" : "Sí, eliminar todo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
