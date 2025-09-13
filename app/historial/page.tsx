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
        activa
          ? "bg-green-50 text-green-700 ring-green-200"
          : "bg-gray-50 text-gray-700 ring-gray-200"
      )}
      title={activa ? "Ronda activa" : "Ronda finalizada"}
    >
      <span
        className={classNames(
          "h-1.5 w-1.5 rounded-full",
          activa ? "bg-green-500" : "bg-gray-400"
        )}
      />
      {activa ? "Activa" : "Finalizada"}
    </span>
  );
}

// Componente principal
export default function HistorialRondasPage() {
  const [rondas, setRondas] = useState<Ronda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"nombre" | "fechaInicio" | "fechaFin" | "activa">("fechaInicio");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setLoading(true);
    fetch("/api/rondas/historial")
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo obtener el historial");
        return r.json();
      })
      .then((data: Ronda[]) => {
        setRondas(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((err: any) => setError(err?.message ?? "Error desconocido"))
      .finally(() => setLoading(false));
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

      const cmp = String(va ?? "").localeCompare(String(vb ?? ""), "es", {
        sensitivity: "base",
      });
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [rondas, query, sortKey, sortDir]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const visible = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function handleSort(key: typeof sortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (error)
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="mb-2 font-semibold">Error</div>
          <p className="mb-4 text-sm">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetch("/api/rondas/historial")
                .then((r) => r.json())
                .then(setRondas)
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false));
            }}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );

  return (
    <div className="p-6 space-y-6">
      {/* Header en cajoncito */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            {/* icono documento */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4a2 2 0 0 1 2-2h5.17a2 2 0 0 1 1.414.586l3.83 3.828A2 2 0 0 1 19 7.828V20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4zM8 6v14h9V8h-3a2 2 0 0 1-2-2V3H8z"/>
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Historial de rondas</h1>
            <p className="text-sm text-gray-600">Consulta todas las rondas creadas y su estado.</p>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full gap-2 sm:w-auto">
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
        </div>
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
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4 text-gray-500"
                        >
                          {sortDir === "asc" ? (
                            <path d="M12 8l-4 4h8l-4-4z" />
                          ) : (
                            <path d="M12 16l4-4H8l4 4z" />
                          )}
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
                  <td colSpan={5} className="px-6 py-12">
                    <div className="flex flex-col items-center justify-center text-center text-gray-600">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="mb-3 h-10 w-10"
                      >
                        <path
                          d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="text-gray-300"
                        />
                        <path
                          d="M4 10h16"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="text-gray-300"
                        />
                      </svg>
                      <p className="text-sm">No hay rondas que coincidan con la búsqueda.</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.nombre}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(r.fechaInicio)}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(r.fechaFin)}</td>
                    <td className="px-4 py-3"><StatusBadge activa={r.activa} /></td>
                    <td className="px-4 py-3 text-right">
                      {!r.activa ? (
                        <Link
                          href={`/rondas/${r.id}/resultados`}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 hover:shadow"
                        >
                          Ver resultados
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
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
              Mostrando
              <strong> {visible.length} </strong>
              de
              <strong> {filtered.length} </strong>
              rondas
            </span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border px-2.5 py-1 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe === 1}
              >
                Anterior
              </button>
              <span className="tabular-nums">
                {pageSafe} / {totalPages}
              </span>
              <button
                className="rounded-md border px-2.5 py-1 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe === totalPages}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
