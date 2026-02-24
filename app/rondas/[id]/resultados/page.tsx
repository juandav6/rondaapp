// app/rondas/[id]/resultados/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
  activa?: boolean; // opcional si tu API lo envía
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

type SemanaDetalleItem = {
  socioId: number;
  nombres: string;
  apellidos: string;
  numeroCuenta: string;
  aporte: number; // monto aporte en esa semana
  ahorro: number; // monto ahorro en esa semana
};

// ===== Utils =====
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const fmtCurrency = (n: number | null | undefined, currency = "USD", locale = "es-EC") => {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(n));
};

const fmtNumber = (n: number | null | undefined, locale = "es-EC") => {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(n));
};

const fmtDate = (iso: string | null, locale = "es-EC") => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

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
  const [sortKey, setSortKey] = useState<keyof SocioDetalle | "total">("aportes");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // ====== Modal detalle semana ======
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [weekItems, setWeekItems] = useState<SemanaDetalleItem[]>([]);
  const [weekDirty, setWeekDirty] = useState<Record<number, { aporte: number; ahorro: number }>>({});
  const [weekSaving, setWeekSaving] = useState(false);
  const [weekSuccess, setWeekSuccess] = useState<string | null>(null);

  const esRondaEnCurso = !!(resumen?.activa || resumen?.fechaFin === null);

  // ========= Fetch principales =========
  async function fetchResultados() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/rondas/${id}/resultados`);
      if (!r.ok) throw new Error("No se pudo obtener los resultados");
      const data = await r.json();
      setResumen(data?.resumen ?? null);
      setSocios(Array.isArray(data?.socios) ? data.socios : []);
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSemanas() {
    setLoadingSemanas(true);
    setErrorSemanas(null);
    try {
      const r = await fetch(`/api/rondas/${id}/semanas/resumen`);
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || "No se pudo obtener el resumen por semana");
      }
      const data = await r.json();
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
        .filter((w) => Number.isFinite(w.semana) && w.semana > 0)
        .sort((a, b) => a.semana - b.semana);

      setSemanas(normalizado);
    } catch (e: any) {
      setErrorSemanas(e?.message ?? "No se pudo cargar el resumen por semana");
      setSemanas([]);
    } finally {
      setLoadingSemanas(false);
    }
  }

  useEffect(() => {
    fetchResultados();
    fetchSemanas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ========= Abrir detalle de semana =========
  async function openDetalleSemana(semana: number) {
    setOpenWeek(semana);
    setWeekError(null);
    setWeekSuccess(null);
    setWeekDirty({});
    setWeekLoading(true);

    try {
      const r = await fetch(`/api/rondas/${id}/semanas/${semana}/detalle`);
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || "No se pudo cargar el detalle de la semana");
      }
      const data = await r.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const normalized: SemanaDetalleItem[] = items.map((x: any) => ({
        socioId: Number(x.socioId ?? x.socio_id),
        nombres: String(x.nombres ?? ""),
        apellidos: String(x.apellidos ?? ""),
        numeroCuenta: String(x.numeroCuenta ?? x.numero_cuenta ?? ""),
        aporte: toNum(x.aporte ?? x.montoAporte ?? x.aportes ?? 0),
        ahorro: toNum(x.ahorro ?? x.montoAhorro ?? x.ahorros ?? 0),
      }));
      setWeekItems(normalized);
    } catch (e: any) {
      setWeekError(e?.message ?? "Error al cargar detalle");
      setWeekItems([]);
    } finally {
      setWeekLoading(false);
    }
  }

  function closeDetalleSemana() {
    setOpenWeek(null);
    setWeekItems([]);
    setWeekDirty({});
    setWeekError(null);
    setWeekSuccess(null);
    setWeekSaving(false);
  }

  function setWeekField(socioId: number, field: "aporte" | "ahorro", value: number) {
    setWeekDirty((prev) => {
      const base = prev[socioId] ?? {
        aporte: weekItems.find((i) => i.socioId === socioId)?.aporte ?? 0,
        ahorro: weekItems.find((i) => i.socioId === socioId)?.ahorro ?? 0,
      };
      return { ...prev, [socioId]: { ...base, [field]: value } };
    });
  }

  const weekHasChanges = useMemo(() => Object.keys(weekDirty).length > 0, [weekDirty]);

  async function saveDetalleSemana() {
    if (openWeek == null) return;
    try {
      setWeekSaving(true);
      setWeekError(null);
      setWeekSuccess(null);

      const payload = {
        items: Object.entries(weekDirty).map(([socioId, v]) => ({
          socioId: Number(socioId),
          aporte: toNum(v.aporte),
          ahorro: toNum(v.ahorro),
        })),
      };

      const r = await fetch(`/api/rondas/${id}/semanas/${openWeek}/detalle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "No se pudo guardar");

      setWeekSuccess("Cambios guardados y totales recalculados ✅");

      // refrescar UI principal (KPIs, resumen por semana, totales por socio)
      await Promise.all([fetchResultados(), fetchSemanas()]);

      // refrescar detalle semana para reflejar lo guardado
      await openDetalleSemana(openWeek);
    } catch (e: any) {
      setWeekError(e?.message ?? "Error al guardar");
    } finally {
      setWeekSaving(false);
    }
  }

  // ========= Derivados tabla por socio =========
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const baseArr = q
      ? socios.filter((s) =>
          [s.nombres, s.apellidos, s.numeroCuenta, String(s.aportes), String(s.ahorros), String(s.multas)]
            .filter(Boolean)
            .some((val) => String(val).toLowerCase().includes(q))
        )
      : socios;

    const sorted = [...baseArr].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "nombres" || sortKey === "apellidos" || sortKey === "numeroCuenta") {
        return (
          String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), "es", {
            sensitivity: "base",
            numeric: true,
          }) * dir
        );
      }
      return (((b as any)[sortKey] ?? 0) - ((a as any)[sortKey] ?? 0)) * (dir * -1);
    });

    return sorted;
  }, [socios, query, sortKey, sortDir]);

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

  // Retry
  function retry() {
    fetchResultados();
    fetchSemanas();
  }

  // ========= Estados =========
  if (error)
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="mb-2 font-semibold">Error al cargar</div>
          <p className="mb-4 text-sm">{error}</p>
          <button
            onClick={retry}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Reintentar
          </button>
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

  if (!resumen) return <div className="p-6 text-gray-600">No se encontraron resultados para esta ronda.</div>;

  // ========= UI =========
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
                {esRondaEnCurso && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    Activa
                  </span>
                )}
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
          <p className="text-xs text-gray-500">{esRondaEnCurso ? "Aportes hasta el momento" : "Total aportes"}</p>
          <p className="mt-1 text-2xl font-semibold">{fmtCurrency(resumen.totalAportes)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">{esRondaEnCurso ? "Ahorros hasta el momento" : "Total ahorros"}</p>
          <p className="mt-1 text-2xl font-semibold">{fmtCurrency(resumen.totalAhorros)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">{esRondaEnCurso ? "Multas hasta el momento" : "Total multas"}</p>
          <p className="mt-1 text-2xl font-semibold">{fmtCurrency(resumen.totalMultas)}</p>
        </div>
      </section>

      {/* Resumen por semana + acceso a detalle */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-gray-50 p-3">
          <div className="text-sm font-medium text-gray-800">
            Resumen por semana{" "}
            <span className="ml-2 text-xs font-normal text-gray-500">
              (clic en una semana para ver/editar detalle)
            </span>
          </div>
          {loadingSemanas && <div className="text-xs text-gray-500">Cargando…</div>}
        </div>

        {errorSemanas ? (
          <div className="p-4 text-sm text-gray-600">
            {errorSemanas} — Verifica tu endpoint{" "}
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
                        onClick={() => openDetalleSemana(w.semana)}
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-gray-600">
                          <path d="M21.31 10.29c.39.39.39 1.02 0 1.41l-7.6 7.6a4 4 0 0 1-1.94 1.06l-3.17.79a1 1 0 0 1-1.21-1.21l.79-3.17a4 4 0 0 1 1.06-1.94l7.6-7.6c.39-.39 1.02-.39 1.41 0l3.06 3.06ZM15.6 8.2l-6.9 6.9a2 2 0 0 0-.53.97l-.44 1.77 1.77-.44a2 2 0 0 0 .97-.53l6.9-6.9-1.77-1.77Z" />
                        </svg>
                        Ver / editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Tabla por socio */}
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
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-gray-500">
                          {sortDir === "asc" ? <path d="M12 8l-4 4h8l-4-4z" /> : <path d="M12 16l4-4H8l4 4z" />}
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
      </section>

      {/* ===== Modal: Detalle semanal ===== */}
      {openWeek != null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={closeDetalleSemana} />
          <div className="relative z-50 w-full sm:max-w-5xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b p-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Detalle de la semana #{openWeek}</h3>
                <p className="text-sm text-gray-500">Edita aporte/ahorro por socio. Al guardar se recalculan totales.</p>
              </div>
              <button onClick={closeDetalleSemana} className="text-gray-400 hover:text-gray-600" title="Cerrar">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.4 5l12.6 12.6-1.4 1.4L5 6.4 6.4 5z" />
                  <path d="M18.6 5L5.9 17.6l1.4 1.4L20 6.4 18.6 5z" />
                </svg>
              </button>
            </div>

            <div className="p-5">
              {weekError && <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{weekError}</div>}
              {weekSuccess && <div className="mb-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{weekSuccess}</div>}

              {weekLoading ? (
                <div className="p-8 text-center text-gray-600">Cargando detalle…</div>
              ) : weekItems.length === 0 ? (
                <div className="p-8 text-center text-gray-600">No hay datos para esta semana.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left">Socio</th>
                        <th className="px-4 py-3 text-left">Cuenta</th>
                        <th className="px-4 py-3 text-right">Aporte</th>
                        <th className="px-4 py-3 text-right">Ahorro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekItems.map((it) => {
                        const dirty = weekDirty[it.socioId];
                        const aporteVal = dirty?.aporte ?? it.aporte;
                        const ahorroVal = dirty?.ahorro ?? it.ahorro;

                        return (
                          <tr key={it.socioId} className="border-t hover:bg-gray-50/60">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {it.nombres} {it.apellidos}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{it.numeroCuenta}</td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                className="w-28 rounded-md border px-2 py-1 text-right outline-none focus:border-blue-500"
                                value={Number.isFinite(aporteVal) ? aporteVal : 0}
                                onChange={(e) => setWeekField(it.socioId, "aporte", toNum(e.target.value))}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                className="w-28 rounded-md border px-2 py-1 text-right outline-none focus:border-blue-500"
                                value={Number.isFinite(ahorroVal) ? ahorroVal : 0}
                                onChange={(e) => setWeekField(it.socioId, "ahorro", toNum(e.target.value))}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-gray-500">
                  Tip: puedes corregir valores y luego guardar. Esto refresca KPIs y totales automáticamente.
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={closeDetalleSemana}
                    className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={saveDetalleSemana}
                    disabled={weekSaving || !weekHasChanges}
                    className={cn(
                      "rounded-md px-4 py-2 text-sm font-medium text-white",
                      weekSaving || !weekHasChanges ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                    )}
                  >
                    {weekSaving ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
