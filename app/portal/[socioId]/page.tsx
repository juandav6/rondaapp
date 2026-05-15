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
const fmtDate = (iso: string) => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return "-"; return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d); };
const fmtDT = (iso: string) => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return "-"; return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d); };
const tipoColor: Record<string, string> = { INVERSION: "text-blue-700", RETIRO: "text-rose-700", DEVOLUCION: "text-emerald-700", INTERES: "text-amber-700", AHORRO: "text-emerald-700" };
const tipoSigno: Record<string, string> = { INVERSION: "−", RETIRO: "−", DEVOLUCION: "+", INTERES: "+", AHORRO: "+" };
const tipoLabel: Record<string, string> = { INVERSION: "Inversión", RETIRO: "Retiro", DEVOLUCION: "Devolución", INTERES: "Interés", AHORRO: "Ahorro" };

type Tab = "resumen" | "ronda" | "prestamos" | "movimientos";

export default function PortalSocioPage() {
  const params = useParams();
  const socioId = params.socioId as string;
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
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
      setLoading(false);
    }
    load();
  }, [socioId]);

  if (loading) return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}
    </div>
  );

  const { socio, ronda } = resumen ?? {};
  const prestamosActivos = prestamos.filter(p => p.estado === "ACTIVO");
  const cuotasPendientes = prestamosActivos.flatMap(p => p.cuotas.filter(c => !c.pagada)).sort((a, b) => new Date(a.fechaVenc).getTime() - new Date(b.fechaVenc).getTime());
  const totalIntereses = movimientos.filter(m => m.tipo === "INTERES").reduce((a, m) => a + m.monto, 0);
  const esSemanaDecobro = ronda?.estaEnRonda && ronda?.semanasRestantes === 0;

  const tabs = [
    { key: "resumen" as Tab, label: "Resumen", icon: "📊" },
    { key: "ronda" as Tab, label: "Mi Ronda", icon: "🔄" },
    { key: "prestamos" as Tab, label: "Préstamos", icon: "💳" },
    { key: "movimientos" as Tab, label: "Movimientos", icon: "📋" },
  ];

  return (
    <div className="space-y-4 pb-6">

      {/* ── Banner celebración ── */}
      {esSemanaDecobro && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 shadow-lg">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-6 right-10 h-20 w-20 rounded-full bg-white/10" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl">💰</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100">{ronda?.nombre} · Semana #{ronda?.semanaToca}</p>
              <h2 className="mt-0.5 text-xl font-bold text-white leading-tight">¡Esta semana te toca cobrar!</h2>
              <p className="mt-1 text-sm text-emerald-100">Recibirás los aportes de todos los socios. Contacta al responsable de cobro.</p>
              <button onClick={() => setTab("ronda")} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold text-white transition-colors">
                Ver detalles →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header socio ── */}
      <div className="rounded-xl border bg-white p-4 shadow-sm flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
          {socio?.nombres?.[0]}{socio?.apellidos?.[0]}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-gray-900 truncate">Hola, {socio?.nombres?.split(" ")[0]} 👋</h1>
          <p className="text-xs text-gray-400 font-mono">{socio?.numeroCuenta}</p>
        </div>
        {ronda && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{ronda.nombre}
          </span>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <nav className="flex border-b">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors sm:flex-row sm:justify-center sm:gap-1.5 sm:text-sm sm:py-3 ${tab === t.key ? "border-b-2 border-blue-600 text-blue-700 bg-blue-50/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
              <span className="text-base sm:text-sm">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {/* ══ TAB RESUMEN ══ */}
        {tab === "resumen" && (
          <div className="p-4 space-y-3">

            {/* Saldo ahorros libre */}
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-emerald-100 uppercase tracking-wide">Cuenta de ahorros libre</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{fmt(socio?.saldoAhorros)}</p>
                  <p className="text-xs text-emerald-100 mt-1">Disponible para retiro</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl">💵</div>
              </div>
              {totalIntereses > 0 && (
                <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
                  <span className="text-emerald-100">Intereses ganados</span>
                  <span className="font-semibold text-white">{fmt(totalIntereses)}</span>
                </div>
              )}
            </div>

            {/* Ronda activa — quién recibe esta semana */}
            {ronda && (
              <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">Ronda activa · {ronda.nombre}</p>
                  <span className="text-xs text-gray-400">Sem. {ronda.semanaActual}/{ronda.totalParticipantes}</span>
                </div>

                {/* Barra progreso */}
                <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(ronda.semanaActual / ronda.totalParticipantes) * 100}%` }} />
                </div>

                {/* Quién recibe esta semana */}
                {ronda.receptorEstaSemana && (
                  <div className={`rounded-lg p-3 text-sm flex items-center gap-3 ${ronda.receptorEstaSemana.esMiTurno ? "bg-emerald-50 border border-emerald-200" : "bg-gray-50 border"}`}>
                    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ronda.receptorEstaSemana.esMiTurno ? "bg-emerald-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                      {ronda.receptorEstaSemana.nombres[0]}{ronda.receptorEstaSemana.apellidos[0]}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${ronda.receptorEstaSemana.esMiTurno ? "text-emerald-800" : "text-gray-700"}`}>
                        {ronda.receptorEstaSemana.esMiTurno ? "🎉 Esta semana te toca a ti" : `Recibe: ${ronda.receptorEstaSemana.nombres} ${ronda.receptorEstaSemana.apellidos}`}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">{ronda.receptorEstaSemana.numeroCuenta}</p>
                    </div>
                  </div>
                )}

                {/* Mi turno */}
                {ronda.estaEnRonda && ronda.semanaToca != null && !esSemanaDecobro && (
                  <div className={`rounded-lg px-3 py-2 text-xs ${ronda.semanasRestantes !== null && ronda.semanasRestantes < 0 ? "bg-gray-50 text-gray-500" : "bg-blue-50 text-blue-700"}`}>
                    {ronda.semanasRestantes !== null && ronda.semanasRestantes < 0
                      ? `✓ Ya recibí en la semana #${ronda.semanaToca}`
                      : `⏳ Mi turno: semana #${ronda.semanaToca} · Faltan ${ronda.semanasRestantes} semana${ronda.semanasRestantes !== 1 ? "s" : ""}`}
                  </div>
                )}
              </div>
            )}

            {/* Grid de datos clave */}
            {ronda && (
              <div className="grid grid-cols-2 gap-2">

                {/* Inversión */}
                {ronda.inversion && (
                  <div className="rounded-xl border bg-white p-3 shadow-sm col-span-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fondo de inversión</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">Mi aporte</p>
                        <p className="font-bold text-blue-700 tabular-nums mt-0.5">{fmt(ronda.inversion.montoInvertido)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">% participación</p>
                        <p className="font-bold text-blue-700 mt-0.5">{Number(ronda.inversion.porcentajeParticipacion).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Fondo total</p>
                        <p className="font-bold text-gray-700 tabular-nums mt-0.5">{fmt(ronda.inversion.fondoTotal)}</p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500"
                        style={{ width: `${ronda.inversion.fondoTotal > 0 ? (ronda.inversion.montoInvertido / ronda.inversion.fondoTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}

                {/* Aportes */}
                <div className="rounded-xl border bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Aportes</p>
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{fmt(ronda.totalAportado)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ronda.semanasPagadas} de {ronda.semanasEsperadas} sem.</p>
                  <div className={`mt-2 text-xs font-medium ${ronda.diferencia >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {ronda.diferencia >= 0 ? `+${fmt(ronda.diferencia)} excedente` : `${fmt(Math.abs(ronda.diferencia))} pendiente`}
                  </div>
                </div>

                {/* Ahorros ronda */}
                <div className="rounded-xl border bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ahorros ronda</p>
                  <p className="text-lg font-bold text-emerald-700 tabular-nums">{fmt(ronda.totalAhorradoRonda)}</p>
                  {ronda.ahorroObjetivo > 0 && (
                    <>
                      <p className="text-xs text-gray-400 mt-0.5">Meta: {fmt(ronda.ahorroObjetivo)}</p>
                      <div className={`mt-2 text-xs font-medium ${ronda.pendienteAhorro === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                        {ronda.pendienteAhorro === 0 ? "✓ Meta alcanzada" : `${fmt(ronda.pendienteAhorro)} pendiente`}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Préstamos pendientes */}
            {ronda && ronda.prestamos.cantidadActivos > 0 && (
              <div className="rounded-xl border bg-white p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Préstamos activos</p>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{ronda.prestamos.cantidadActivos}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total pendiente</span>
                  <span className="text-sm font-bold text-rose-700 tabular-nums">{fmt(ronda.prestamos.totalSaldo)}</span>
                </div>
                {ronda.prestamos.proximaCuota && (
                  <div className="rounded-lg bg-orange-50 border border-orange-100 px-3 py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-orange-800">Próximo pago</p>
                      <p className="text-xs text-orange-600 mt-0.5">{fmtDate(ronda.prestamos.proximaCuota.fechaVenc)} · Cuota #{ronda.prestamos.proximaCuota.numero}</p>
                    </div>
                    <p className="text-base font-bold text-orange-700 tabular-nums shrink-0">{fmt(ronda.prestamos.proximaCuota.monto)}</p>
                  </div>
                )}
                <button onClick={() => setTab("prestamos")} className="w-full text-center text-xs text-blue-600 hover:underline pt-1">
                  Ver detalle de cuotas →
                </button>
              </div>
            )}

            {/* Sin ronda activa */}
            {!ronda && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-400">
                No hay una ronda activa actualmente
              </div>
            )}
          </div>
        )}

        {/* ══ TAB MI RONDA ══ */}
        {tab === "ronda" && (
          <div className="p-4 space-y-4">
            {!ronda ? (
              <div className="py-10 text-center text-sm text-gray-400">No hay una ronda activa actualmente.</div>
            ) : (
              <>
                <div className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">{ronda.nombre}</p>
                    <span className="text-xs text-gray-400">Desde {fmtDate(ronda.fechaInicio)}</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progreso de la ronda</span>
                      <span className="tabular-nums font-medium">{ronda.semanaActual} / {ronda.totalParticipantes} semanas</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${(ronda.semanaActual / ronda.totalParticipantes) * 100}%` }} />
                    </div>
                  </div>
                  {ronda.receptorEstaSemana && (
                    <div className={`rounded-lg p-3 flex items-center gap-3 ${ronda.receptorEstaSemana.esMiTurno ? "bg-emerald-50 border border-emerald-200" : "bg-gray-50 border"}`}>
                      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ronda.receptorEstaSemana.esMiTurno ? "bg-emerald-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                        {ronda.receptorEstaSemana.nombres[0]}{ronda.receptorEstaSemana.apellidos[0]}
                      </span>
                      <div>
                        <p className="text-xs text-gray-500">Recibe esta semana (#{ronda.semanaActual})</p>
                        <p className={`text-sm font-semibold ${ronda.receptorEstaSemana.esMiTurno ? "text-emerald-800" : "text-gray-800"}`}>
                          {ronda.receptorEstaSemana.esMiTurno ? "¡Tú! 🎉" : `${ronda.receptorEstaSemana.nombres} ${ronda.receptorEstaSemana.apellidos}`}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{ronda.receptorEstaSemana.numeroCuenta}</p>
                      </div>
                    </div>
                  )}
                  {ronda.estaEnRonda && ronda.semanaToca != null && (
                    <div className={`rounded-lg px-3 py-2.5 text-sm ${esSemanaDecobro ? "bg-amber-50 border border-amber-200" : ronda.semanasRestantes !== null && ronda.semanasRestantes < 0 ? "bg-gray-50 border" : "bg-blue-50 border border-blue-100"}`}>
                      {esSemanaDecobro ? <p className="font-semibold text-amber-800">🎉 ¡Esta semana te toca cobrar!</p>
                        : ronda.semanasRestantes !== null && ronda.semanasRestantes < 0 ? <p className="text-gray-600">✓ Ya recibí en la semana #{ronda.semanaToca}</p>
                        : <><p className="text-blue-700 font-medium">Mi turno: semana #{ronda.semanaToca}</p><p className="text-xs text-blue-500 mt-0.5">Faltan {ronda.semanasRestantes} semana{ronda.semanasRestantes !== 1 ? "s" : ""}</p></>}
                    </div>
                  )}
                  {!ronda.estaEnRonda && <p className="text-xs text-gray-400">No estás participando en esta ronda</p>}
                </div>

                <div className="rounded-xl border p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-800">Aportes semanales</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-gray-50 p-2.5"><p className="text-gray-400">Aporte semanal</p><p className="font-bold text-gray-800 tabular-nums mt-0.5">{fmt(ronda.montoAporteSemanal)}</p></div>
                    <div className="rounded-lg bg-gray-50 p-2.5"><p className="text-gray-400">Semanas pagadas</p><p className="font-bold text-gray-800 mt-0.5">{ronda.semanasPagadas} / {ronda.semanasEsperadas}</p></div>
                    <div className="rounded-lg bg-blue-50 p-2.5"><p className="text-blue-500">Total aportado</p><p className="font-bold text-blue-700 tabular-nums mt-0.5">{fmt(ronda.totalAportado)}</p></div>
                    <div className={`rounded-lg p-2.5 ${ronda.diferencia >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
                      <p className={ronda.diferencia >= 0 ? "text-emerald-500" : "text-rose-500"}>{ronda.diferencia >= 0 ? "Excedente" : "Pendiente"}</p>
                      <p className={`font-bold tabular-nums mt-0.5 ${ronda.diferencia >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{fmt(Math.abs(ronda.diferencia))}</p>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full rounded-full ${ronda.diferencia >= 0 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${ronda.totalEsperado > 0 ? Math.min((ronda.totalAportado / ronda.totalEsperado) * 100, 100) : 0}%` }} />
                  </div>
                </div>

                {ronda.ahorroObjetivo > 0 && (
                  <div className="rounded-xl border p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-800">Ahorros en la ronda</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-emerald-50 p-2.5"><p className="text-emerald-500">Ahorrado</p><p className="font-bold text-emerald-700 tabular-nums mt-0.5">{fmt(ronda.totalAhorradoRonda)}</p></div>
                      <div className="rounded-lg bg-gray-50 p-2.5"><p className="text-gray-400">Objetivo</p><p className="font-bold text-gray-700 tabular-nums mt-0.5">{fmt(ronda.ahorroObjetivo)}</p></div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${ronda.ahorroObjetivo > 0 ? Math.min((ronda.totalAhorradoRonda / ronda.ahorroObjetivo) * 100, 100) : 0}%` }} />
                    </div>
                    {ronda.pendienteAhorro > 0 && <p className="text-xs text-amber-600 font-medium">Falta ahorrar: {fmt(ronda.pendienteAhorro)}</p>}
                  </div>
                )}

                {ronda.inversion ? (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">Mi cuenta de inversión</p>
                      {ronda.inversion.devuelto && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Devuelta</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white border p-2.5"><p className="text-gray-400">Monto invertido</p><p className="font-bold text-blue-700 tabular-nums mt-0.5">{fmt(ronda.inversion.montoInvertido)}</p></div>
                      <div className="rounded-lg bg-white border p-2.5"><p className="text-gray-400">% participación</p><p className="font-bold text-blue-700 mt-0.5">{Number(ronda.inversion.porcentajeParticipacion).toFixed(2)}%</p></div>
                      <div className="rounded-lg bg-white border p-2.5"><p className="text-gray-400">Intereses acumulados</p><p className="font-bold text-amber-700 tabular-nums mt-0.5">{fmt(ronda.inversion.interesesAcumulados)}</p></div>
                      <div className="rounded-lg bg-white border p-2.5"><p className="text-gray-400">Total a recibir</p><p className="font-bold text-emerald-700 tabular-nums mt-0.5">{fmt(ronda.inversion.montoInvertido + ronda.inversion.interesesAcumulados)}</p></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Tu participación en el fondo</span><span>{fmt(ronda.inversion.montoInvertido)} / {fmt(ronda.inversion.fondoTotal)}</span></div>
                      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${ronda.inversion.fondoTotal > 0 ? (ronda.inversion.montoInvertido / ronda.inversion.fondoTotal) * 100 : 0}%` }} /></div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-center text-sm text-gray-400">No tienes inversión en esta ronda</div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ TAB PRÉSTAMOS ══ */}
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
                <div key={p.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div><p className="text-sm font-semibold text-gray-900">{p.ronda.nombre}</p><p className="text-xs text-gray-400">Interés mensual: {Number(p.tasaAnual)}%</p></div>
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
                        <div className="rounded bg-gray-50 p-2"><p className="text-gray-400">Saldo pendiente</p><p className="font-bold text-gray-700 tabular-nums mt-0.5">{fmt(p.saldoActual)}</p></div>
                        <div className="rounded bg-orange-50 p-2"><p className="text-orange-500">Próxima cuota</p><p className="font-bold text-orange-700 tabular-nums mt-0.5">{pendientes[0] ? fmt(pendientes[0].cuota) : "-"}</p>{pendientes[0] && <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(pendientes[0].fechaVenc)}</p>}</div>
                      </div>
                    )}
                  </div>
                  {pendientes.length > 0 && (
                    <div className="border-t">
                      <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cuotas pendientes</div>
                      <ul className="divide-y max-h-48 overflow-y-auto">
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

        {/* ══ TAB MOVIMIENTOS ══ */}
        {tab === "movimientos" && (
          <div>
            {movimientos.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">Sin movimientos registrados.</div>
            ) : (
              <ul className="divide-y">
                {movimientos.map(m => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tipoSigno[m.tipo] === "+" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{tipoSigno[m.tipo]}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{tipoLabel[m.tipo] ?? m.tipo}</p>
                        <p className="text-xs text-gray-400 truncate">{m.ronda?.nombre && <>{m.ronda.nombre} · </>}{fmtDT(m.createdAt)}</p>
                        {m.nota && <p className="text-xs text-gray-400 truncate">{m.nota}</p>}
                      </div>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums shrink-0 ${tipoColor[m.tipo] ?? "text-gray-700"}`}>{tipoSigno[m.tipo]}{fmt(m.monto)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
