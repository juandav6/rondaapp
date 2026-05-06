// app/rondas/[id]/resultados/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ===== Tipos =====
type Resumen = {
  id: number;
  nombre: string;
  activa: boolean;
  fechaInicio: string;
  fechaFin: string | null;
  totalSocios: number;
  totalAportes: number;
  totalAhorros: number;
  totalMultas: number;
  totalInteresGenerado: number;
  totalPrestamos: number;
};

type SocioDetalle = {
  id: number | string;
  nombres: string;
  apellidos: string;
  numeroCuenta: string;
  aportes: number;
  ahorros: number;
  multas: number;
  proporcion: number;       // % con 2 decimales
  interesGanado: number;
};

type PrestamoRonda = {
  id: number;
  estado: string;
  monto: number;
  tasaAnual: number;
  plazoMeses: number;
  saldoActual: number;
  totalInteres: number;
  totalAPagar: number;
  cuotasPagadas: number;
  totalCuotas: number;
  socio: { id: number; nombres: string; apellidos: string; numeroCuenta: string };
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
function cn(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

const fmtCurrency = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n));
};
const fmtPct = (n: number) => `${n.toFixed(2)}%`;
const fmtNumber = (n: number | null | undefined) => {
  if (n == null) return "-";
  return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(Number(n));
};
const fmtDate = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};
const moneyInputToNumber = (v: string) => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };

// ===== Page =====
export default function ResultadosPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [socios, setSocios] = useState<SocioDetalle[]>([]);
  const [prestamos, setPrestamos] = useState<PrestamoRonda[]>([]);
  const [semanas, setSemanas] = useState<SemanaResumen[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingSemanas, setLoadingSemanas] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorSemanas, setErrorSemanas] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof SocioDetalle>("aportes");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // Modal semana
  const [openSemana, setOpenSemana] = useState<number | null>(null);
  const [semanaRows, setSemanaRows] = useState<SemanaDetalleRow[]>([]);
  const [loadingSemanaDetalle, setLoadingSemanaDetalle] = useState(false);
  const [errorSemanaDetalle, setErrorSemanaDetalle] = useState<string | null>(null);
  const [savingSemanaDetalle, setSavingSemanaDetalle] = useState(false);

  const weekDetailUrl = (sem: number) => `/api/rondas/${id}/semana/${sem}/detalle`;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/rondas/${id}/resultados`)
      .then((r) => { if (!r.ok) throw new Error("No se pudo obtener los resultados"); return r.json(); })
      .then((data: any) => {
        setResumen(data?.resumen ?? null);
        setSocios(Array.isArray(data?.socios) ? data.socios : []);
        setPrestamos(Array.isArray(data?.prestamos) ? data.prestamos : []);
      })
      .catch((err: any) => setError(err?.message ?? "Error desconocido"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setLoadingSemanas(true);
    fetch(`/api/rondas/${id}/semanas/resumen`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text().catch(() => "") || "Error al cargar semanas");
        return r.json();
      })
      .then((data: any) => {
        const raw = Array.isArray(data?.semanas) ? data.semanas : [];
        const norm: SemanaResumen[] = raw.map((w: any) => {
          let responsableNombre: string | null = null;
          if (typeof w.responsableNombre === "string") responsableNombre = w.responsableNombre || null;
          else if (w.responsable) responsableNombre = [w.responsable.nombres, w.responsable.apellidos].filter(Boolean).join(" ").trim() || null;
          return {
            semana: Number(w.semana ?? 0),
            totalAportes: Number(w.totalAportes ?? 0),
            totalAhorros: Number(w.totalAhorros ?? 0),
            responsableNombre,
          };
        }).filter((w: SemanaResumen) => w.semana > 0).sort((a: SemanaResumen, b: SemanaResumen) => a.semana - b.semana);
        setSemanas(norm);
      })
      .catch((err) => { setErrorSemanas(err?.message); setSemanas([]); })
      .finally(() => setLoadingSemanas(false));
  }, [id]);

  async function refetchAll() {
    const [r1, r2] = await Promise.allSettled([
      fetch(`/api/rondas/${id}/resultados`).then(r => r.ok ? r.json() : null),
      fetch(`/api/rondas/${id}/semanas/resumen`).then(r => r.ok ? r.json() : null),
    ]);
    if (r1.status === "fulfilled" && r1.value) {
      setResumen(r1.value?.resumen ?? null);
      setSocios(Array.isArray(r1.value?.socios) ? r1.value.socios : []);
      setPrestamos(Array.isArray(r1.value?.prestamos) ? r1.value.prestamos : []);
    }
    if (r2.status === "fulfilled" && r2.value) {
      const raw = Array.isArray(r2.value?.semanas) ? r2.value.semanas : [];
      setSemanas(raw.map((w: any) => ({
        semana: Number(w.semana ?? 0),
        totalAportes: Number(w.totalAportes ?? 0),
        totalAhorros: Number(w.totalAhorros ?? 0),
        responsableNombre: typeof w.responsableNombre === "string" ? w.responsableNombre || null : null,
      })).filter((w: SemanaResumen) => w.semana > 0).sort((a: SemanaResumen, b: SemanaResumen) => a.semana - b.semana));
    }
  }

  async function openSemanaDetalle(sem: number) {
    setOpenSemana(sem); setLoadingSemanaDetalle(true); setErrorSemanaDetalle(null); setSemanaRows([]);
    try {
      const r = await fetch(weekDetailUrl(sem));
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "No se pudo cargar el detalle");
      setSemanaRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e: any) { setErrorSemanaDetalle(e?.message); }
    finally { setLoadingSemanaDetalle(false); }
  }

  function closeSemanaDetalle() { setOpenSemana(null); setSemanaRows([]); setErrorSemanaDetalle(null); setSavingSemanaDetalle(false); }

  async function saveSemanaDetalle() {
    if (openSemana == null) return;
    try {
      setSavingSemanaDetalle(true);
      const res = await fetch(weekDetailUrl(openSemana), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: semanaRows.map(r => ({ socioId: r.socioId, aporteSemana: Number(r.aporteSemana) || 0, ahorroSemana: Number(r.ahorroSemana) || 0 })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar");
      await refetchAll(); closeSemanaDetalle();
    } catch (e: any) { setErrorSemanaDetalle(e?.message); setSavingSemanaDetalle(false); }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? socios.filter(s =>
      [s.nombres, s.apellidos, s.numeroCuenta].some(v => String(v).toLowerCase().includes(q))
    ) : socios;
    return [...base].sort((a, b) => {
      if (sortKey === "nombres" || sortKey === "apellidos" || sortKey === "numeroCuenta") {
        return String((a as any)[sortKey] ?? "").localeCompare(String((b as any)[sortKey] ?? ""), "es", { sensitivity: "base", numeric: true }) * (sortDir === "asc" ? 1 : -1);
      }
      const av = Number((a as any)[sortKey] ?? 0), bv = Number((b as any)[sortKey] ?? 0);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [socios, query, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const visible = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function exportCSV() {
    const headers = ["Socio", "Cuenta", "Aportes", "% del total", "Ahorros", "Multas", "Interés ganado"];
    const rows = filtered.map(s => [`${s.nombres} ${s.apellidos}`.trim(), s.numeroCuenta, s.aportes, `${s.proporcion}%`, s.ahorros, s.multas, s.interesGanado]);
    const csv = [headers, ...rows].map(r => r.map(c => typeof c === "string" && c.includes(",") ? `"${c}"` : c).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `resultados_ronda_${resumen?.id ?? id}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (error) return <div className="p-6"><div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"><p className="font-semibold">Error al cargar</p><p className="text-sm">{error}</p></div></div>;
  if (loading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}</div>;
  if (!resumen) return <div className="p-6 text-gray-600">No se encontraron resultados para esta ronda.</div>;

  const rondaCerrada = !resumen.activa;

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
                <span className="mx-2 text-gray-400">•</span>
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", rondaCerrada ? "bg-gray-100 text-gray-600" : "bg-emerald-100 text-emerald-700")}>
                  {rondaCerrada ? "Cerrada" : "Activa"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/rondas/historial" className="hidden rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 sm:inline-flex">Volver al historial</Link>
            <button onClick={exportCSV} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700">Exportar CSV</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Total socios", value: fmtNumber(resumen.totalSocios), color: "" },
          { label: "Total aportes", value: fmtCurrency(resumen.totalAportes), color: "" },
          { label: "Total ahorros", value: fmtCurrency(resumen.totalAhorros), color: "" },
          { label: "Total multas", value: fmtCurrency(resumen.totalMultas), color: "text-rose-600" },
          { label: "Interés generado", value: fmtCurrency(resumen.totalInteresGenerado), color: "text-emerald-600", note: `${resumen.totalPrestamos} préstamo${resumen.totalPrestamos !== 1 ? "s" : ""}` },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={cn("mt-1 text-xl font-semibold", k.color || "text-gray-900")}>{k.value}</p>
            {k.note && <p className="text-xs text-gray-400 mt-0.5">{k.note}</p>}
          </div>
        ))}
      </section>

      {/* ── Préstamos de la ronda ── */}
      {prestamos.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Préstamos generados en esta ronda</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Total interés proyectado: <strong className="text-emerald-700">{fmtCurrency(resumen.totalInteresGenerado)}</strong>
              </p>
            </div>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{prestamos.length} préstamo{prestamos.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3">Socio</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-right">Tasa mensual</th>
                  <th className="px-4 py-3 text-right">Plazo</th>
                  <th className="px-4 py-3 text-right">Interés total</th>
                  <th className="px-4 py-3 text-right">Total a pagar</th>
                  <th className="px-4 py-3 text-center">Cuotas</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {prestamos.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-gray-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.socio.nombres} {p.socio.apellidos}</p>
                      <p className="text-xs text-gray-500 font-mono">{p.socio.numeroCuenta}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtCurrency(p.monto)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.tasaAnual}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.plazoMeses} m</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">{fmtCurrency(p.totalInteres)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(p.totalAPagar)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-gray-700">{p.cuotasPagadas}/{p.totalCuotas}</span>
                      <div className="mx-auto mt-1 h-1.5 w-16 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${p.totalCuotas > 0 ? (p.cuotasPagadas / p.totalCuotas) * 100 : 0}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        p.estado === "CANCELADO" ? "bg-emerald-100 text-emerald-700" :
                        p.estado === "MORA" ? "bg-rose-100 text-rose-700" :
                        "bg-blue-100 text-blue-700"
                      )}>{p.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700" colSpan={4}>Total</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">{fmtCurrency(resumen.totalInteresGenerado)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">{fmtCurrency(prestamos.reduce((a, p) => a + p.totalAPagar, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* ── Distribución de intereses (solo ronda cerrada) ── */}
      {rondaCerrada && resumen.totalInteresGenerado > 0 && (
        <section className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
          <div className="border-b bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-800">💰 Distribución de intereses al cierre de la ronda</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Total a distribuir: <strong>{fmtCurrency(resumen.totalInteresGenerado)}</strong> · proporcional a los aportes de cada socio
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3">Socio</th>
                  <th className="px-4 py-3 text-right">Aportes</th>
                  <th className="px-4 py-3 text-right">% del total</th>
                  <th className="px-4 py-3 text-right">Interés ganado</th>
                </tr>
              </thead>
              <tbody>
                {[...socios].sort((a, b) => b.proporcion - a.proporcion).map((s) => (
                  <tr key={s.id} className="border-t hover:bg-gray-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                      <p className="text-xs text-gray-500 font-mono">{s.numeroCuenta}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(s.aportes)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(s.proporcion, 100)}%` }} />
                        </div>
                        <span>{fmtPct(s.proporcion)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">{fmtCurrency(s.interesGanado)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">{fmtCurrency(resumen.totalAportes)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">100%</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">{fmtCurrency(resumen.totalInteresGenerado)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Aviso si la ronda está activa y hay préstamos */}
      {!rondaCerrada && prestamos.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⏳ La distribución de intereses estará disponible cuando se cierre la ronda. Interés proyectado actual: <strong>{fmtCurrency(resumen.totalInteresGenerado)}</strong>
        </div>
      )}

      {/* Historial por semana */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-800">Historial por semana</p>
          {loadingSemanas && <p className="text-xs text-gray-500">Cargando…</p>}
        </div>
        {errorSemanas ? (
          <p className="p-4 text-sm text-gray-600">{errorSemanas}</p>
        ) : semanas.length === 0 ? (
          <p className="p-4 text-sm text-gray-600">No hay datos de semanas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
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
                      <button onClick={() => openSemanaDetalle(w.semana)} className="rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Ver y editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Totales por socio */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-gray-800">Totales por socio (toda la ronda)</p>
          <input
            type="text" value={query}
            onChange={(e) => { setPage(1); setQuery(e.target.value); }}
            placeholder="Buscar por nombre o cuenta…"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 sm:w-72"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
              <tr>
                {([
                  { key: "nombres", label: "Socio" },
                  { key: "numeroCuenta", label: "Cuenta" },
                  { key: "aportes", label: "Aportes" },
                  { key: "ahorros", label: "Ahorros" },
                  { key: "multas", label: "Multas" },
                  { key: "interesGanado", label: "Interés ganado" },
                ] as const).map((c) => (
                  <th key={c.key} className={cn("px-4 py-3 cursor-pointer select-none", c.key !== "nombres" && "text-right")}
                    onClick={() => { if (sortKey === c.key) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(c.key); setSortDir("desc"); } }}>
                    <span>{c.label}</span>
                    {sortKey === c.key && <span className="ml-1 text-gray-400">{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-600">Sin resultados.</td></tr>
              ) : visible.map((s) => (
                <tr key={s.id} className="border-t hover:bg-gray-50/70">
                  <td className="px-4 py-3 font-medium text-gray-900">{`${s.nombres} ${s.apellidos}`.trim()}</td>
                  <td className="px-4 py-3 text-gray-700">{s.numeroCuenta}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(s.aportes)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(s.ahorros)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(s.multas)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {rondaCerrada
                      ? <span className="font-semibold text-emerald-700">{fmtCurrency(s.interesGanado)}</span>
                      : <span className="text-xs text-gray-400 italic">Al cierre</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <span>Mostrando <strong>{visible.length}</strong> de <strong>{filtered.length}</strong></span>
            <div className="flex items-center gap-2">
              <button className="rounded-md border px-2.5 py-1 disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe === 1}>Anterior</button>
              <span>{pageSafe} / {totalPages}</span>
              <button className="rounded-md border px-2.5 py-1 disabled:opacity-50" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}>Siguiente</button>
            </div>
          </div>
        )}
      </section>

      {/* Modal semana */}
      {openSemana != null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={closeSemanaDetalle} />
          <div className="relative z-50 w-full sm:max-w-4xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Semana #{openSemana}</h3>
                <p className="text-sm text-gray-500">Editar aporte y ahorro por socio.</p>
              </div>
              <button onClick={closeSemanaDetalle} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {loadingSemanaDetalle ? (
              <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">Cargando…</div>
            ) : errorSemanaDetalle ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorSemanaDetalle}</div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-4 py-3">#</th><th className="px-4 py-3">Socio</th><th className="px-4 py-3">Cuenta</th>
                      <th className="px-4 py-3 text-right">Aporte</th><th className="px-4 py-3 text-right">Ahorro</th><th className="px-4 py-3 text-right">Multa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semanaRows.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-600">No hay detalle para esta semana.</td></tr>
                    ) : semanaRows.map((r, idx) => (
                      <tr key={r.socioId} className="border-t">
                        <td className="px-4 py-3 text-gray-600">{r.orden ?? idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.nombres} {r.apellidos}</td>
                        <td className="px-4 py-3 text-gray-700">{r.numeroCuenta}</td>
                        <td className="px-4 py-3 text-right">
                          <input type="number" step="0.01" value={r.aporteSemana}
                            onChange={(e) => { const v = moneyInputToNumber(e.target.value); setSemanaRows(prev => prev.map(x => x.socioId === r.socioId ? { ...x, aporteSemana: v } : x)); }}
                            className="w-28 rounded-md border px-2 py-1 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input type="number" step="0.01" value={r.ahorroSemana}
                            onChange={(e) => { const v = moneyInputToNumber(e.target.value); setSemanaRows(prev => prev.map(x => x.socioId === r.socioId ? { ...x, ahorroSemana: v } : x)); }}
                            className="w-28 rounded-md border px-2 py-1 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">{fmtCurrency(r.multaSemana)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={closeSemanaDetalle} disabled={savingSemanaDetalle} className="px-4 py-2 rounded-md border text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={saveSemanaDetalle} disabled={savingSemanaDetalle || loadingSemanaDetalle}
                className={cn("px-4 py-2 rounded-md text-white", savingSemanaDetalle ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700")}>
                {savingSemanaDetalle ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
