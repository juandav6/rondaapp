// app/rondas/[id]/resultados/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Resumen = {
  id: number; nombre: string; activa: boolean;
  fechaInicio: string; fechaFin: string | null;
  totalSocios: number; totalAportes: number; totalAhorros: number;
  totalMultas: number; totalFondoInversion: number;
  totalInteresGenerado: number; totalInteresProyectado: number;
  totalPrestamos: number;
};

type SocioDetalle = {
  id: number | string;
  nombres: string; apellidos: string; numeroCuenta: string;
  aportes: number; ahorros: number; multas: number;
  montoInvertido: number;
  proporcion: number;
  interesGanado: number;
  totalARecibir: number;
};

type PrestamoRonda = {
  id: number; estado: string; monto: number; tasaAnual: number;
  plazoMeses: number; saldoActual: number; totalInteres: number;
  totalAPagar: number; cuotasPagadas: number; totalCuotas: number;
  socio: { id: number; nombres: string; apellidos: string; numeroCuenta: string };
};

type SemanaResumen = {
  semana: number; totalAportes: number; totalAhorros: number;
  responsableNombre: string | null;
};

type SemanaDetalleRow = {
  socioId: number; orden: number; numeroCuenta: string;
  nombres: string; apellidos: string;
  aporteSemana: number; ahorroSemana: number; multaSemana: number;
};

function cn(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

const fmt = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n));
};
const fmtPct = (n: number) => `${n.toFixed(2)}%`;
const fmtNum = (n: number | null | undefined) => n == null ? "-" : new Intl.NumberFormat("es-EC").format(Number(n));
const fmtDate = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};
const toNum = (v: string) => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };

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
  const [sortKey, setSortKey] = useState<keyof SocioDetalle>("montoInvertido");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const [openSemana, setOpenSemana] = useState<number | null>(null);
  const [semanaRows, setSemanaRows] = useState<SemanaDetalleRow[]>([]);
  const [loadingSemDet, setLoadingSemDet] = useState(false);
  const [errorSemDet, setErrorSemDet] = useState<string | null>(null);
  const [savingSemDet, setSavingSemDet] = useState(false);

  const weekUrl = (sem: number) => `/api/rondas/${id}/semana/${sem}/detalle`;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/rondas/${id}/resultados`)
      .then(r => { if (!r.ok) throw new Error("No se pudo obtener los resultados"); return r.json(); })
      .then((d: any) => { setResumen(d?.resumen ?? null); setSocios(d?.socios ?? []); setPrestamos(d?.prestamos ?? []); })
      .catch((e: any) => setError(e?.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setLoadingSemanas(true);
    fetch(`/api/rondas/${id}/semanas/resumen`)
      .then(async r => { if (!r.ok) throw new Error("Error semanas"); return r.json(); })
      .then((d: any) => {
        const raw = Array.isArray(d?.semanas) ? d.semanas : [];
        setSemanas(raw.map((w: any) => ({
          semana: Number(w.semana ?? 0),
          totalAportes: Number(w.totalAportes ?? 0),
          totalAhorros: Number(w.totalAhorros ?? 0),
          responsableNombre: typeof w.responsableNombre === "string" ? w.responsableNombre || null
            : w.responsable ? [w.responsable.nombres, w.responsable.apellidos].filter(Boolean).join(" ").trim() || null : null,
        })).filter((w: SemanaResumen) => w.semana > 0).sort((a: SemanaResumen, b: SemanaResumen) => a.semana - b.semana));
      })
      .catch((e: any) => { setErrorSemanas(e?.message); setSemanas([]); })
      .finally(() => setLoadingSemanas(false));
  }, [id]);

  async function refetchAll() {
    const [r1, r2] = await Promise.allSettled([
      fetch(`/api/rondas/${id}/resultados`).then(r => r.ok ? r.json() : null),
      fetch(`/api/rondas/${id}/semanas/resumen`).then(r => r.ok ? r.json() : null),
    ]);
    if (r1.status === "fulfilled" && r1.value) { setResumen(r1.value?.resumen); setSocios(r1.value?.socios ?? []); setPrestamos(r1.value?.prestamos ?? []); }
    if (r2.status === "fulfilled" && r2.value) {
      setSemanas((r2.value?.semanas ?? []).map((w: any) => ({
        semana: Number(w.semana ?? 0), totalAportes: Number(w.totalAportes ?? 0),
        totalAhorros: Number(w.totalAhorros ?? 0), responsableNombre: null,
      })).filter((w: SemanaResumen) => w.semana > 0).sort((a: SemanaResumen, b: SemanaResumen) => a.semana - b.semana));
    }
  }

  async function openSemDet(sem: number) {
    setOpenSemana(sem); setLoadingSemDet(true); setErrorSemDet(null); setSemanaRows([]);
    try {
      const r = await fetch(weekUrl(sem));
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Error");
      setSemanaRows(Array.isArray(d?.rows) ? d.rows : []);
    } catch (e: any) { setErrorSemDet(e?.message); }
    finally { setLoadingSemDet(false); }
  }

  function closeSemDet() { setOpenSemana(null); setSemanaRows([]); setErrorSemDet(null); setSavingSemDet(false); }

  async function saveSemDet() {
    if (openSemana == null) return;
    try {
      setSavingSemDet(true);
      const res = await fetch(weekUrl(openSemana), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: semanaRows.map(r => ({ socioId: r.socioId, aporteSemana: Number(r.aporteSemana) || 0, ahorroSemana: Number(r.ahorroSemana) || 0 })) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Error");
      await refetchAll(); closeSemDet();
    } catch (e: any) { setErrorSemDet(e?.message); setSavingSemDet(false); }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? socios.filter(s => [s.nombres, s.apellidos, s.numeroCuenta].some(v => String(v).toLowerCase().includes(q))) : socios;
    return [...base].sort((a, b) => {
      if (["nombres", "apellidos", "numeroCuenta"].includes(sortKey))
        return String((a as any)[sortKey] ?? "").localeCompare(String((b as any)[sortKey] ?? ""), "es", { sensitivity: "base", numeric: true }) * (sortDir === "asc" ? 1 : -1);
      return (sortDir === "asc" ? 1 : -1) * (Number((a as any)[sortKey] ?? 0) - Number((b as any)[sortKey] ?? 0));
    });
  }, [socios, query, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const visible = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function exportCSV() {
    const headers = ["Socio", "Cuenta", "Aportes", "Ahorros", "Invertido", "% Part.", "Interés ganado", "Total a recibir"];
    const rows = filtered.map(s => [`${s.nombres} ${s.apellidos}`.trim(), s.numeroCuenta, s.aportes, s.ahorros, s.montoInvertido, `${s.proporcion}%`, s.interesGanado, s.totalARecibir]);
    const csv = [headers, ...rows].map(r => r.map(c => typeof c === "string" && c.includes(",") ? `"${c}"` : c).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `resultados_ronda_${resumen?.id ?? id}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (error) return <div className="p-6"><div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"><p className="font-semibold">Error al cargar</p><p className="text-sm">{error}</p></div></div>;
  if (loading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}</div>;
  if (!resumen) return <div className="p-6 text-gray-500">No se encontraron resultados.</div>;

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
                Resultados · <span className="text-blue-700">{resumen.nombre}</span>
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {fmtDate(resumen.fechaInicio)} → {fmtDate(resumen.fechaFin)}
                <span className="mx-2 text-gray-300">·</span>
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", rondaCerrada ? "bg-gray-100 text-gray-600" : "bg-emerald-100 text-emerald-700")}>
                  {rondaCerrada ? "Cerrada" : "Activa"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/rondas/historial" className="hidden rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 sm:inline-flex">← Historial</Link>
            <button onClick={exportCSV} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Exportar CSV</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Socios", value: fmtNum(resumen.totalSocios), color: "" },
          { label: "Total aportes", value: fmt(resumen.totalAportes), color: "" },
          { label: "Total ahorros", value: fmt(resumen.totalAhorros), color: "" },
          { label: "Fondo inversión", value: fmt(resumen.totalFondoInversion), color: "text-blue-700" },
          { label: "Total multas", value: fmt(resumen.totalMultas), color: "text-rose-600" },
          { label: "Interés generado", value: fmt(resumen.totalInteresGenerado), color: "text-emerald-600", note: `${resumen.totalPrestamos} préstamo${resumen.totalPrestamos !== 1 ? "s" : ""}` },
        ].map(k => (
          <div key={k.label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={cn("mt-1 text-lg font-semibold truncate", k.color || "text-gray-900")}>{k.value}</p>
            {k.note && <p className="text-xs text-gray-400 mt-0.5">{k.note}</p>}
          </div>
        ))}
      </section>

      {/* Préstamos */}
      {prestamos.length > 0 && (
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Préstamos de la ronda</p>
              <p className="text-xs text-gray-500 mt-0.5">Interés total: <strong className="text-emerald-700">{fmt(resumen.totalInteresGenerado)}</strong></p>
            </div>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{prestamos.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Socio</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-right">Tasa</th>
                  <th className="px-4 py-3 text-right">Plazo</th>
                  <th className="px-4 py-3 text-right">Interés</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Cuotas</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {prestamos.map(p => (
                  <tr key={p.id} className="border-t hover:bg-gray-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.socio.nombres} {p.socio.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.socio.numeroCuenta}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(p.monto)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.tasaAnual}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.plazoMeses}m</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">{fmt(p.totalInteres)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(p.totalAPagar)}</td>
                    <td className="px-4 py-3 text-center">
                      <p className="text-xs text-gray-600">{p.cuotasPagadas}/{p.totalCuotas}</p>
                      <div className="mx-auto mt-1 h-1.5 w-16 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${p.totalCuotas > 0 ? (p.cuotasPagadas / p.totalCuotas) * 100 : 0}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        p.estado === "CANCELADO" ? "bg-emerald-100 text-emerald-700" :
                        p.estado === "MORA" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700")}>
                        {p.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700" colSpan={4}>Total</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmt(resumen.totalInteresGenerado)}</td>
                  <td className="px-4 py-3 text-right font-bold">{fmt(prestamos.reduce((a, p) => a + p.totalAPagar, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Distribución de intereses — RONDA CERRADA */}
      {rondaCerrada && resumen.totalInteresGenerado > 0 && (
        <section className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
          <div className="border-b bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-800">💰 Distribución al cierre de la ronda</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Fondo invertido: <strong>{fmt(resumen.totalFondoInversion)}</strong>
              <span className="mx-2">·</span>
              Intereses a repartir: <strong>{fmt(resumen.totalInteresGenerado)}</strong>
              <span className="mx-2">·</span>
              Total a devolver: <strong>{fmt(resumen.totalFondoInversion + resumen.totalInteresGenerado)}</strong>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Socio</th>
                  <th className="px-4 py-3 text-right">Monto invertido</th>
                  <th className="px-4 py-3 text-right">% participación</th>
                  <th className="px-4 py-3 text-right">Interés ganado</th>
                  <th className="px-4 py-3 text-right">Total a recibir</th>
                </tr>
              </thead>
              <tbody>
                {[...socios].filter(s => s.montoInvertido > 0).sort((a, b) => b.proporcion - a.proporcion).map(s => (
                  <tr key={s.id} className="border-t hover:bg-gray-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-blue-700">{fmt(s.montoInvertido)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(s.proporcion, 100)}%` }} />
                        </div>
                        <span className="text-gray-700">{fmtPct(s.proporcion)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-700">{fmt(s.interesGanado)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">{fmt(s.totalARecibir)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">{fmt(resumen.totalFondoInversion)}</td>
                  <td className="px-4 py-3 text-right font-bold">100%</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-700">{fmt(resumen.totalInteresGenerado)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmt(resumen.totalFondoInversion + resumen.totalInteresGenerado)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Aviso ronda activa con préstamos */}
      {!rondaCerrada && prestamos.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⏳ La distribución de intereses estará disponible al cerrar la ronda. Interés proyectado: <strong>{fmt(resumen.totalInteresProyectado)}</strong>
        </div>
      )}

      {/* Historial por semana */}
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-800">Historial por semana</p>
          {loadingSemanas && <p className="text-xs text-gray-400">Cargando…</p>}
        </div>
        {errorSemanas ? <p className="p-4 text-sm text-gray-500">{errorSemanas}</p>
          : semanas.length === 0 ? <p className="p-4 text-sm text-gray-400">No hay datos de semanas.</p>
          : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Semana</th>
                    <th className="px-4 py-3 text-right">Aportes</th>
                    <th className="px-4 py-3 text-right">Ahorros</th>
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {semanas.map(w => (
                    <tr key={w.semana} className="border-t hover:bg-gray-50/70">
                      <td className="px-4 py-3 font-medium text-gray-900">#{w.semana}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(w.totalAportes)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(w.totalAhorros)}</td>
                      <td className="px-4 py-3 text-gray-600">{w.responsableNombre || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openSemDet(w.semana)} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50">Ver y editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      {/* Totales por socio */}
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-gray-800">Totales por socio</p>
          <input type="text" value={query} onChange={e => { setPage(1); setQuery(e.target.value); }}
            placeholder="Buscar…"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 sm:w-64" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {([
                  { key: "nombres", label: "Socio" },
                  { key: "aportes", label: "Aportes" },
                  { key: "ahorros", label: "Ahorros" },
                  { key: "montoInvertido", label: "Invertido" },
                  { key: "proporcion", label: "% Part." },
                  { key: "interesGanado", label: "Interés" },
                  { key: "totalARecibir", label: "Total a recibir" },
                ] as const).map(c => (
                  <th key={c.key}
                    className={cn("px-4 py-3 cursor-pointer select-none", c.key !== "nombres" && "text-right")}
                    onClick={() => { if (sortKey === c.key) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(c.key); setSortDir("desc"); } }}>
                    {c.label}{sortKey === c.key && <span className="ml-1 text-gray-400">{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Sin resultados.</td></tr>
              ) : visible.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                    <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(s.aportes)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(s.ahorros)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.montoInvertido > 0 ? <span className="font-medium text-blue-700">{fmt(s.montoInvertido)}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.montoInvertido > 0 ? <span className="font-medium text-blue-600">{fmtPct(s.proporcion)}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {rondaCerrada
                      ? <span className="font-semibold text-amber-700">{fmt(s.interesGanado)}</span>
                      : <span className="text-xs text-gray-400 italic">Al cierre</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {rondaCerrada && s.montoInvertido > 0
                      ? <span className="font-bold text-emerald-700">{fmt(s.totalARecibir)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <span>Mostrando <strong>{visible.length}</strong> de <strong>{filtered.length}</strong></span>
            <div className="flex gap-2">
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
          <div className="fixed inset-0 bg-black/30" onClick={closeSemDet} />
          <div className="relative z-50 w-full sm:max-w-4xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold">Semana #{openSemana}</h3>
                <p className="text-sm text-gray-500">Editar aporte y ahorro.</p>
              </div>
              <button onClick={closeSemDet} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {loadingSemDet ? <div className="p-4 text-sm text-gray-500">Cargando…</div>
              : errorSemDet ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorSemDet}</div>
              : (
                <div className="max-h-[60vh] overflow-y-auto rounded-xl border">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">#</th><th className="px-4 py-3">Socio</th><th className="px-4 py-3">Cuenta</th>
                        <th className="px-4 py-3 text-right">Aporte</th><th className="px-4 py-3 text-right">Ahorro</th><th className="px-4 py-3 text-right">Multa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semanaRows.length === 0
                        ? <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin datos.</td></tr>
                        : semanaRows.map((r, idx) => (
                          <tr key={r.socioId} className="border-t">
                            <td className="px-4 py-3 text-gray-500">{r.orden ?? idx + 1}</td>
                            <td className="px-4 py-3 font-medium">{r.nombres} {r.apellidos}</td>
                            <td className="px-4 py-3 text-gray-500">{r.numeroCuenta}</td>
                            <td className="px-4 py-3 text-right">
                              <input type="number" step="0.01" value={r.aporteSemana}
                                onChange={e => { const v = toNum(e.target.value); setSemanaRows(prev => prev.map(x => x.socioId === r.socioId ? { ...x, aporteSemana: v } : x)); }}
                                className="w-28 rounded-md border px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-blue-200" />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input type="number" step="0.01" value={r.ahorroSemana}
                                onChange={e => { const v = toNum(e.target.value); setSemanaRows(prev => prev.map(x => x.socioId === r.socioId ? { ...x, ahorroSemana: v } : x)); }}
                                className="w-28 rounded-md border px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-blue-200" />
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500">{fmt(r.multaSemana)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={closeSemDet} disabled={savingSemDet} className="px-4 py-2 rounded-md border text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={saveSemDet} disabled={savingSemDet || loadingSemDet}
                className={cn("px-4 py-2 rounded-md text-white", savingSemDet ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700")}>
                {savingSemDet ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
