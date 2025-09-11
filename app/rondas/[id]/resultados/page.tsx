"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { NextRequest } from "next/server";

// ===== Tipos de datos =====
export type Resumen = {
  id: number;
  nombre: string;
  fechaInicio: string; // ISO
  fechaFin: string | null; // ISO | null
  totalSocios: number;
  totalAportes: number;
  totalAhorros: number;
  totalMultas: number;
};

export type SocioDetalle = {
  id: number | string;
  nombres: string;
  apellidos: string;
  numeroCuenta: string;
  aportes: number;
  ahorros: number;
  multas: number;
};

// ===== Utils =====
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const fmtCurrency = (n: number | null | undefined, currency = "USD", locale = "es-EC") => {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(n));
};

const fmtNumber = (n: number | null | undefined, locale = "es-EC") => {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(n));
};

const fmtDate = (iso: string | null, locale = "es-EC") => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};

// ===== Componente principal =====
export default function ResultadosPage(req: Request | NextRequest, { params }: any){
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [socios, setSocios] = useState<SocioDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof SocioDetalle | "total">("aportes");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // Fetch
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/rondas/${params.id}/resultados`)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo obtener los resultados");
        return r.json();
      })
      .then((data: any) => {
        // Soportar el shape original { resumen, socios }
        setResumen(data?.resumen ?? null);
        setSocios(Array.isArray(data?.socios) ? data.socios : []);
      })
      .catch((err: any) => setError(err?.message ?? "Error desconocido"))
      .finally(() => setLoading(false));
  }, [params.id]);

  // Derivados: filtro y orden
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? socios.filter((s) =>
          [
            s.nombres,
            s.apellidos,
            s.numeroCuenta,
            String(s.aportes),
            String(s.ahorros),
            String(s.multas),
          ]
            .filter(Boolean)
            .some((val) => String(val).toLowerCase().includes(q))
        )
      : socios;

    const sorted = [...base].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "nombres" || sortKey === "apellidos" || sortKey === "numeroCuenta") {
        return (
          String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), "es", {
            sensitivity: "base",
            numeric: true,
          }) * dir
        );
      }
      // numéricos
      return (((b as any)[sortKey] ?? 0) - ((a as any)[sortKey] ?? 0)) * (dir * -1);
    });

    return sorted;
  }, [socios, query, sortKey, sortDir]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const visible = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  // Export CSV
  function exportCSV() {
    const headers = ["Socio", "Cuenta", "Aportes", "Ahorros", "Multas"];
    const rows = filtered.map((s) => [
      `${s.nombres} ${s.apellidos}`.trim(),
      s.numeroCuenta,
      s.aportes,
      s.ahorros,
      s.multas,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => (typeof c === "string" && c.includes(",") ? `"${c}"` : c)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resultados_ronda_${resumen?.id ?? params.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Retry handler
  function retry() {
    setError(null);
    setLoading(true);
    fetch(`/api/rondas/${params.id}/resultados`)
      .then((r) => r.json())
      .then((data: any) => {
        setResumen(data?.resumen ?? null);
        setSocios(Array.isArray(data?.socios) ? data.socios : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  if (error)
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="mb-2 font-semibold">Error al cargar</div>
          <p className="mb-4 text-sm">{error}</p>
          <button onClick={retry} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Reintentar</button>
        </div>
      </div>
    );

  if (loading)
    return (
      <div className="p-6">
        <div className="mb-6 h-9 w-72 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="mb-2 h-4 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="mt-6 overflow-hidden rounded-xl border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 border-t first:border-t-0">
              <div className="h-full w-full animate-pulse bg-gray-50" />
            </div>
          ))}
        </div>
      </div>
    );

  if (!resumen)
    return (
      <div className="p-6 text-gray-600">No se encontraron resultados para esta ronda.</div>
    );

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Resultados de la Ronda: <span className="text-blue-700">{resumen.nombre}</span>
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Inicio: <strong>{fmtDate(resumen.fechaInicio)}</strong>
            <span className="mx-2 text-gray-400">•</span>
            Fin: <strong>{fmtDate(resumen.fechaFin)}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/rondas/historial"
            className="hidden rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 sm:inline-flex"
          >
            Volver al historial
          </Link>
          <button
            onClick={exportCSV}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total socios</p>
          <p className="mt-1 text-2xl font-semibold">{fmtNumber(resumen.totalSocios)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total aportes</p>
          <p className="mt-1 text-2xl font-semibold">{fmtCurrency(resumen.totalAportes)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total ahorros</p>
          <p className="mt-1 text-2xl font-semibold">{fmtCurrency(resumen.totalAhorros)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total multas</p>
          <p className="mt-1 text-2xl font-semibold">{fmtCurrency(resumen.totalMultas)}</p>
        </div>
      </section>

      {/* Filtros y tabla */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-gray-800">Detalle por socio</div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setPage(1);
                  setQuery(e.target.value);
                }}
                placeholder="Buscar por nombre, cuenta o monto…"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
                <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 4.2 12.05l3.725 3.725a.75.75 0 1 0 1.06-1.06l-3.724-3.725A6.75 6.75 0 0 0 10.5 3.75Zm-5.25 6.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
              <tr>
                {(
                  [
                    { key: "nombres", label: "Socio" },
                    { key: "numeroCuenta", label: "Cuenta" },
                    { key: "aportes", label: "Aportes" },
                    { key: "ahorros", label: "Ahorros" },
                    { key: "multas", label: "Multas" },
                  ] as const
                ).map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      "px-4 py-3 select-none",
                      c.key !== "nombres" && "text-right",
                      "cursor-pointer"
                    )}
                    onClick={() => {
                      if (sortKey === c.key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      else {
                        setSortKey(c.key);
                        setSortDir(c.key === "nombres" ? "asc" : "desc");
                      }
                    }}
                    title={`Ordenar por ${c.label}`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{c.label}</span>
                      {sortKey === c.key && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-gray-500">
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
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-600">
                    No hay resultados que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                visible.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-gray-50/70">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {`${s.nombres} ${s.apellidos}`.trim()}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.numeroCuenta}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(s.aportes)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(s.ahorros)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(s.multas)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <span>
              Mostrando <strong>{visible.length}</strong> de <strong>{filtered.length}</strong> socios
            </span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border px-2.5 py-1 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe === 1}
              >
                Anterior
              </button>
              <span className="tabular-nums">{pageSafe} / {totalPages}</span>
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
      </section>
    </div>
  );
}
