// app/portal/[socioId]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Receptor = { nombres: string; apellidos: string; numeroCuenta: string; esMiTurno: boolean };
type Ronda = {
  id: number; nombre: string; semanaActual: number; totalParticipantes: number;
  semanaToca: number | null; semanasRestantes: number | null;
  estaEnRonda: boolean; fechaInicio: string; montoAporteSemanal: number;
  receptorEstaSemana: Receptor | null;
  totalAportado: number; totalEsperado: number; diferencia: number;
  semanasPagadas: number; semanasEsperadas: number;
  totalAhorradoRonda: number; ahorroObjetivo: number; pendienteAhorro: number;
  inversion: { montoInvertido: number; porcentajeParticipacion: number; interesesAcumulados: number; devuelto: boolean; fondoTotal: number } | null;
  prestamos: { totalSaldo: number; cantidadActivos: number; proximaCuota: { numero: number; monto: number; fechaVenc: string; rondaNombre: string } | null };
};
type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string; saldoAhorros: number };
type Resumen = { socio: Socio; ronda: Ronda | null };
type Prestamo = {
  id: number; monto: number; tasaAnual: number; estado: string; saldoActual: number;
  ronda: { nombre: string };
  cuotas: { id: number; numero: number; fechaVenc: string; cuota: number; pagada: boolean; fechaPago: string | null }[];
};
type Movimiento = { id: number; tipo: string; monto: number; nota: string | null; createdAt: string; ronda?: { nombre: string } | null };

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};
const fmtShort = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
};
const fmtDT = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
};

const tipoColor: Record<string, string> = { INVERSION: "text-blue-700", RETIRO: "text-rose-700", DEVOLUCION: "text-emerald-700", INTERES: "text-amber-700", AHORRO: "text-emerald-700" };
const tipoSigno: Record<string, string> = { INVERSION: "−", RETIRO: "−", DEVOLUCION: "+", INTERES: "+", AHORRO: "+" };
const tipoLabel: Record<string, string> = { INVERSION: "Inversión", RETIRO: "Retiro", DEVOLUCION: "Devolución", INTERES: "Interés", AHORRO: "Ahorro" };
const tipoBg: Record<string, string> = { INVERSION: "bg-blue-100 text-blue-700", RETIRO: "bg-rose-100 text-rose-700", DEVOLUCION: "bg-emerald-100 text-emerald-700", INTERES: "bg-amber-100 text-amber-700", AHORRO: "bg-emerald-100 text-emerald-700" };

type Tab = "resumen" | "ronda" | "prestamos" | "express" | "movimientos";

export default function PortalSocioPage() {
  const params = useParams();
  const socioId = params.socioId as string;
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [express, setExpress] = useState<any[]>([]);
  const [multas, setMultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("resumen");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [r1, r2, r3] = await Promise.allSettled([
        fetch(`/api/portal/${socioId}/resumen`).then(r => r.ok ? r.json() : null),
        fetch(`/api/portal/${socioId}/prestamos`).then(r => r.ok ? r.json() : null),
        fetch(`/api/portal/${socioId}/movimientos`).then(r => r.ok ? r.json() : null),
      ]);
      if (r1.status === "fulfilled" && r1.value) setResumen(r1.value);
      if (r2.status === "fulfilled" && r2.value) setPrestamos(r2.value.prestamos ?? []);
      if (r3.status === "fulfilled" && r3.value) setMovimientos(r3.value.movimientos ?? []);

      // Cargar express y multas de todas las rondas
      try {
        const rondasRes = await fetch("/api/rondas/historial");
        const rondas: any[] = rondasRes.ok ? await rondasRes.json() : [];
        const allExpress: any[] = [];
        const allMultas: any[] = [];
        await Promise.all(rondas.map(async (r: any) => {
          try {
            const [expRes, cajaRes] = await Promise.all([
              fetch(`/api/prestamos/express?rondaId=${r.id}`),
              fetch(`/api/rondas/${r.id}/caja`),
            ]);
            if (expRes.ok) {
              const expData = await expRes.json();
              const socioExpress = (expData.prestamos ?? []).filter((e: any) => e.socioId === Number(socioId));
              allExpress.push(...socioExpress.map((e: any) => ({ ...e, rondaNombre: r.nombre })));
            }
            if (cajaRes.ok) {
              const cajaData = await cajaRes.json();
              const socioMultas = (cajaData.movimientos ?? []).filter((m: any) => m.tipo === "MULTA" && m.socio?.id === Number(socioId));
              allMultas.push(...socioMultas.map((m: any) => ({ ...m, rondaNombre: r.nombre })));
            }
          } catch {}
        }));
        setExpress(allExpress.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setMultas(allMultas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()));
      } catch {}

      setLoading(false);
    }
    load();
  }, [socioId]);

  if (loading) return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />
      ))}
    </div>
  );

  const { socio, ronda } = resumen ?? {};
  const prestamosActivos = prestamos.filter(p => p.estado === "ACTIVO");
  const cuotasPendientes = prestamosActivos
    .flatMap(p => p.cuotas.filter(c => !c.pagada))
    .sort((a, b) => new Date(a.fechaVenc).getTime() - new Date(b.fechaVenc).getTime());
  const totalIntereses = movimientos.filter(m => m.tipo === "INTERES").reduce((a, m) => a + m.monto, 0);
  const esSemanaDecobro = ronda?.estaEnRonda && ronda?.semanasRestantes === 0;

  const expressActivos = express.filter((e: any) => e.estado === "PENDIENTE");
  const multasPendientes = multas.filter((m: any) => m.estado === "PENDIENTE");

  const tabs: { key: Tab; label: string; emoji: string; badge?: number }[] = [
    { key: "resumen", label: "Resumen", emoji: "📊" },
    { key: "ronda", label: "Mi Ronda", emoji: "🔄" },
    { key: "prestamos", label: "Préstamos", emoji: "💳", badge: prestamosActivos.length },
    { key: "express", label: "Express", emoji: "⚡", badge: expressActivos.length || (multasPendientes.length > 0 ? multasPendientes.length : undefined) },
    { key: "movimientos", label: "Historial", emoji: "📋" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-8">

      {/* ── Hero header ── */}
      <div className="bg-gradient-to-br from-[#1a3a2a] via-[#22543d] to-[#276749] px-4 pt-6 pb-16">
        {/* Banner cobro */}
        {esSemanaDecobro && (
          <div className="mb-4 rounded-2xl bg-white/15 border border-white/20 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">{ronda?.nombre} · Semana #{ronda?.semanaToca}</p>
                <p className="text-base font-bold text-white">¡Esta semana te toca cobrar!</p>
                <p className="text-xs text-emerald-200 mt-0.5">Recibirás los aportes de todos los socios.</p>
              </div>
            </div>
          </div>
        )}

        {/* Info socio */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white text-lg font-bold">
            {socio?.nombres?.[0]}{socio?.apellidos?.[0]}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-white truncate">{socio?.nombres} {socio?.apellidos}</p>
            <p className="text-xs text-emerald-200 font-mono">{socio?.numeroCuenta}</p>
          </div>
          {ronda && (
            <span className="ml-auto shrink-0 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-medium text-white">
              {ronda.nombre}
            </span>
          )}
        </div>

        {/* Info ronda en hero */}
        {ronda?.estaEnRonda && (
          <div className="mt-4 rounded-xl bg-white/10 border border-white/15 p-3 text-sm text-white space-y-0.5">
            <p className="text-emerald-200 text-xs">Ronda activa · Semana {ronda.semanaActual} de {ronda.totalParticipantes}</p>
            {ronda.receptorEstaSemana && (
              <p>Recibe esta semana: <strong className={ronda.receptorEstaSemana.esMiTurno ? "text-yellow-300" : "text-white"}>
                {ronda.receptorEstaSemana.esMiTurno ? "¡Tú! 🎉" : `${ronda.receptorEstaSemana.nombres} ${ronda.receptorEstaSemana.apellidos}`}
              </strong></p>
            )}
            {ronda.semanaToca != null && !esSemanaDecobro && (
              <p className="text-emerald-200">
                {ronda.semanasRestantes !== null && ronda.semanasRestantes < 0
                  ? `✓ Ya recibiste en la semana #${ronda.semanaToca}`
                  : `Tu turno: semana #${ronda.semanaToca} — ${(() => {
                      const d = new Date(ronda.fechaInicio);
                      d.setDate(d.getDate() + (ronda.semanaToca! - 1) * 7);
                      return fmtShort(d.toISOString());
                    })()} (faltan ${ronda.semanasRestantes} sem.)`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Grid 2×2 flotante sobre el hero ── */}
      <div className="px-4 -mt-10 relative z-10">
        <div className="grid grid-cols-2 gap-3">

          {/* Saldo ahorros */}
          <div className="rounded-2xl bg-white shadow-lg overflow-hidden border border-gray-100">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-base">💵</span>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ahorros</p>
              </div>
              <p className="text-xl font-bold text-emerald-700 tabular-nums leading-tight">{fmt(socio?.saldoAhorros)}</p>
              <p className="text-[10px] text-gray-400 mt-1">Disponible</p>
            </div>
            <div className="bg-emerald-50 px-4 py-1.5 border-t border-emerald-100">
              <p className="text-[10px] text-emerald-600">Corte: {fmtShort(new Date().toISOString())}</p>
            </div>
          </div>

          {/* Fondo en inversión */}
          <div className="rounded-2xl bg-white shadow-lg overflow-hidden border border-gray-100">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-base">📈</span>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Inversión</p>
              </div>
              {ronda?.inversion ? (
                <>
                  <p className="text-xl font-bold text-blue-700 tabular-nums leading-tight">{fmt(ronda.inversion.montoInvertido)}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{Number(ronda.inversion.porcentajeParticipacion).toFixed(1)}% del fondo</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-gray-300 leading-tight">—</p>
                  <p className="text-[10px] text-gray-400 mt-1">Sin inversión</p>
                </>
              )}
            </div>
            <div className="bg-blue-50 px-4 py-1.5 border-t border-blue-100">
              <p className="text-[10px] text-blue-600">{ronda?.nombre ?? "—"}</p>
            </div>
          </div>

          {/* Ahorros en ronda */}
          <div className="rounded-2xl bg-white shadow-lg overflow-hidden border border-gray-100">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-base">🏦</span>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ahorros ronda</p>
              </div>
              {ronda ? (
                <>
                  <p className="text-xl font-bold text-violet-700 tabular-nums leading-tight">{fmt(ronda.totalAhorradoRonda)}</p>
                  {ronda.ahorroObjetivo > 0 ? (
                    <>
                      <div className="mt-2 h-1 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500 transition-all"
                          style={{ width: `${Math.min((ronda.totalAhorradoRonda / ronda.ahorroObjetivo) * 100, 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Meta: {fmt(ronda.ahorroObjetivo)}</p>
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-400 mt-1">Acumulado</p>
                  )}
                </>
              ) : (
                <p className="text-xl font-bold text-gray-300 leading-tight">—</p>
              )}
            </div>
            <div className="bg-violet-50 px-4 py-1.5 border-t border-violet-100">
              <p className="text-[10px] text-violet-600">
                {ronda && ronda.pendienteAhorro > 0 ? `Pendiente: ${fmt(ronda.pendienteAhorro)}` : ronda ? "✓ Al día" : "—"}
              </p>
            </div>
          </div>

          {/* Pendiente préstamos */}
          <div className="rounded-2xl bg-white shadow-lg overflow-hidden border border-gray-100">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-base">💳</span>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Préstamos</p>
              </div>
              {ronda?.prestamos.cantidadActivos ? (
                <>
                  <p className="text-xl font-bold text-rose-700 tabular-nums leading-tight">{fmt(ronda.prestamos.totalSaldo)}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{ronda.prestamos.cantidadActivos} activo{ronda.prestamos.cantidadActivos !== 1 ? "s" : ""}</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-emerald-600 leading-tight">$0,00</p>
                  <p className="text-[10px] text-gray-400 mt-1">Sin deudas</p>
                </>
              )}
            </div>
            <div className="bg-orange-50 px-4 py-1.5 border-t border-orange-100">
              <p className="text-[10px] text-orange-600">
                {ronda?.prestamos.proximaCuota
                  ? `Próx. pago: ${fmtShort(ronda.prestamos.proximaCuota.fechaVenc)} · ${fmt(ronda.prestamos.proximaCuota.monto)}`
                  : "Sin próximo pago"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="px-4 mt-6">
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">

          {/* Nav */}
          <nav className="flex border-b border-gray-100">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-3 text-[10px] font-semibold transition-all sm:flex-row sm:justify-center sm:gap-2 sm:text-xs ${
                  tab === t.key
                    ? "border-b-2 border-emerald-600 text-emerald-700 bg-emerald-50/60"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }`}>
                <span className="text-sm">{t.emoji}</span>
                {t.label}
                {t.badge && t.badge > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          {/* ══ RESUMEN ══ */}
          {tab === "resumen" && (
            <div className="p-4 space-y-5">

              {/* Alertas pendientes express y multas */}
              {(expressActivos.length > 0 || multasPendientes.length > 0) && (
                <div className="space-y-2">
                  {expressActivos.length > 0 && (
                    <button onClick={() => setTab("express")}
                      className="w-full rounded-2xl bg-amber-50 border border-amber-200 p-3 flex items-center gap-3 text-left hover:bg-amber-100 transition-colors">
                      <span className="text-2xl shrink-0">⚡</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-800">
                          {expressActivos.length === 1 ? "Tienes un préstamo express pendiente" : `Tienes ${expressActivos.length} préstamos express pendientes`}
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          Total: {fmt(expressActivos.reduce((s: number, e: any) => s + Number(e.total), 0))} · Toca en la ronda actual
                        </p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-amber-400 shrink-0">
                        <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd"/>
                      </svg>
                    </button>
                  )}
                  {multasPendientes.length > 0 && (
                    <button onClick={() => setTab("express")}
                      className="w-full rounded-2xl bg-orange-50 border border-orange-200 p-3 flex items-center gap-3 text-left hover:bg-orange-100 transition-colors">
                      <span className="text-2xl shrink-0">⚠️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-orange-800">
                          {multasPendientes.length === 1 ? "Tienes una multa pendiente" : `Tienes ${multasPendientes.length} multas pendientes`}
                        </p>
                        <p className="text-xs text-orange-600 mt-0.5">
                          Total: {fmt(multasPendientes.reduce((s: number, m: any) => s + m.monto, 0))} · Pendientes de cobro
                        </p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-orange-400 shrink-0">
                        <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd"/>
                      </svg>
                    </button>
                  )}
                </div>
              )}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Estado de la ronda</p>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">{ronda.nombre}</span>
                      <span className="text-xs text-gray-400">Sem. {ronda.semanaActual}/{ronda.totalParticipantes}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Progreso</span>
                        <span>{Math.round((ronda.semanaActual / ronda.totalParticipantes) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                          style={{ width: `${(ronda.semanaActual / ronda.totalParticipantes) * 100}%` }} />
                      </div>
                    </div>

                    {ronda.receptorEstaSemana && (
                      <div className={`rounded-xl p-3 flex items-center gap-3 ${ronda.receptorEstaSemana.esMiTurno ? "bg-emerald-600 text-white" : "bg-white border border-gray-200"}`}>
                        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${ronda.receptorEstaSemana.esMiTurno ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"}`}>
                          {ronda.receptorEstaSemana.nombres[0]}{ronda.receptorEstaSemana.apellidos[0]}
                        </span>
                        <div>
                          <p className={`text-[10px] font-semibold uppercase tracking-wide ${ronda.receptorEstaSemana.esMiTurno ? "text-emerald-200" : "text-gray-400"}`}>Recibe esta semana</p>
                          <p className={`text-sm font-bold ${ronda.receptorEstaSemana.esMiTurno ? "text-white" : "text-gray-800"}`}>
                            {ronda.receptorEstaSemana.esMiTurno ? "¡Tú! 🎉" : `${ronda.receptorEstaSemana.nombres} ${ronda.receptorEstaSemana.apellidos}`}
                          </p>
                        </div>
                      </div>
                    )}

                    {ronda.estaEnRonda && ronda.semanaToca != null && !esSemanaDecobro && (
                      <div className={`rounded-xl px-4 py-3 ${ronda.semanasRestantes !== null && ronda.semanasRestantes < 0 ? "bg-gray-100" : "bg-blue-50 border border-blue-100"}`}>
                        {ronda.semanasRestantes !== null && ronda.semanasRestantes < 0
                          ? <p className="text-sm text-gray-500">✓ Ya recibiste en la semana #{ronda.semanaToca}</p>
                          : <>
                              <p className="text-sm font-semibold text-blue-700">Tu turno: semana #{ronda.semanaToca}</p>
                              <p className="text-xs text-blue-500 mt-0.5">Faltan {ronda.semanasRestantes} semana{ronda.semanasRestantes !== 1 ? "s" : ""} — {(() => {
                                const d = new Date(ronda.fechaInicio);
                                d.setDate(d.getDate() + (ronda.semanaToca! - 1) * 7);
                                return fmtShort(d.toISOString());
                              })()}</p>
                            </>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Aportes */}
              {ronda && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Mis aportes semanales</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Aporte semanal", value: fmt(ronda.montoAporteSemanal), color: "text-gray-800" },
                      { label: "Semanas pagadas", value: `${ronda.semanasPagadas}/${ronda.semanasEsperadas}`, color: "text-gray-800" },
                      { label: "Total aportado", value: fmt(ronda.totalAportado), color: "text-blue-700" },
                      {
                        label: ronda.diferencia >= 0 ? "Excedente" : "Pendiente",
                        value: fmt(Math.abs(ronda.diferencia)),
                        color: ronda.diferencia >= 0 ? "text-emerald-700" : "text-rose-700",
                      },
                    ].map(item => (
                      <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[10px] text-gray-400 font-medium">{item.label}</p>
                        <p className={`text-base font-bold tabular-nums mt-0.5 ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${ronda.diferencia >= 0 ? "bg-emerald-500" : "bg-blue-500"}`}
                      style={{ width: `${ronda.totalEsperado > 0 ? Math.min((ronda.totalAportado / ronda.totalEsperado) * 100, 100) : 0}%` }} />
                  </div>
                </div>
              )}

              {/* Inversión detalle */}
              {ronda?.inversion && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Mi cuenta de inversión</p>
                  <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-white border border-blue-100 p-3">
                        <p className="text-gray-400">Monto invertido</p>
                        <p className="text-base font-bold text-blue-700 tabular-nums mt-0.5">{fmt(ronda.inversion.montoInvertido)}</p>
                      </div>
                      <div className="rounded-xl bg-white border border-blue-100 p-3">
                        <p className="text-gray-400">Participación</p>
                        <p className="text-base font-bold text-blue-700 mt-0.5">{Number(ronda.inversion.porcentajeParticipacion).toFixed(2)}%</p>
                      </div>
                      <div className="rounded-xl bg-white border border-amber-100 p-3">
                        <p className="text-gray-400">Intereses</p>
                        <p className="text-base font-bold text-amber-700 tabular-nums mt-0.5">{fmt(ronda.inversion.interesesAcumulados)}</p>
                      </div>
                      <div className="rounded-xl bg-white border border-emerald-100 p-3">
                        <p className="text-gray-400">Total a recibir</p>
                        <p className="text-base font-bold text-emerald-700 tabular-nums mt-0.5">{fmt(ronda.inversion.montoInvertido + ronda.inversion.interesesAcumulados)}</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Tu participación en el fondo total ({fmt(ronda.inversion.fondoTotal)})</span>
                        <span>{Number(ronda.inversion.porcentajeParticipacion).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-blue-200 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500"
                          style={{ width: `${ronda.inversion.fondoTotal > 0 ? (ronda.inversion.montoInvertido / ronda.inversion.fondoTotal) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ahorros ronda detalle */}
              {ronda && ronda.ahorroObjetivo > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Ahorros en la ronda</p>
                  <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-white border border-violet-100 p-3 text-xs">
                        <p className="text-gray-400">Ahorrado</p>
                        <p className="text-base font-bold text-violet-700 tabular-nums mt-0.5">{fmt(ronda.totalAhorradoRonda)}</p>
                      </div>
                      <div className="rounded-xl bg-white border border-gray-100 p-3 text-xs">
                        <p className="text-gray-400">Objetivo</p>
                        <p className="text-base font-bold text-gray-700 tabular-nums mt-0.5">{fmt(ronda.ahorroObjetivo)}</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Progreso hacia la meta</span>
                        <span>{ronda.ahorroObjetivo > 0 ? Math.round((ronda.totalAhorradoRonda / ronda.ahorroObjetivo) * 100) : 0}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-violet-200 overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500 transition-all"
                          style={{ width: `${ronda.ahorroObjetivo > 0 ? Math.min((ronda.totalAhorradoRonda / ronda.ahorroObjetivo) * 100, 100) : 0}%` }} />
                      </div>
                    </div>
                    {ronda.pendienteAhorro > 0 && (
                      <p className="text-xs font-medium text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                        ⚠️ Falta ahorrar: {fmt(ronda.pendienteAhorro)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Sin ronda */}
              {!ronda && (
                <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
                  No hay una ronda activa actualmente
                </div>
              )}
            </div>
          )}

          {/* ══ MI RONDA ══ */}
          {tab === "ronda" && (
            <div className="p-4 space-y-4">
              {!ronda ? (
                <div className="py-10 text-center text-sm text-gray-400">No hay una ronda activa.</div>
              ) : (
                <>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">{ronda.nombre}</p>
                      <span className="text-xs text-gray-400">Desde {fmtDate(ronda.fechaInicio)}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progreso</span>
                        <span className="tabular-nums font-medium">{ronda.semanaActual} / {ronda.totalParticipantes} semanas</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                          style={{ width: `${(ronda.semanaActual / ronda.totalParticipantes) * 100}%` }} />
                      </div>
                    </div>
                    {ronda.receptorEstaSemana && (
                      <div className={`rounded-xl p-3 flex items-center gap-3 ${ronda.receptorEstaSemana.esMiTurno ? "bg-emerald-600" : "bg-white border border-gray-200"}`}>
                        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${ronda.receptorEstaSemana.esMiTurno ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"}`}>
                          {ronda.receptorEstaSemana.nombres[0]}{ronda.receptorEstaSemana.apellidos[0]}
                        </span>
                        <div>
                          <p className={`text-[10px] font-semibold uppercase tracking-wide ${ronda.receptorEstaSemana.esMiTurno ? "text-emerald-200" : "text-gray-400"}`}>Recibe semana #{ronda.semanaActual}</p>
                          <p className={`text-sm font-bold ${ronda.receptorEstaSemana.esMiTurno ? "text-white" : "text-gray-800"}`}>
                            {ronda.receptorEstaSemana.esMiTurno ? "¡Tú! 🎉" : `${ronda.receptorEstaSemana.nombres} ${ronda.receptorEstaSemana.apellidos}`}
                          </p>
                          <p className={`text-[10px] font-mono ${ronda.receptorEstaSemana.esMiTurno ? "text-emerald-200" : "text-gray-400"}`}>{ronda.receptorEstaSemana.numeroCuenta}</p>
                        </div>
                      </div>
                    )}
                    {ronda.estaEnRonda && ronda.semanaToca != null && (
                      <div className={`rounded-xl px-4 py-3 ${esSemanaDecobro ? "bg-amber-50 border border-amber-200" : ronda.semanasRestantes !== null && ronda.semanasRestantes < 0 ? "bg-gray-100" : "bg-blue-50 border border-blue-100"}`}>
                        {esSemanaDecobro ? <p className="text-sm font-semibold text-amber-800">🎉 ¡Esta semana te toca cobrar!</p>
                          : ronda.semanasRestantes !== null && ronda.semanasRestantes < 0 ? <p className="text-sm text-gray-600">✓ Ya recibí en la semana #{ronda.semanaToca}</p>
                          : <><p className="text-sm font-semibold text-blue-700">Mi turno: semana #{ronda.semanaToca}</p><p className="text-xs text-blue-500 mt-0.5">Faltan {ronda.semanasRestantes} semana{ronda.semanasRestantes !== 1 ? "s" : ""}</p></>}
                      </div>
                    )}
                    {!ronda.estaEnRonda && <p className="text-xs text-gray-400">No estás participando en esta ronda</p>}
                  </div>

                  <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-800">Aportes semanales</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3"><p className="text-gray-400">Aporte semanal</p><p className="font-bold text-gray-800 tabular-nums mt-0.5">{fmt(ronda.montoAporteSemanal)}</p></div>
                      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3"><p className="text-gray-400">Semanas pagadas</p><p className="font-bold text-gray-800 mt-0.5">{ronda.semanasPagadas} / {ronda.semanasEsperadas}</p></div>
                      <div className="rounded-xl bg-blue-50 border border-blue-100 p-3"><p className="text-blue-500">Total aportado</p><p className="font-bold text-blue-700 tabular-nums mt-0.5">{fmt(ronda.totalAportado)}</p></div>
                      <div className={`rounded-xl border p-3 ${ronda.diferencia >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
                        <p className={ronda.diferencia >= 0 ? "text-emerald-500" : "text-rose-500"}>{ronda.diferencia >= 0 ? "Excedente" : "Pendiente"}</p>
                        <p className={`font-bold tabular-nums mt-0.5 ${ronda.diferencia >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{fmt(Math.abs(ronda.diferencia))}</p>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div className={`h-full rounded-full ${ronda.diferencia >= 0 ? "bg-emerald-500" : "bg-blue-500"}`}
                        style={{ width: `${ronda.totalEsperado > 0 ? Math.min((ronda.totalAportado / ronda.totalEsperado) * 100, 100) : 0}%` }} />
                    </div>
                  </div>

                  {ronda.ahorroObjetivo > 0 && (
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 space-y-3">
                      <p className="text-sm font-semibold text-gray-800">Ahorros en la ronda</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-white border border-violet-100 p-3"><p className="text-violet-500">Ahorrado</p><p className="font-bold text-violet-700 tabular-nums mt-0.5">{fmt(ronda.totalAhorradoRonda)}</p></div>
                        <div className="rounded-xl bg-white border border-gray-100 p-3"><p className="text-gray-400">Objetivo</p><p className="font-bold text-gray-700 tabular-nums mt-0.5">{fmt(ronda.ahorroObjetivo)}</p></div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-violet-200 overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500"
                          style={{ width: `${ronda.ahorroObjetivo > 0 ? Math.min((ronda.totalAhorradoRonda / ronda.ahorroObjetivo) * 100, 100) : 0}%` }} />
                      </div>
                      {ronda.pendienteAhorro > 0 && <p className="text-xs text-amber-700 font-medium">Falta ahorrar: {fmt(ronda.pendienteAhorro)}</p>}
                    </div>
                  )}

                  {ronda.inversion ? (
                    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">Mi cuenta de inversión</p>
                        {ronda.inversion.devuelto && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Devuelta</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-white border border-blue-100 p-3"><p className="text-gray-400">Monto invertido</p><p className="font-bold text-blue-700 tabular-nums mt-0.5">{fmt(ronda.inversion.montoInvertido)}</p></div>
                        <div className="rounded-xl bg-white border border-blue-100 p-3"><p className="text-gray-400">% participación</p><p className="font-bold text-blue-700 mt-0.5">{Number(ronda.inversion.porcentajeParticipacion).toFixed(2)}%</p></div>
                        <div className="rounded-xl bg-white border border-amber-100 p-3"><p className="text-gray-400">Intereses</p><p className="font-bold text-amber-700 tabular-nums mt-0.5">{fmt(ronda.inversion.interesesAcumulados)}</p></div>
                        <div className="rounded-xl bg-white border border-emerald-100 p-3"><p className="text-gray-400">Total a recibir</p><p className="font-bold text-emerald-700 tabular-nums mt-0.5">{fmt(ronda.inversion.montoInvertido + ronda.inversion.interesesAcumulados)}</p></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Tu participación</span><span>{fmt(ronda.inversion.montoInvertido)} / {fmt(ronda.inversion.fondoTotal)}</span></div>
                        <div className="h-1.5 w-full rounded-full bg-blue-200 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${ronda.inversion.fondoTotal > 0 ? (ronda.inversion.montoInvertido / ronda.inversion.fondoTotal) * 100 : 0}%` }} /></div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-gray-400">No tienes inversión en esta ronda</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══ PRÉSTAMOS ══ */}
          {tab === "prestamos" && (
            <div className="p-4 space-y-4">
              {prestamos.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No tienes préstamos registrados.</div>
              ) : prestamos.map(p => {
                const pagadas = p.cuotas.filter(c => c.pagada).length;
                const total = p.cuotas.length;
                const pct = total > 0 ? (pagadas / total) * 100 : 0;
                const pendientes = p.cuotas.filter(c => !c.pagada);
                return (
                  <div key={p.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{p.ronda.nombre}</p>
                          <p className="text-xs text-gray-400">Interés mensual: {Number(p.tasaAnual)}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900 tabular-nums">{fmt(p.monto)}</p>
                          <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${p.estado === "ACTIVO" ? "bg-blue-100 text-blue-700" : p.estado === "CANCELADO" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{p.estado}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Cuotas pagadas</span><span className="tabular-nums">{pagadas} / {total}</span></div>
                        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} /></div>
                      </div>
                      {p.estado === "ACTIVO" && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl bg-gray-50 border border-gray-100 p-2.5"><p className="text-gray-400">Saldo pendiente</p><p className="font-bold text-gray-700 tabular-nums mt-0.5">{fmt(p.saldoActual)}</p></div>
                          <div className="rounded-xl bg-orange-50 border border-orange-100 p-2.5"><p className="text-orange-500">Próxima cuota</p><p className="font-bold text-orange-700 tabular-nums mt-0.5">{pendientes[0] ? fmt(pendientes[0].cuota) : "-"}</p>{pendientes[0] && <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(pendientes[0].fechaVenc)}</p>}</div>
                        </div>
                      )}
                    </div>
                    {pendientes.length > 0 && (
                      <div className="border-t border-gray-100">
                        <div className="bg-gray-50 px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cuotas pendientes</div>
                        <ul className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                          {pendientes.map(c => {
                            const vencida = new Date(c.fechaVenc) < new Date();
                            return (
                              <li key={c.id} className={`flex items-center justify-between px-4 py-2.5 text-xs ${vencida ? "bg-rose-50" : ""}`}>
                                <span className={vencida ? "text-rose-700 font-medium" : "text-gray-600"}>Cuota #{c.numero} · {fmtDate(c.fechaVenc)}{vencida ? " ⚠️" : ""}</span>
                                <span className="font-bold text-orange-700 tabular-nums">{fmt(c.cuota)}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ EXPRESS Y MULTAS ══ */}
          {tab === "express" && (
            <div className="p-4 space-y-4">

              {/* Express pendientes */}
              {expressActivos.length > 0 && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">⚡</span>
                    <p className="font-semibold text-amber-800 text-sm">Préstamo{expressActivos.length > 1 ? "s" : ""} express pendiente{expressActivos.length > 1 ? "s" : ""}</p>
                    <span className="ml-auto rounded-full bg-amber-200 text-amber-800 px-2 py-0.5 text-xs font-bold">
                      {fmt(expressActivos.reduce((s: number, e: any) => s + Number(e.total), 0))}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {expressActivos.map((e: any) => (
                      <div key={e.id} className="rounded-xl bg-white border border-amber-100 p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{e.rondaNombre} · Sem. {e.semana}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Principal: {fmt(Number(e.principal))} + Interés: {fmt(Number(e.interesAcumulado ?? e.interes ?? 0))}
                            </p>
                            {e.semanasVencidas > 0 && (
                              <p className="text-xs font-semibold text-red-600 mt-0.5">+{e.semanasVencidas} semana{e.semanasVencidas > 1 ? "s" : ""} de retraso</p>
                            )}
                          </div>
                          <p className="text-base font-bold text-amber-700">{fmt(Number(e.total))}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Historial express completo */}
              {express.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historial express</p>
                  <div className="space-y-2">
                    {express.map((e: any) => (
                      <div key={e.id} className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                        e.estado === "PENDIENTE" ? "border-amber-200 bg-amber-50/40" : "border-gray-100 bg-white"
                      }`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              e.estado === "PENDIENTE" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                            }`}>{e.estado}</span>
                            <span className="text-xs text-gray-400">{e.rondaNombre} · Sem. {e.semana}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Principal {fmt(Number(e.principal))} · Interés {fmt(Number(e.interesAcumulado ?? e.interes ?? 0))}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-gray-700 shrink-0">{fmt(Number(e.total))}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {express.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">
                  <p className="text-2xl mb-2">⚡</p>
                  Sin préstamos express registrados.
                </div>
              )}

              {/* Multas */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Multas
                  {multasPendientes.length > 0 && (
                    <span className="ml-2 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold">
                      {multasPendientes.length} pendiente{multasPendientes.length > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
                {multas.length === 0 ? (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center text-sm text-emerald-700">
                    ✓ Sin multas registradas
                  </div>
                ) : (
                  <div className="space-y-2">
                    {multas.map((m: any) => (
                      <div key={m.id} className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                        m.estado === "PENDIENTE" ? "border-amber-200 bg-amber-50/40" : "border-gray-100 bg-white"
                      }`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              m.estado === "PENDIENTE" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                            }`}>{m.estado === "PENDIENTE" ? "Pendiente" : "Cobrada"}</span>
                            <span className="text-xs text-gray-400">{m.rondaNombre}{m.semana ? ` · Sem. ${m.semana}` : ""}</span>
                          </div>
                          {m.descripcion && <p className="text-xs text-gray-500 mt-0.5">{m.descripcion}</p>}
                        </div>
                        <p className={`text-sm font-bold shrink-0 ${m.estado === "PENDIENTE" ? "text-amber-700" : "text-gray-500"}`}>
                          {fmt(m.monto)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ MOVIMIENTOS ══ */}
          {tab === "movimientos" && (
            <div>
              {movimientos.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Sin movimientos registrados.</div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {movimientos.map(m => (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${tipoBg[m.tipo] ?? "bg-gray-100 text-gray-700"}`}>
                          {tipoSigno[m.tipo]}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{tipoLabel[m.tipo] ?? m.tipo}</p>
                          <p className="text-xs text-gray-400 truncate">{m.ronda?.nombre && <>{m.ronda.nombre} · </>}{fmtDT(m.createdAt)}</p>
                          {m.nota && <p className="text-xs text-gray-400 truncate italic">{m.nota}</p>}
                        </div>
                      </div>
                      <p className={`text-sm font-bold tabular-nums shrink-0 ${tipoColor[m.tipo] ?? "text-gray-700"}`}>
                        {tipoSigno[m.tipo]}{fmt(m.monto)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
