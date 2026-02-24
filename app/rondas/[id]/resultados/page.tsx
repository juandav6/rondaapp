// app/rondas/[id]/resultados/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ===== Tipos de datos =====
export type Resumen = {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string | null;
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

type SemanaResumen = {
  semana: number;
  totalAportes: number;
  totalAhorros: number;
  responsableNombre: string | null;
};

type SemanaDetalleRow = {
  socioId: number;
  orden: number;
  numeroCuenta: string;
  nombres: string;
  apellidos: string;
  aporteSemana: number;
  ahorroSemana: number;
  multaSemana: number;
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

function moneyInputToNumber(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// ===== Componente principal =====
export default function ResultadosPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [socios, setSocios] = useState<SocioDetalle[]>([]);
  const [semanas, setSemanas] = useState<SemanaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSemanas, setLoadingSemanas] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorSemanas, setErrorSemanas] = useState<string | null>(null);

  // UI state
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof SocioDetalle>("aportes");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // ===== Modal semana detalle =====
  const [openSemana, setOpenSemana] = useState<number | null>(null);
  const [semanaRows, setSemanaRows] = useState<SemanaDetalleRow[]>([]);
  const [loadingSemanaDetalle, setLoadingSemanaDetalle] = useState(false);
  const [errorSemanaDetalle, setErrorSemanaDetalle] = useState<string | null>(null);
  const [savingSemanaDetalle, setSavingSemanaDetalle] = useState(false);

  // Fetch resultados y detalle por socio (totales)
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/rondas/${id}/resultados`)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo obtener los resultados");
        return r.json();
      })
      .then((data: any) => {
        setResumen(data?.resumen ?? null);
        setSocios(Array.isArray(data?.socios) ? data.socios : []);
      })
      .catch((err: any) => setError(err?.message ?? "Error desconocido"))
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch resumen por semana
  useEffect(() => {
    setLoadingSemanas(true);
    setErrorSemanas(null);
    fetch(`/api/rondas/${id}/semanas/resumen`)
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(text || "No se pudo obtener el resumen por semana");
        }
        return r.json();
      })
      .then((data: any) => {
        const raw = Array.isArray(data?.semanas) ? data.semanas : [];
        const normalizado: SemanaResumen[] = raw
          .map((w: any) => {
            const totalAportes = w.totalAportes ?? w.total_aportes ?? w._sum?.aportes ?? 0;
            const totalAhorros = w.totalAhorros ?? w.total_ahorros ?? w._sum?.ahorros ?? 0;

            let responsableNombre: string | null = null;
            if (typeof w.responsableNombre === "string") responsableNombre = w.responsableNombre || null;
            else if (w.responsable) {
              const rn = [w.responsable.nombres, w.responsable.apellidos].filter(Boolean).join(" ").trim();
              responsableNombre = rn || null;
            } else if (w.responsable_nombres || w.responsable_apellidos) {
              const rn = [w.responsable_nombres, w.responsable_apellidos].filter(Boolean).join(" ").trim();
              responsableNombre = rn || null;
            }

            return {
              semana: Number(w.semana ?? w.week ?? 0),
              totalAportes: Number(totalAportes ?? 0),
              totalAhorros: Number(totalAhorros ?? 0),
              responsableNombre,
            };
          })
          .filter((w: SemanaResumen) => Number.isFinite(w.semana) && w.semana > 0);

        normalizado.sort((a, b) => a.semana - b.semana);
        setSemanas(normalizado);
      })
      .catch((err) => {
        setErrorSemanas(err?.message ?? "No se pudo cargar el resumen por semana");
        setSemanas([]);
      })
      .finally(() => setLoadingSemanas(false));
  }, [id]);

  async function refetchAll() {
    // Recalcular “totales” = volver a pedir APIs
    await Promise.allSettled([
      fetch(`/api/rondas/${id}/resultados`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: any) => {
          if (!data) return;
          setResumen(data?.resumen ?? null);
          setSocios(Array.isArray(data?.socios) ? data.socios : []);
        }),
      fetch(`/api/rondas/${id}/semanas/resumen`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: any) => {
          if (!data) return;
          const raw = Array.isArray(data?.semanas) ? data.semanas : [];
          const normalizado: SemanaResumen[] = raw
            .map((w: any) => ({
              semana: Number(w.semana ?? w.week ?? 0),
              totalAportes: Number(w.totalAportes ?? w.total_aportes ?? w._sum?.aportes ?? 0),
              totalAhorros: Number(w.totalAhorros ?? w.total_ahorros ?? w._sum?.ahorros ?? 0),
              responsableNombre:
                typeof w.responsableNombre === "string"
                  ? w.responsableNombre || null
                  : w.responsable
                  ? [w.responsable.nombres, w.responsable.apellidos].filter(Boolean).join(" ").trim() || null
                  : null,
            }))
            .filter((w) => Number.isFinite(w.semana) && w.semana > 0)
            .sort((a, b) => a.semana - b.semana);
          setSemanas(normalizado);
        }),
    ]);
  }

  async function openSemanaDetalle(sem: number) {
    setOpenSemana(sem);
    setLoadingSemanaDetalle(true);
    setErrorSemanaDetalle(null);
    setSemanaRows([]);

    try {
      const r = await fetch(`/api/rondas/${id}/semana/${sem}/detalles`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "No se pudo cargar el detalle de la semana");
      setSemanaRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e: any) {
      setErrorSemanaDetalle(e?.message ?? "Error al cargar el detalle de la semana");
    } finally {
      setLoadingSemanaDetalle(false);
    }
  }

  function closeSemanaDetalle() {
    setOpenSemana(null);
    setSemanaRows([]);
    setErrorSemanaDetalle(null);
    setSavingSemanaDetalle(false);
  }

  async function saveSemanaDetalle() {
    if (!openSemana) return;
    try {
      setSavingSemanaDetalle(true);
      const payload = {
        updates: semanaRows.map((r) => ({
          socioId: r.socioId,
          aporteSemana: Number(r.aporteSemana) || 0,
          ahorroSemana: Number(r.ahorroSemana) || 0,
        })),
      };

      const res = await fetch(`/api/rondas/${id}/semanas/${openSemana}/detalles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar los cambios");

      // refrescamos totales y resumen por semana
      await refetchAll();
      closeSemanaDetalle();
    } catch (e: any) {
      setErrorSemanaDetalle(e?.message ?? "Error al guardar cambios");
      setSavingSemanaDetalle(false);
    }
  }

  // Derivados: filtro y orden de la tabla por socio
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? socios.filter((s) =>
          [s.nombres, s.apellidos, s.numeroCuenta, String(s.aportes), String(s.ahorros), String(s.multas)]
            .filter(Boolean)
            .some((val) => String(val).toLowerCase().includes(q))
        )
      : socios;

    const sorted = [...base].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;

      if (sortKey === "nombres" || sortKey === "apellidos" || sortKey === "numeroCuenta") {
        return (
          String((a as any)[sortKey] ?? "").localeCompare(String((b as any)[sortKey] ?? ""), "es", {
            sensitivity: "base",
            numeric: true,
          }) * dir
        );
      }

      const av = Number((a as any)[sortKey] ?? 0);
      const bv = Number((b as any)[sortKey] ?? 0);
      // si desc, queremos bv-av
      return (bv - av) * (sortDir === "asc" ? -1 : 1);
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
    a.download = `resultados_ronda_${resumen?.id ?? id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error)
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="mb-2 font-semibold">Error al cargar</div>
          <p className="mb-0 text-sm">{error}</p>
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
      </div>
    );

  if (!resumen) return <div className="p-6 text-gray-600">No se encontraron resultados para esta ronda.</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Resultados de la ronda: <span className="text-blue-700">{resumen.nombre}</span>
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Inicio: <strong>{fmtDate(resumen.fechaInicio)}</strong>
                <span className="mx-2 text-gray-400">•</span>
                Fin: <strong>{fmtDate(resumen.fechaFin)}</strong>
              </p>
            </div>
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

      {/* Resumen por semana */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-gray-50 p-3">
          <div className="text-sm font-medium text-gray-800">Historial por semana</div>
          {loadingSemanas && <div className="text-xs text-gray-500">Cargando…</div>}
        </div>

        {errorSemanas ? (
          <div className="p-4 text-sm text-gray-600">
            {errorSemanas} — Si aún no tienes este endpoint, créalo en{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5">/api/rondas/[id]/semanas/resumen</code>.
          </div>
        ) : semanas.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No hay datos de semanas para esta ronda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3">Semana</th>
                  <th className="px-4 py-3 text-right">Aportes</th>
                  <th className="px-4 py-3 text-right">Ahorros</th>
                  <th className="px-4 py-3">Responsable</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {semanas.map((w) => (
                  <tr key={w.semana} className="border-t hover:bg-gray-50/70">
                    <td className="px-4 py-3 font-medium text-gray-900">#{w.semana}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(w.totalAportes)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(w.totalAhorros)}</td>
                    <td className="px-4 py-3">{w.responsableNombre || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openSemanaDetalle(w.semana)}
                        className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Ver y editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Detalle por socio */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-gray-800">Totales por socio (toda la ronda)</div>
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
                    className={cn("px-4 py-3 select-none", c.key !== "nombres" && "text-right", "cursor-pointer")}
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
                        <span className="text-gray-500">{sortDir === "asc" ? "▲" : "▼"}</span>
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
                    <td className="px-4 py-3 font-medium text-gray-900">{`${s.nombres} ${s.apellidos}`.trim()}</td>
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
      </section>

      {/* ===== Modal Ver y editar semana ===== */}
      {openSemana != null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={closeSemanaDetalle} />
          <div className="relative z-50 w-full sm:max-w-4xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Semana #{openSemana}</h3>
                <p className="text-sm text-gray-500">Editar aporte y ahorro por socio (recalcula totales al guardar).</p>
              </div>
              <button onClick={closeSemanaDetalle} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
                ✕
              </button>
            </div>

            <div className="mt-4">
              {loadingSemanaDetalle ? (
                <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">Cargando detalle…</div>
              ) : errorSemanaDetalle ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {errorSemanaDetalle}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Socio</th>
                        <th className="px-4 py-3">Cuenta</th>
                        <th className="px-4 py-3 text-right">Aporte</th>
                        <th className="px-4 py-3 text-right">Ahorro</th>
                        <th className="px-4 py-3 text-right">Multa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semanaRows.map((r, idx) => (
                        <tr key={r.socioId} className="border-t">
                          <td className="px-4 py-3 text-gray-600">{r.orden ?? idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {r.nombres} {r.apellidos}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{r.numeroCuenta}</td>

                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={r.aporteSemana}
                              onChange={(e) => {
                                const v = moneyInputToNumber(e.target.value);
                                setSemanaRows((prev) =>
                                  prev.map((x) => (x.socioId === r.socioId ? { ...x, aporteSemana: v } : x))
                                );
                              }}
                              className="w-28 rounded-md border px-2 py-1 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                          </td>

                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={r.ahorroSemana}
                              onChange={(e) => {
                                const v = moneyInputToNumber(e.target.value);
                                setSemanaRows((prev) =>
                                  prev.map((x) => (x.socioId === r.socioId ? { ...x, ahorroSemana: v } : x))
                                );
                              }}
                              className="w-28 rounded-md border px-2 py-1 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                          </td>

                          <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                            {fmtCurrency(r.multaSemana)}
                          </td>
                        </tr>
                      ))}
                      {semanaRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-gray-600">
                            No hay detalle para esta semana.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={closeSemanaDetalle}
                className="px-4 py-2 rounded-md border text-gray-700 hover:bg-gray-50"
                disabled={savingSemanaDetalle}
              >
                Cancelar
              </button>
              <button
                onClick={saveSemanaDetalle}
                disabled={savingSemanaDetalle || loadingSemanaDetalle}
                className={cn(
                  "px-4 py-2 rounded-md text-white",
                  savingSemanaDetalle ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {savingSemanaDetalle ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

