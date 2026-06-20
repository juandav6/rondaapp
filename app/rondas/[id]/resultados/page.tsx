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
  id: number | string; nombres: string; apellidos: string; numeroCuenta: string;
  aportes: number; ahorros: number; multas: number; montoInvertido: number;
  proporcion: number; interesGanado: number | null; totalARecibir: number | null; orden?: number;
};
type PrestamoRonda = {
  id: number; estado: string; monto: number; tasaAnual: number;
  plazoMeses: number; saldoActual: number; totalInteres: number;
  totalAPagar: number; cuotasPagadas: number; totalCuotas: number;
  socio: { id: number; nombres: string; apellidos: string; numeroCuenta: string };
};
type SemanaResumen = {
  semana: number; totalAportes: number; totalAhorros: number; responsableNombre: string | null;
};
type SemanaDetalleRow = {
  socioId: number; orden: number; numeroCuenta: string; nombres: string; apellidos: string;
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
  const [inversores, setInversores] = useState<any[]>([]);
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
  const [modoEdicion, setModoEdicion] = useState(false);
  const [abriendoRonda, setAbriendoRonda] = useState(false);
  const [recalcModal, setRecalcModal] = useState<{
    inversoresAntes: { socio: any; montoAnterior: number; montoNuevo: number; pctAnterior: number; pctNuevo: number }[];
    fondoAntes: number; fondoNuevo: number;
  } | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [cerrandoRonda, setCerrandoRonda] = useState(false);
  const [semanaRows, setSemanaRows] = useState<SemanaDetalleRow[]>([]);
  const [semanaRowsParciales, setSemanaRowsParciales] = useState<any[]>([]);
  const [semanaResponsableId, setSemanaResponsableId] = useState<number | null>(null);
  const [semanaSocios, setSemanaSocios] = useState<any[]>([]);
  const [loadingSemDet, setLoadingSemDet] = useState(false);
  const [errorSemDet, setErrorSemDet] = useState<string | null>(null);
  const [savingSemDet, setSavingSemDet] = useState(false);

  const weekUrl = (sem: number) => `/api/rondas/${id}/semana/${sem}/detalle`;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/rondas/${id}/resultados`)
      .then(r => { if (!r.ok) throw new Error("No se pudo obtener los resultados"); return r.json(); })
      .then((d: any) => { setResumen(d?.resumen ?? null); setSocios(d?.socios ?? []); setPrestamos(d?.prestamos ?? []); setInversores(d?.inversores ?? []); })
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
          semana: Number(w.semana ?? 0), totalAportes: Number(w.totalAportes ?? 0),
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
    setSemanaResponsableId(null); setSemanaSocios([]);
    try {
      const r = await fetch(weekUrl(sem));
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Error");
      setSemanaRows(Array.isArray(d?.rows) ? d.rows : []);
      setSemanaRowsParciales(Array.isArray(d?.rowsParciales) ? d.rowsParciales : []);
      setSemanaResponsableId(d?.responsableId ?? null);
      setSemanaSocios(d?.socios ?? []);
    } catch (e: any) { setErrorSemDet(e?.message); }
    finally { setLoadingSemDet(false); }
  }

  function closeSemDet() { setOpenSemana(null); setSemanaRows([]); setSemanaRowsParciales([]); setErrorSemDet(null); setSavingSemDet(false); setSemanaResponsableId(null); setSemanaSocios([]); }

  async function abrirRonda() {
    if (!resumen) return;
    if (!confirm(`¿Reabrir ${resumen.nombre} para edición?\n\nSe reactivará la ronda y podrás editar semanas y recalcular el fondo.`)) return;
    setAbriendoRonda(true);
    try {
      const res = await fetch(`/api/admin/rondas/${resumen.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa: true, fechaFin: null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setModoEdicion(true);
      await refetchAll();
    } catch (e: any) { alert(e.message); }
    finally { setAbriendoRonda(false); }
  }

  async function verRecalculo() {
    if (!resumen || inversores.length === 0) {
      alert("No hay datos del fondo de inversión cargados.");
      return;
    }
    // Calcular nuevos porcentajes basados en los montos actuales
    const fondoTotal = inversores.reduce((s: number, i: any) => s + Number(i.montoInvertido), 0);
    setRecalcModal({
      fondoAntes: fondoTotal,
      fondoNuevo: fondoTotal,
      inversoresAntes: inversores.map((i: any) => ({
        socio: i.socio,
        montoAnterior: Number(i.montoInvertido),
        montoNuevo: Number(i.montoInvertido),
        pctAnterior: Number(i.porcentaje),
        pctNuevo: fondoTotal > 0 ? Math.round((Number(i.montoInvertido) / fondoTotal) * 10000) / 100 : 0,
      })),
    });
  }

  async function recalcularYCerrar() {
    if (!resumen) return;
    setCerrandoRonda(true);
    try {
      // 1. Recalcular porcentajes de participación en el fondo
      const resRecalc = await fetch(`/api/rondas/${resumen.id}/fondo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recalcularPorcentajes: true }),
      });
      if (!resRecalc.ok) {
        const e = await resRecalc.json().catch(() => ({}));
        throw new Error(e.error || "Error recalculando porcentajes");
      }

      // 2. Cerrar ronda (forzar aunque haya préstamos activos)
      const resCierre = await fetch(`/api/rondas/${resumen.id}/cerrar-semana`, {
        method: "POST",
        headers: { "x-forzar-cierre": "1" },
      });
      if (!resCierre.ok) {
        const e = await resCierre.json().catch(() => ({}));
        throw new Error(e.error || "Error cerrando ronda");
      }

      setRecalcModal(null);
      setModoEdicion(false);
      await refetchAll();
    } catch (e: any) { alert(e.message); }
    finally { setCerrandoRonda(false); }
  }

  async function saveSemDet() {
    if (openSemana == null) return;
    try {
      setSavingSemDet(true);
      const res = await fetch(weekUrl(openSemana), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: semanaRows.map(r => ({ socioId: r.socioId, aporteSemana: Number(r.aporteSemana) || 0, ahorroSemana: Number(r.ahorroSemana) || 0, multaSemana: Number(r.multaSemana) || 0 })),
          updatesParciales: semanaRowsParciales.map(r => ({ socioId: r.socioId, ahorroSemana: Number(r.ahorroSemana) || 0 })),
          responsableId: semanaResponsableId,
        }),
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

  if (error) return (
    <div className="p-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-semibold">Error al cargar</p><p className="text-sm">{error}</p>
      </div>
    </div>
  );
  if (loading) return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}
    </div>
  );
  if (!resumen) return <div className="p-4 text-gray-500">No se encontraron resultados.</div>;

  const rondaCerrada = !resumen.activa;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">

      {/* ── Header ── */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z" />
              </svg>
            </span>
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl font-semibold tracking-tight truncate">
                Resultados · <span className="text-blue-700">{resumen.nombre}</span>
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                <span>{fmtDate(resumen.fechaInicio)} → {fmtDate(resumen.fechaFin)}</span>
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                  rondaCerrada ? "bg-gray-100 text-gray-600" : "bg-emerald-100 text-emerald-700")}>
                  {rondaCerrada ? "Cerrada" : "Activa"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
            <Link href="/rondas/historial" className="hidden sm:inline-flex rounded-lg border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">← Historial</Link>
            {rondaCerrada && !modoEdicion && (
              <button onClick={abrirRonda} disabled={abriendoRonda}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                {abriendoRonda ? "Abriendo…" : "✏️ Abrir para editar"}
              </button>
            )}
            {modoEdicion && (
              <>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 uppercase tracking-wide">Modo edición</span>
                <button onClick={verRecalculo} disabled={recalculando}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {recalculando ? "Calculando…" : "🔄 Recalcular fondo"}
                </button>
              </>
            )}
          </div>
            <button onClick={exportCSV} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">CSV</button>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Socios", value: fmtNum(resumen.totalSocios), color: "" },
          { label: "Aportes", value: fmt(resumen.totalAportes), color: "" },
          { label: "Ahorros", value: fmt(resumen.totalAhorros), color: "" },
          { label: "Fondo inv.", value: fmt(resumen.totalFondoInversion), color: "text-blue-700" },
          { label: "Multas", value: fmt(resumen.totalMultas), color: "text-rose-600" },
          { label: "Interés", value: fmt(resumen.totalInteresGenerado), color: "text-emerald-600", note: `${resumen.totalPrestamos} préstamo${resumen.totalPrestamos !== 1 ? "s" : ""}` },
        ].map(k => (
          <div key={k.label} className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={cn("mt-0.5 text-sm sm:text-lg font-semibold truncate tabular-nums", k.color || "text-gray-900")}>{k.value}</p>
            {k.note && <p className="text-xs text-gray-400 mt-0.5">{k.note}</p>}
          </div>
        ))}
      </section>

      {/* ── Préstamos ── */}
      {prestamos.length > 0 && (
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Préstamos de la ronda</p>
              <p className="text-xs text-gray-500 mt-0.5">Interés total: <strong className="text-emerald-700">{fmt(resumen.totalInteresGenerado)}</strong></p>
            </div>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{prestamos.length}</span>
          </div>

          {/* Tabla desktop */}
          <div className="hidden sm:block overflow-x-auto">
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
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">
                    {fmt(prestamos.reduce((a, p) => a + p.monto, 0))}
                  </td>
                  <td colSpan={2} />
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-700">
                    {fmt(resumen.totalInteresGenerado)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    {fmt(prestamos.reduce((a, p) => a + p.totalAPagar, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Tarjetas móvil */}
          <ul className="sm:hidden divide-y">
            {prestamos.map(p => (
              <li key={p.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{p.socio.nombres} {p.socio.apellidos}</p>
                    <p className="text-xs text-gray-400 font-mono">{p.socio.numeroCuenta}</p>
                  </div>
                  <span className={cn("shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    p.estado === "CANCELADO" ? "bg-emerald-100 text-emerald-700" :
                    p.estado === "MORA" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700")}>
                    {p.estado}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <div className="rounded bg-gray-50 p-2">
                    <p className="text-gray-400">Monto</p>
                    <p className="font-semibold text-gray-700 tabular-nums mt-0.5">{fmt(p.monto)}</p>
                  </div>
                  <div className="rounded bg-emerald-50 p-2">
                    <p className="text-emerald-500">Interés</p>
                    <p className="font-semibold text-emerald-700 tabular-nums mt-0.5">{fmt(p.totalInteres)}</p>
                  </div>
                  <div className="rounded bg-blue-50 p-2">
                    <p className="text-blue-400">Cuotas</p>
                    <p className="font-semibold text-blue-700 mt-0.5">{p.cuotasPagadas}/{p.totalCuotas}</p>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${p.totalCuotas > 0 ? (p.cuotasPagadas / p.totalCuotas) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Distribución al cierre ── */}
      {(rondaCerrada || inversores.length > 0) && inversores.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
          <div className="border-b bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-800">💰 {rondaCerrada ? "Distribución al cierre" : "Fondo de inversión"}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-emerald-600">
              <span>Fondo: <strong>{fmt(resumen.totalFondoInversion)}</strong></span>
              {resumen.totalInteresGenerado > 0 && <>
                <span>Intereses: <strong>{fmt(resumen.totalInteresGenerado)}</strong></span>
                <span>Total: <strong>{fmt(resumen.totalFondoInversion + resumen.totalInteresGenerado)}</strong></span>
              </>}
              <span>{inversores.length} inversor{inversores.length !== 1 ? "es" : ""}</span>
            </div>
          </div>

          {/* Tabla desktop */}
          <div className="hidden sm:block overflow-x-auto">
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
                {(inversores.length > 0 ? inversores : [...socios].filter(s => s.montoInvertido > 0).map(s => ({
                  socio: { nombres: s.nombres, apellidos: s.apellidos, numeroCuenta: s.numeroCuenta },
                  montoInvertido: s.montoInvertido,
                  porcentaje: s.proporcion,
                  interesesAcumulados: s.interesGanado,
                  totalARecibir: s.totalARecibir,
                }))).sort((a, b) => b.montoInvertido - a.montoInvertido).map((inv, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{inv.socio.nombres} {inv.socio.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{inv.socio.numeroCuenta}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-blue-700">{fmt(inv.montoInvertido)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(inv.porcentaje, 100)}%` }} />
                        </div>
                        <span>{fmtPct(inv.porcentaje)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-700">{fmt(inv.interesesAcumulados)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">{fmt(inv.totalARecibir)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">{fmt(resumen.totalFondoInversion)}</td>
                  <td className="px-4 py-3 text-right font-bold">100%</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-700">{fmt(resumen.totalInteresGenerado)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmt(resumen.totalFondoInversion + resumen.totalInteresGenerado)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Tarjetas móvil distribución */}
          <ul className="sm:hidden divide-y">
            {(inversores.length > 0 ? inversores : [...socios].filter(s => s.montoInvertido > 0).map(s => ({
              socio: { nombres: s.nombres, apellidos: s.apellidos, numeroCuenta: s.numeroCuenta },
              montoInvertido: s.montoInvertido,
              porcentaje: s.proporcion,
              interesesAcumulados: s.interesGanado,
              totalARecibir: s.totalARecibir,
            }))).sort((a, b) => b.montoInvertido - a.montoInvertido).map((inv, i) => (
              <li key={i} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{inv.socio.nombres} {inv.socio.apellidos}</p>
                    <p className="text-xs text-gray-400 font-mono">{inv.socio.numeroCuenta}</p>
                  </div>
                  <p className="font-semibold text-blue-700 tabular-nums mt-0.5">{fmt(inv.montoInvertido)}</p>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Participación</span>
                  <span className="font-medium">{fmtPct(inv.porcentaje)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Interés ganado</span>
                  <span className="font-medium text-amber-700">{fmt(inv.interesesAcumulados)}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-gray-600">Total a recibir</span>
                  <span className="text-emerald-700">{fmt(inv.totalARecibir)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Aviso ronda activa */}
      {!rondaCerrada && prestamos.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⏳ La distribución de intereses estará disponible al cerrar la ronda. Interés proyectado: <strong>{fmt(resumen.totalInteresProyectado)}</strong>
        </div>
      )}

      {/* ── Historial por semana ── */}
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
          <p className="text-sm font-medium text-gray-800">Historial por semana</p>
          {loadingSemanas && <p className="text-xs text-gray-400">Cargando…</p>}
        </div>

        {errorSemanas ? <p className="p-4 text-sm text-gray-500">{errorSemanas}</p>
          : semanas.length === 0 ? <p className="p-4 text-sm text-gray-400">No hay datos de semanas.</p>
          : (
            <>
              {/* Tabla desktop */}
              <div className="hidden sm:block overflow-x-auto">
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
                          {(!rondaCerrada || modoEdicion) && (
                            <button onClick={() => openSemDet(w.semana)} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
                              {modoEdicion ? "✏️ Editar" : "Ver y editar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tarjetas móvil semanas */}
              <ul className="sm:hidden divide-y">
                {semanas.map(w => (
                  <li key={w.semana} className="flex items-center justify-between gap-3 p-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Semana #{w.semana}</p>
                      <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                        <span>Aportes: <strong>{fmt(w.totalAportes)}</strong></span>
                        <span>Ahorros: <strong>{fmt(w.totalAhorros)}</strong></span>
                      </div>
                      {w.responsableNombre && <p className="text-xs text-gray-400 mt-0.5">{w.responsableNombre}</p>}
                    </div>
                    {(!rondaCerrada || modoEdicion) && (
                      <button onClick={() => openSemDet(w.semana)}
                        className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
                        {modoEdicion ? "✏️ Editar" : "Ver"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
      </section>

      {/* ── Totales por socio ── */}
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-gray-800">Totales por socio</p>
          <input type="text" value={query} onChange={e => { setPage(1); setQuery(e.target.value); }}
            placeholder="Buscar…"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-56" />
        </div>

        {/* Tabla desktop */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {([
                  { key: "nombres",    label: "Socio" },
                  { key: "aportes",    label: "Aportes" },
                  { key: "ahorros",    label: "Ahorros" },
                  { key: "multas",     label: "Multas" },
                  { key: "montoInvertido", label: "Invertido" },
                  { key: "proporcion", label: "% Part." },
                ] as const).map(c => (
                  <th key={c.key}
                    className={cn("px-4 py-3 cursor-pointer select-none", c.key !== "nombres" && "text-right")}
                    onClick={() => { if (sortKey === c.key) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(c.key as any); setSortDir("desc"); } }}>
                    {c.label}{sortKey === c.key && <span className="ml-1 text-gray-400">{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">Sin resultados.</td></tr>
              ) : visible.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                    <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(s.aportes)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(s.ahorros)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600">{Number(s.multas) > 0 ? fmt(s.multas) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.montoInvertido > 0 ? <span className="font-medium text-blue-700">{fmt(s.montoInvertido)}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.montoInvertido > 0 ? <span className="font-medium text-blue-600">{fmtPct(s.proporcion)}</span> : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tarjetas móvil socios */}
        <ul className="sm:hidden divide-y">
          {visible.length === 0 ? (
            <li className="p-8 text-center text-sm text-gray-400">Sin resultados.</li>
          ) : visible.map(s => (
            <li key={s.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">{s.nombres} {s.apellidos}</p>
                  <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                </div>
                {s.montoInvertido > 0 && (
                  <span className="text-xs font-semibold text-blue-700 shrink-0">{fmtPct(s.proporcion)}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="rounded bg-gray-50 p-2">
                  <p className="text-gray-400">Aportes</p>
                  <p className="font-semibold text-gray-700 tabular-nums mt-0.5">{fmt(s.aportes)}</p>
                </div>
                <div className="rounded bg-gray-50 p-2">
                  <p className="text-gray-400">Ahorros</p>
                  <p className="font-semibold text-gray-700 tabular-nums mt-0.5">{fmt(s.ahorros)}</p>
                </div>
                {s.montoInvertido > 0 && (
                  <>
                    <div className="rounded bg-blue-50 p-2">
                      <p className="text-blue-400">Invertido</p>
                      <p className="font-semibold text-blue-700 tabular-nums mt-0.5">{fmt(s.montoInvertido)}</p>
                    </div>
                    <div className="rounded bg-blue-50 p-2">
                      <p className="text-blue-400">% Part.</p>
                      <p className="font-semibold text-blue-600 tabular-nums mt-0.5">{fmtPct(s.proporcion)}</p>
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <span className="text-xs">Mostrando <strong>{visible.length}</strong> de <strong>{filtered.length}</strong></span>
            <div className="flex gap-2">
              <button className="rounded-md border px-2.5 py-1 text-xs disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe === 1}>Anterior</button>
              <span className="text-xs tabular-nums">{pageSafe}/{totalPages}</span>
              <button className="rounded-md border px-2.5 py-1 text-xs disabled:opacity-50" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}>Siguiente</button>
            </div>
          </div>
        )}
      </section>

      {/* ── Modal semana ── */}
      {openSemana != null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={closeSemDet} />
          <div className="relative z-50 w-full sm:max-w-4xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">

            {/* Header fijo */}
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold">Semana #{openSemana}</h3>
                <p className="text-xs text-gray-500">Editar aporte y ahorro por socio.</p>
              </div>
              <button onClick={closeSemDet} className="text-gray-400 hover:text-gray-600 text-lg shrink-0">✕</button>
            </div>

            {/* Contenido scrolleable */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">

            {/* Selector responsable */}
            {semanaSocios.length > 0 && (
              <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-blue-500 shrink-0">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd"/>
                </svg>
                <label className="text-xs font-medium text-blue-700 shrink-0">Responsable:</label>
                <select
                  value={semanaResponsableId ?? ""}
                  onChange={e => setSemanaResponsableId(e.target.value ? Number(e.target.value) : null)}
                  className="flex-1 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">— Sin asignar —</option>
                  {semanaSocios
                    .sort((a, b) => a.orden - b.orden)
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.orden}. {s.nombres} {s.apellidos} ({s.numeroCuenta})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {loadingSemDet ? <div className="p-4 text-sm text-gray-500">Cargando…</div>
              : errorSemDet ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorSemDet}</div>
              : (
                <>
                  {/* Tabla desktop modal */}
                  <div className="hidden sm:block max-h-[60vh] overflow-y-auto rounded-xl border">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
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
                              <td className="px-4 py-3 text-right">
                                <input type="number" step="0.01" min="0" value={r.multaSemana}
                                  onChange={e => { const v = toNum(e.target.value); setSemanaRows(prev => prev.map(x => x.socioId === r.socioId ? { ...x, multaSemana: v } : x)); }}
                                  className="w-28 rounded-md border border-red-200 px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-red-200" />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Lista editable móvil */}
                  <div className="sm:hidden max-h-[55vh] overflow-y-auto space-y-2">
                    {semanaRows.length === 0 ? (
                      <p className="p-4 text-center text-sm text-gray-400">Sin datos.</p>
                    ) : semanaRows.map((r, idx) => (
                      <div key={r.socioId} className="rounded-xl border p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{r.orden ?? idx + 1}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.nombres} {r.apellidos}</p>
                            <p className="text-xs text-gray-400 font-mono">{r.numeroCuenta}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Aporte</label>
                            <input type="number" step="0.01" value={r.aporteSemana}
                              onChange={e => { const v = toNum(e.target.value); setSemanaRows(prev => prev.map(x => x.socioId === r.socioId ? { ...x, aporteSemana: v } : x)); }}
                              className="w-full rounded-md border px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Ahorro</label>
                            <input type="number" step="0.01" value={r.ahorroSemana}
                              onChange={e => { const v = toNum(e.target.value); setSemanaRows(prev => prev.map(x => x.socioId === r.socioId ? { ...x, ahorroSemana: v } : x)); }}
                              className="w-full rounded-md border px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          </div>
                          <div>
                            <label className="text-xs text-red-500 mb-1 block">Multa</label>
                            <input type="number" step="0.01" min="0" value={r.multaSemana}
                              onChange={e => { const v = toNum(e.target.value); setSemanaRows(prev => prev.map(x => x.socioId === r.socioId ? { ...x, multaSemana: v } : x)); }}
                              className="w-full rounded-md border border-red-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-200" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── Socios de ahorro parcial ── */}
              {semanaRowsParciales.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold">{semanaRowsParciales.length}</span>
                    <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Socios de ahorro parcial</p>
                  </div>
                  <div className="rounded-xl border border-violet-200 overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead className="bg-violet-50 text-xs text-violet-600 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Socio</th>
                          <th className="px-3 py-2 text-right">Ahorro sem. {openSemana}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {semanaRowsParciales.map((r, idx) => (
                          <tr key={r.socioId} className={cn("border-t", idx % 2 === 0 ? "bg-white" : "bg-violet-50/30")}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-800 text-xs">{r.nombres} {r.apellidos}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{r.numeroCuenta}</p>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number" min="0" step="0.01"
                                value={r.ahorroSemana || ""}
                                placeholder="0.00"
                                onChange={e => setSemanaRowsParciales(prev =>
                                  prev.map((x, i) => i === idx ? { ...x, ahorroSemana: Number(e.target.value) || 0 } : x)
                                )}
                                className="w-24 rounded-lg border border-violet-200 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>{/* fin contenido scrolleable */}

            {/* Footer fijo */}
            <div className="border-t px-4 sm:px-6 py-3 flex justify-end gap-3 shrink-0 bg-gray-50 rounded-b-2xl">
              {errorSemDet && <p className="flex-1 text-xs text-red-600 self-center">{errorSemDet}</p>}
              <button onClick={closeSemDet} disabled={savingSemDet} className="px-4 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50 bg-white">Cancelar</button>
              <button onClick={saveSemDet} disabled={savingSemDet || loadingSemDet}
                className={cn("px-4 py-2 rounded-md text-sm text-white", savingSemDet ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700")}>
                {savingSemDet ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal recalcular fondo ── */}
      {recalcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b bg-amber-50">
              <h3 className="text-base font-bold text-amber-900">🔄 Recalcular fondo de inversión</h3>
              <p className="text-xs text-amber-700 mt-0.5">Revisa los cambios antes de recalcular y cerrar la ronda</p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Resumen fondo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 border p-3">
                  <p className="text-[10px] text-gray-500 uppercase font-semibold">Fondo original</p>
                  <p className="text-lg font-bold text-gray-800 tabular-nums">{fmt(recalcModal.fondoAntes)}</p>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
                  <p className="text-[10px] text-blue-600 uppercase font-semibold">Fondo actual</p>
                  <p className="text-lg font-bold text-blue-700 tabular-nums">{fmt(recalcModal.fondoNuevo)}</p>
                </div>
              </div>

              {/* Tabla inversores */}
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <p className="text-xs font-semibold text-gray-700">Inversores y porcentajes</p>
                </div>
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500">Socio</th>
                      <th className="px-3 py-2 text-right text-gray-500">Invertido</th>
                      <th className="px-3 py-2 text-right text-gray-500">% Antes</th>
                      <th className="px-3 py-2 text-right text-gray-500">% Nuevo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recalcModal.inversoresAntes.map((inv, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2 font-medium text-gray-800">{inv.socio.nombres} {inv.socio.apellidos}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(inv.montoAnterior)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">{inv.pctAnterior.toFixed(2)}%</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums font-semibold",
                          inv.pctNuevo !== inv.pctAnterior ? "text-blue-700" : "text-gray-600")}>
                          {inv.pctNuevo.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                ⚠️ Al confirmar se recalcularán los intereses y se cerrará la ronda definitivamente. Esta acción no se puede deshacer.
              </div>
            </div>

            <div className="border-t px-5 py-4 flex gap-3 bg-gray-50">
              <button onClick={() => setRecalcModal(null)} disabled={cerrandoRonda}
                className="flex-1 rounded-xl border bg-white py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={recalcularYCerrar} disabled={cerrandoRonda}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {cerrandoRonda ? "Procesando…" : "Recalcular y cerrar ronda →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
