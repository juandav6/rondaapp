// app/portal/[socioId]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Ronda = {
  id: number; nombre: string; semanaActual: number; totalParticipantes: number;
  semanaToca: number | null; semanasRestantes: number | null;
  estaEnRonda: boolean; fechaInicio: string; montoAporteSemanal: number;
  totalAportado: number; totalEsperado: number; diferencia: number;
  semanasPagadas: number; semanasEsperadas: number;
  totalAhorradoRonda: number; ahorroObjetivo: number;
  inversion: {
    montoInvertido: number; porcentajeParticipacion: number;
    interesesAcumulados: number; devuelto: boolean; fondoTotal: number;
  } | null;
};
type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string; saldoAhorros: number };
type Resumen = { socio: Socio; ronda: Ronda | null };
type Prestamo = {
  id: number; monto: number; tasaAnual: number; estado: string; saldoActual: number;
  ronda: { nombre: string };
  cuotas: { id: number; numero: number; fechaVenc: string; cuota: number; pagada: boolean; fechaPago: string | null }[];
};
type Movimiento = {
  id: number; tipo: string; monto: number; nota: string | null;
  createdAt: string; ronda?: { nombre: string } | null;
};

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};
const fmtDT = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
};

const tipoColor: Record<string, string> = {
  INVERSION: "text-blue-700", RETIRO: "text-rose-700",
  DEVOLUCION: "text-emerald-700", INTERES: "text-amber-700", AHORRO: "text-emerald-700",
};
const tipoSigno: Record<string, string> = {
  INVERSION: "−", RETIRO: "−", DEVOLUCION: "+", INTERES: "+", AHORRO: "+",
};
const tipoLabel: Record<string, string> = {
  INVERSION: "Inversión", RETIRO: "Retiro", DEVOLUCION: "Devolución", INTERES: "Interés", AHORRO: "Ahorro",
};

type Tab = "resumen" | "ronda" | "prestamos" | "movimientos";

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "resumen", label: "Resumen",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z"/></svg>
  },
  {
    key: "ronda", label: "Mi Ronda",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm0 8.625a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM15.375 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0ZM7.5 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clipRule="evenodd"/></svg>
  },
  {
    key: "prestamos", label: "Préstamos",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z" clipRule="evenodd"/></svg>
  },
  {
    key: "movimientos", label: "Movimientos",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M1.72 5.47a.75.75 0 0 1 1.06 0L9 11.69l3.756-3.756a.75.75 0 0 1 .985-.066 12.698 12.698 0 0 1 4.575 6.832l.308 1.149 2.277-3.943a.75.75 0 1 1 1.299.75l-3.182 5.51a.75.75 0 0 1-1.025.275l-5.511-3.181a.75.75 0 0 1 .75-1.3l3.943 2.277-.308-1.149a11.194 11.194 0 0 0-3.528-5.617l-3.809 3.81a.75.75 0 0 1-1.06 0L1.72 6.53a.75.75 0 0 1 0-1.061Z" clipRule="evenodd"/></svg>
  },
];

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
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}
    </div>
  );

  const { socio, ronda } = resumen ?? {};
  const prestamosActivos = prestamos.filter(p => p.estado === "ACTIVO");
  const cuotasPendientes = prestamosActivos
    .flatMap(p => p.cuotas.filter(c => !c.pagada))
    .sort((a, b) => new Date(a.fechaVenc).getTime() - new Date(b.fechaVenc).getTime());
  const totalIntereses = movimientos.filter(m => m.tipo === "INTERES").reduce((a, m) => a + m.monto, 0);
  const esSemanaDecobro = ronda?.estaEnRonda && ronda?.semanasRestantes === 0;

  return (
    <div className="space-y-4 pb-6">

      {/* ── Banner celebración semana de cobro ── */}
      {esSemanaDecobro && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 shadow-lg">
          {/* Círculos decorativos de fondo */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-6 right-10 h-20 w-20 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute bottom-2 right-28 h-10 w-10 rounded-full bg-white/10" />

          <div className="relative flex items-start gap-4">
            {/* Ícono moneda */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl">
              💰
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100">
                {ronda?.nombre}  ·  Semana #{ronda?.semanaToca}
              </p>
              <h2 className="mt-0.5 text-xl font-bold text-white leading-tight">
                ¡Esta semana te toca cobrar!
              </h2>
              <p className="mt-1 text-sm text-emerald-100">
                Recibirás los aportes de todos los socios. Contacta al responsable de cobro para coordinar.
              </p>
              <button
                onClick={() => setTab("ronda")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                Ver detalles de la ronda
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bienvenida */}
      <div className="rounded-xl border bg-white p-4 shadow-sm flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
          {socio?.nombres?.[0]}{socio?.apellidos?.[0]}
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">
            Hola, {socio?.nombres?.split(" ")[0]} 👋
          </h1>
          <p className="text-xs text-gray-400 font-mono">{socio?.numeroCuenta}</p>
        </div>
        {ronda && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {ronda.nombre}
          </span>
        )}
      </div>

      {/* Nav tabs — barra horizontal con íconos */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <nav className="flex border-b">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors sm:flex-row sm:justify-center sm:gap-2 sm:text-sm ${
                tab === t.key
                  ? "border-b-2 border-blue-600 text-blue-700 bg-blue-50/50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        {/* ── RESUMEN ── */}
        {tab === "resumen" && (
          <div className="p-4 space-y-4">
            {/* KPIs rápidos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                <p className="text-xs text-emerald-600">Saldo ahorros libre</p>
                <p className="mt-1 text-xl font-bold text-emerald-700 tabular-nums">{fmt(socio?.saldoAhorros)}</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs text-amber-600">Intereses ganados</p>
                <p className="mt-1 text-xl font-bold text-amber-700 tabular-nums">{fmt(totalIntereses)}</p>
              </div>
            </div>

            {/* Préstamos activos (resumen) */}
            {prestamosActivos.length > 0 && (
              <div className="rounded-xl border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">Préstamos activos</p>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{prestamosActivos.length}</span>
                </div>
                {cuotasPendientes.slice(0, 2).map(c => {
                  const vencida = new Date(c.fechaVenc) < new Date();
                  return (
                    <div key={c.id} className={`rounded-lg p-2.5 text-xs flex items-center justify-between ${vencida ? "bg-rose-50 border border-rose-100" : "bg-gray-50 border"}`}>
                      <span className={vencida ? "text-rose-700" : "text-gray-600"}>
                        Cuota #{c.numero} · vence {fmtDate(c.fechaVenc)}{vencida ? " ⚠️" : ""}
                      </span>
                      <span className="font-bold text-orange-700">{fmt(c.cuota)}</span>
                    </div>
                  );
                })}
                {cuotasPendientes.length > 2 && (
                  <button onClick={() => setTab("prestamos")} className="text-xs text-blue-600 hover:underline">
                    Ver todas las cuotas ({cuotasPendientes.length}) →
                  </button>
                )}
              </div>
            )}

            {/* Atajos */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTab("ronda")}
                className="rounded-xl border p-3 text-left hover:bg-gray-50 transition-colors">
                <p className="text-xs text-gray-500">Mi ronda</p>
                <p className="text-sm font-semibold text-gray-800 mt-1">{ronda ? ronda.nombre : "Sin ronda"}</p>
                {ronda && <p className="text-xs text-gray-400 mt-0.5">Semana {ronda.semanaActual}/{ronda.totalParticipantes}</p>}
              </button>
              <button onClick={() => setTab("movimientos")}
                className="rounded-xl border p-3 text-left hover:bg-gray-50 transition-colors">
                <p className="text-xs text-gray-500">Últimos movimientos</p>
                <p className="text-sm font-semibold text-gray-800 mt-1">{movimientos.length} registros</p>
                {movimientos[0] && <p className="text-xs text-gray-400 mt-0.5">{tipoLabel[movimientos[0].tipo]}</p>}
              </button>
            </div>
          </div>
        )}

        {/* ── MI RONDA ── */}
        {tab === "ronda" && (
          <div className="p-4 space-y-4">
            {!ronda ? (
              <div className="py-10 text-center text-sm text-gray-400">No hay una ronda activa actualmente.</div>
            ) : (
              <>
                {/* Header ronda */}
                <div className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">{ronda.nombre}</p>
                    <span className="text-xs text-gray-400">Desde {fmtDate(ronda.fechaInicio)}</span>
                  </div>
                  {/* Progreso semanas */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progreso de la ronda</span>
                      <span className="tabular-nums font-medium">{ronda.semanaActual} / {ronda.totalParticipantes} semanas</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${(ronda.semanaActual / ronda.totalParticipantes) * 100}%` }} />
                    </div>
                  </div>
                  {/* Turno */}
                  {ronda.estaEnRonda && ronda.semanaToca != null && (
                    <div className={`rounded-lg px-3 py-2.5 text-sm ${
                      ronda.semanasRestantes === 0 ? "bg-amber-50 border border-amber-200" :
                      ronda.semanasRestantes !== null && ronda.semanasRestantes < 0 ? "bg-gray-50 border" :
                      "bg-blue-50 border border-blue-100"}`}>
                      {ronda.semanasRestantes === 0 ? (
                        <p className="font-semibold text-amber-800">🎉 ¡Esta semana te toca cobrar!</p>
                      ) : ronda.semanasRestantes !== null && ronda.semanasRestantes < 0 ? (
                        <p className="text-gray-600">Ya cobré en la semana #{ronda.semanaToca}</p>
                      ) : (
                        <>
                          <p className="text-blue-700 font-medium">Tu turno: semana #{ronda.semanaToca}</p>
                          <p className="text-xs text-blue-500 mt-0.5">Faltan {ronda.semanasRestantes} semana{ronda.semanasRestantes !== 1 ? "s" : ""}</p>
                        </>
                      )}
                    </div>
                  )}
                  {!ronda.estaEnRonda && (
                    <p className="text-xs text-gray-400">No estás participando en esta ronda</p>
                  )}
                </div>

                {/* Aportes semanales */}
                <div className="rounded-xl border p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-800">Aportes semanales</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-gray-50 p-2.5">
                      <p className="text-gray-400">Aporte semanal</p>
                      <p className="font-bold text-gray-800 tabular-nums mt-0.5">{fmt(ronda.montoAporteSemanal)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2.5">
                      <p className="text-gray-400">Semanas pagadas</p>
                      <p className="font-bold text-gray-800 mt-0.5">{ronda.semanasPagadas} / {ronda.semanasEsperadas}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-2.5">
                      <p className="text-blue-500">Total aportado</p>
                      <p className="font-bold text-blue-700 tabular-nums mt-0.5">{fmt(ronda.totalAportado)}</p>
                    </div>
                    <div className={`rounded-lg p-2.5 ${ronda.diferencia >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
                      <p className={ronda.diferencia >= 0 ? "text-emerald-500" : "text-rose-500"}>
                        {ronda.diferencia >= 0 ? "Excedente" : "Pendiente"}
                      </p>
                      <p className={`font-bold tabular-nums mt-0.5 ${ronda.diferencia >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {fmt(Math.abs(ronda.diferencia))}
                      </p>
                    </div>
                  </div>
                  {/* Barra de progreso aportes */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Pagado vs esperado</span>
                      <span>{ronda.totalEsperado > 0 ? Math.round((ronda.totalAportado / ronda.totalEsperado) * 100) : 0}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div className={`h-full rounded-full ${ronda.diferencia >= 0 ? "bg-emerald-500" : "bg-blue-500"}`}
                        style={{ width: `${ronda.totalEsperado > 0 ? Math.min((ronda.totalAportado / ronda.totalEsperado) * 100, 100) : 0}%` }} />
                    </div>
                  </div>
                </div>

                {/* Ahorros en la ronda */}
                {ronda.ahorroObjetivo > 0 && (
                  <div className="rounded-xl border p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-800">Ahorros en la ronda</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-emerald-50 p-2.5">
                        <p className="text-emerald-500">Ahorrado</p>
                        <p className="font-bold text-emerald-700 tabular-nums mt-0.5">{fmt(ronda.totalAhorradoRonda)}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-2.5">
                        <p className="text-gray-400">Objetivo</p>
                        <p className="font-bold text-gray-700 tabular-nums mt-0.5">{fmt(ronda.ahorroObjetivo)}</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progreso del objetivo</span>
                        <span>{ronda.ahorroObjetivo > 0 ? Math.round((ronda.totalAhorradoRonda / ronda.ahorroObjetivo) * 100) : 0}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${ronda.ahorroObjetivo > 0 ? Math.min((ronda.totalAhorradoRonda / ronda.ahorroObjetivo) * 100, 100) : 0}%` }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Cuenta de inversión */}
                {ronda.inversion ? (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">Mi cuenta de inversión</p>
                      {ronda.inversion.devuelto && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Devuelta</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white border p-2.5">
                        <p className="text-gray-400">Monto invertido</p>
                        <p className="font-bold text-blue-700 tabular-nums mt-0.5">{fmt(ronda.inversion.montoInvertido)}</p>
                      </div>
                      <div className="rounded-lg bg-white border p-2.5">
                        <p className="text-gray-400">% participación</p>
                        <p className="font-bold text-blue-700 mt-0.5">{Number(ronda.inversion.porcentajeParticipacion).toFixed(2)}%</p>
                      </div>
                      <div className="rounded-lg bg-white border p-2.5">
                        <p className="text-gray-400">Intereses acumulados</p>
                        <p className="font-bold text-amber-700 tabular-nums mt-0.5">{fmt(ronda.inversion.interesesAcumulados)}</p>
                      </div>
                      <div className="rounded-lg bg-white border p-2.5">
                        <p className="text-gray-400">Total a recibir</p>
                        <p className="font-bold text-emerald-700 tabular-nums mt-0.5">{fmt(ronda.inversion.montoInvertido + ronda.inversion.interesesAcumulados)}</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Tu participación en el fondo</span>
                        <span>{fmt(ronda.inversion.montoInvertido)} / {fmt(ronda.inversion.fondoTotal)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500"
                          style={{ width: `${ronda.inversion.fondoTotal > 0 ? (ronda.inversion.montoInvertido / ronda.inversion.fondoTotal) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-center text-sm text-gray-400">
                    No tienes inversión en esta ronda
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── PRÉSTAMOS ── */}
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
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{p.ronda.nombre}</p>
                        <p className="text-xs text-gray-400">Interés mensual: {Number(p.tasaAnual)}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900 tabular-nums">{fmt(p.monto)}</p>
                        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                          p.estado === "ACTIVO" ? "bg-blue-100 text-blue-700" :
                          p.estado === "CANCELADO" ? "bg-emerald-100 text-emerald-700" :
                          "bg-rose-100 text-rose-700"}`}>
                          {p.estado}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Cuotas pagadas</span>
                        <span className="tabular-nums">{pagadas} / {total}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {p.estado === "ACTIVO" && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded bg-gray-50 p-2">
                          <p className="text-gray-400">Saldo pendiente</p>
                          <p className="font-bold text-gray-700 tabular-nums mt-0.5">{fmt(p.saldoActual)}</p>
                        </div>
                        <div className="rounded bg-orange-50 p-2">
                          <p className="text-orange-500">Próxima cuota</p>
                          <p className="font-bold text-orange-700 tabular-nums mt-0.5">
                            {pendientes[0] ? fmt(pendientes[0].cuota) : "-"}
                          </p>
                          {pendientes[0] && <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(pendientes[0].fechaVenc)}</p>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cuotas detalle */}
                  {pendientes.length > 0 && (
                    <div className="border-t">
                      <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Cuotas pendientes
                      </div>
                      <ul className="divide-y max-h-48 overflow-y-auto">
                        {pendientes.map(c => {
                          const vencida = new Date(c.fechaVenc) < new Date();
                          return (
                            <li key={c.id} className={`flex items-center justify-between px-4 py-2.5 text-xs ${vencida ? "bg-rose-50" : ""}`}>
                              <span className={vencida ? "text-rose-700 font-medium" : "text-gray-600"}>
                                Cuota #{c.numero} · {fmtDate(c.fechaVenc)}{vencida ? " ⚠️" : ""}
                              </span>
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

        {/* ── MOVIMIENTOS ── */}
        {tab === "movimientos" && (
          <div>
            {movimientos.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">Sin movimientos registrados.</div>
            ) : (
              <ul className="divide-y">
                {movimientos.map(m => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        tipoSigno[m.tipo] === "+" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}>
                        {tipoSigno[m.tipo]}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{tipoLabel[m.tipo] ?? m.tipo}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {m.ronda?.nombre && <>{m.ronda.nombre} · </>}{fmtDT(m.createdAt)}
                        </p>
                        {m.nota && <p className="text-xs text-gray-400 truncate">{m.nota}</p>}
                      </div>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums shrink-0 ${tipoColor[m.tipo] ?? "text-gray-700"}`}>
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
  );
}
