// app/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────
type RondaInfo = {
  id: number; nombre: string; semanaActual: number;
  montoAporte: string; fechaInicio: string; intervaloDiasCobro: number;
  participaciones: { orden: number; socio: { nombres: string; apellidos: string } }[];
};

type DashStats = {
  totalSocios: number;
  totalAhorros: number;
  saldoPrestamosActual: number;
  numPrestamosActivos: number;
  depositosMes: number;
  retirosMes: number;
  sociosRondaActual: number;
  sociosRondaAnterior: number;
  ahorrosRondaActual: number;
  ahorrosRondaAnterior: number;
  diff: {
    socios: { abs: number; pct: number };
    ahorros: { abs: number; pct: number };
    prestamos: { abs: number; pct: number };
    depositos: { abs: number; pct: number };
    retiros: { abs: number; pct: number };
  };
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));

const fmtPct = (n: number) => {
  const abs = Math.abs(n);
  return `${abs.toFixed(1)}%`;
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);

// ── Sparkline ──────────────────────────────────────────────────────────────
function Sparkline({ color, up }: { color: string; up: boolean }) {
  const pts = up
    ? [0, 5, 3, 9, 5, 12, 8, 16, 10, 18, 14, 20, 16, 24, 20, 26, 24, 28, 26, 30]
    : [30, 27, 28, 23, 26, 19, 22, 16, 20, 13, 17, 10, 14, 8, 10, 5, 7, 3, 5, 0];
  const W = 88, H = 34;
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W);
  const ys = pts.map(p => H - (p / 30) * H);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${d} L${W},${H} L0,${H} Z`;
  const uid = color.replace("#", "g");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible mt-1">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${uid})`}/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="3.5" fill={color}/>
    </svg>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, pct, absVal, isAmount, color, sparkColor, icon }: {
  label: string; value: string; pct: number; absVal: number;
  isAmount: boolean; color: string; sparkColor: string; icon: React.ReactNode;
}) {
  const up = pct >= 0;
  const diffStr = isAmount
    ? `${up ? "+" : ""}${fmt(absVal)}`
    : `${up ? "+" : ""}${absVal}`;
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-white shrink-0" style={{ backgroundColor: color }}>
            {icon}
          </span>
          <span className="text-xs font-medium text-gray-500 leading-tight">{label}</span>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
          {up ? "↑" : "↓"} {fmtPct(pct)}
        </span>
      </div>
      <div className="mt-2">
        <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          <span className={up ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>{diffStr}</span>
          {" "}vs. ronda anterior
        </p>
      </div>
      <Sparkline color={sparkColor} up={up} />
    </div>
  );
}

// ── Quick Access Modules ───────────────────────────────────────────────────
const MODULES = [
  { name: "Socios", desc: "Gestiona los miembros", path: "/socios", color: "#6366f1",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd"/></svg> },
  { name: "Ronda actual", desc: "Cobros y ahorros", path: "/rondas/actual", color: "#10b981",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd"/></svg> },
  { name: "Nueva ronda", desc: "Crear nueva ronda", path: "/rondas/registro_ronda", color: "#14b8a6",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd"/></svg> },
  { name: "Préstamos", desc: "Solicitudes y pagos", path: "/prestamos/solicitud", color: "#f97316",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75Z" clipRule="evenodd"/></svg> },
  { name: "Depósitos", desc: "Ahorros libres", path: "/ahorros/registro", color: "#3b82f6",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z"/></svg> },
  { name: "Retiros", desc: "Retirar saldo", path: "/socios/retiros", color: "#ef4444",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-.53 14.03a.75.75 0 0 0 1.06 0l3-3a.75.75 0 1 0-1.06-1.06l-1.72 1.72V8.25a.75.75 0 0 0-1.5 0v5.69l-1.72-1.72a.75.75 0 0 0-1.06 1.06l3 3Z" clipRule="evenodd"/></svg> },
  { name: "Historial", desc: "Rondas anteriores", path: "/rondas/historial", color: "#64748b",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M1.5 5.625c0-1.036.84-1.875 1.875-1.875h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 18.375V5.625ZM21 9.375A.375.375 0 0 0 20.625 9h-7.5a.375.375 0 0 0-.375.375v1.5c0 .207.168.375.375.375h7.5A.375.375 0 0 0 21 10.875v-1.5Z" clipRule="evenodd"/></svg> },
  { name: "Reportes", desc: "Configurar reportes", path: "/reportes/config", color: "#8b5cf6",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd"/><path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clipRule="evenodd"/></svg> },
];

// ── Dashboard ──────────────────────────────────────────────────────────────
export default function HomeDashboard() {
  const [ronda, setRonda] = useState<RondaInfo | null>(null);
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const hora = now.getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  useEffect(() => {
    async function cargar() {
      try {
        const [rRes, sRes] = await Promise.all([
          fetch("/api/rondas", { cache: "no-store" }),
          fetch("/api/dashboard/stats", { cache: "no-store" }),
        ]);
        if (rRes.status !== 204) setRonda(await rRes.json());
        if (sRes.ok) setStats(await sRes.json());
      } catch { /* silencioso */ }
      finally { setLoading(false); }
    }
    cargar();
  }, []);

  const participantes = ronda?.participaciones
    ? [...ronda.participaciones].sort((a, b) => a.orden - b.orden) : [];
  const totalPart = participantes.length;
  const semActual = ronda?.semanaActual ?? 1;
  const idx = totalPart > 0 ? ((semActual - 1) % totalPart + totalPart) % totalPart : 0;
  const cobraAhora = participantes[idx];
  const cobraSig = totalPart > 0 ? participantes[(idx + 1) % totalPart] : null;
  const progreso = totalPart > 0 ? Math.min(100, ((semActual - 1) / totalPart) * 100) : 0;

  return (
    <div className="space-y-5 pb-6">

      {/* Saludo */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{saludo}, 👋</h1>
          <p className="text-xs text-gray-400 capitalize mt-0.5">{fmtDate(now)}</p>
        </div>
        {ronda && (
          <Link href="/rondas/actual"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm">
            Ir a ronda actual →
          </Link>
        )}
      </div>

      {/* ── Hero ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 border border-emerald-100 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-0 p-5 sm:p-6">

          {/* Izquierda */}
          <div className="flex-1 min-w-0">
            {ronda ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                    Ronda activa
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                    Sem. {semActual}/{totalPart}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{ronda.nombre}</h2>
                {cobraAhora && (
                  <p className="text-sm text-gray-500 mb-3">
                    Cobra esta semana:{" "}
                    <span className="font-semibold text-gray-800">
                      {cobraAhora.socio.nombres} {cobraAhora.socio.apellidos}
                    </span>
                  </p>
                )}
                {/* Barra progreso */}
                <div className="w-full sm:w-72 mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>Progreso de la ronda</span>
                    <span className="font-semibold">{Math.round(progreso)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-emerald-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${progreso}%` }}/>
                  </div>
                </div>
                {/* Mini KPIs en hero */}
                <div className="flex flex-wrap gap-2.5">
                  <div className="rounded-xl bg-white border border-gray-100 px-3.5 py-2.5 shadow-sm flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#6366f1" className="h-5 w-5">
                        <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd"/>
                      </svg>
                    </span>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Total socios</p>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <p className="text-xl font-bold text-gray-900">{stats?.totalSocios ?? "—"}</p>
                        {stats && stats.diff.socios.abs !== 0 && (
                          <span className={`text-xs font-bold ${stats.diff.socios.abs >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {stats.diff.socios.abs >= 0 ? "↑" : "↓"} {Math.abs(stats.diff.socios.abs)}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">vs. ronda anterior</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white border border-gray-100 px-3.5 py-2.5 shadow-sm flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ec4899" className="h-5 w-5">
                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"/>
                      </svg>
                    </span>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Total ahorros</p>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <p className="text-xl font-bold text-gray-900">{stats ? fmt(stats.totalAhorros) : "—"}</p>
                        {stats && stats.diff.ahorros.pct !== 0 && (
                          <span className={`text-xs font-bold ${stats.diff.ahorros.pct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {stats.diff.ahorros.pct >= 0 ? "↑" : "↓"} {fmtPct(stats.diff.ahorros.pct)}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">vs. ronda anterior</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                  className="h-10 w-10 text-emerald-200 mb-3">
                  <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd"/>
                </svg>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">No hay ronda activa</h2>
                <p className="text-sm text-gray-500 mb-4">Crea una nueva ronda para comenzar a gestionar los cobros.</p>
                <div className="flex gap-3 flex-wrap mb-4">
                  <Link href="/rondas/registro_ronda"
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 shadow-sm">
                    + Crear nueva ronda
                  </Link>
                  <Link href="/rondas/historial"
                    className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    Ver historial
                  </Link>
                </div>
                {stats && (
                  <div className="flex flex-wrap gap-2.5">
                    <div className="rounded-xl bg-white border border-gray-100 px-3.5 py-2.5 shadow-sm flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#6366f1" className="h-5 w-5">
                          <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd"/>
                        </svg>
                      </span>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total socios</p>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <p className="text-xl font-bold text-gray-900">{stats.totalSocios}</p>
                          {stats.diff.socios.abs !== 0 && (
                            <span className="text-xs font-bold text-emerald-600">↑ {Math.abs(stats.diff.socios.abs)}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400">vs. ronda anterior</p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white border border-gray-100 px-3.5 py-2.5 shadow-sm flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ec4899" className="h-5 w-5">
                          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"/>
                        </svg>
                      </span>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total ahorros</p>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <p className="text-xl font-bold text-gray-900">{fmt(stats.totalAhorros)}</p>
                          {stats.diff.ahorros.pct !== 0 && (
                            <span className={`text-xs font-bold ${stats.diff.ahorros.pct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {stats.diff.ahorros.pct >= 0 ? "↑" : "↓"} {fmtPct(stats.diff.ahorros.pct)}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400">vs. ronda anterior</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Ilustración mejorada */}
          <div className="hidden sm:block shrink-0 w-60 h-48 relative">
            <svg viewBox="0 0 240 190" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              {/* Fondo blob suave */}
              <ellipse cx="125" cy="165" rx="95" ry="18" fill="#bbf7d0" opacity="0.5"/>
              <ellipse cx="125" cy="100" rx="88" ry="78" fill="#f0fdf4" opacity="0.8"/>

              {/* Planta derecha */}
              <path d="M195 160 Q205 130 220 120" stroke="#86efac" strokeWidth="3" fill="none" strokeLinecap="round"/>
              <ellipse cx="216" cy="118" rx="12" ry="8" fill="#4ade80" opacity="0.7" transform="rotate(-30 216 118)"/>
              <path d="M195 160 Q210 145 225 148" stroke="#86efac" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
              <ellipse cx="222" cy="146" rx="10" ry="7" fill="#4ade80" opacity="0.6" transform="rotate(20 222 146)"/>
              <path d="M195 160 Q200 140 190 128" stroke="#86efac" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <ellipse cx="190" cy="126" rx="9" ry="6" fill="#4ade80" opacity="0.5" transform="rotate(-15 190 126)"/>

              {/* Planta izquierda pequeña */}
              <path d="M30 160 Q22 140 28 125" stroke="#86efac" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <ellipse cx="26" cy="123" rx="8" ry="6" fill="#4ade80" opacity="0.5" transform="rotate(20 26 123)"/>
              <path d="M30 160 Q18 148 15 138" stroke="#86efac" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <ellipse cx="14" cy="136" rx="7" ry="5" fill="#4ade80" opacity="0.4" transform="rotate(-10 14 136)"/>

              {/* Mesa */}
              <rect x="45" y="140" width="160" height="6" rx="3" fill="#a7f3d0"/>
              <rect x="60" y="146" width="8" height="22" rx="2" fill="#6ee7b7"/>
              <rect x="182" y="146" width="8" height="22" rx="2" fill="#6ee7b7"/>

              {/* Laptop base */}
              <rect x="58" y="105" width="120" height="38" rx="6" fill="#ecfdf5" stroke="#86efac" strokeWidth="1.5"/>
              {/* Bisagra */}
              <rect x="58" y="140" width="120" height="5" rx="2.5" fill="#a7f3d0"/>
              {/* Trackpad */}
              <rect x="103" y="147" width="30" height="20" rx="4" fill="#d1fae5" stroke="#a7f3d0" strokeWidth="1"/>
              {/* Pantalla contenido */}
              <rect x="65" y="111" width="106" height="26" rx="3" fill="#d1fae5"/>
              {/* Barra superior laptop */}
              <rect x="68" y="113" width="35" height="3" rx="1.5" fill="#10b981"/>
              <rect x="68" y="118" width="50" height="2" rx="1" fill="#a7f3d0"/>
              {/* Chart en pantalla */}
              <rect x="115" y="124" width="5" height="7" rx="1" fill="#10b981" opacity="0.6"/>
              <rect x="122" y="120" width="5" height="11" rx="1" fill="#10b981" opacity="0.8"/>
              <rect x="129" y="116" width="5" height="15" rx="1" fill="#10b981"/>
              <rect x="136" y="118" width="5" height="13" rx="1" fill="#10b981" opacity="0.7"/>
              <rect x="143" y="113" width="5" height="18" rx="1" fill="#059669"/>
              {/* Línea chart */}
              <polyline points="117,124 124,120 131,116 138,119 145,113 152,115" stroke="#059669" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

              {/* Cuerpo persona */}
              <path d="M95 105 Q80 118 75 140 L155 140 Q150 118 135 105 Z" fill="#10b981"/>
              {/* Cuello */}
              <rect x="109" y="95" width="12" height="14" rx="3" fill="#fde68a"/>
              {/* Cabeza */}
              <circle cx="115" cy="82" r="18" fill="#fde68a"/>
              {/* Cabello - parte superior */}
              <path d="M97 80 Q99 60 115 58 Q131 60 133 80" fill="#1a1a2e"/>
              {/* Cabello lateral izquierdo - cola larga */}
              <path d="M97 80 Q88 95 90 115 Q91 120 87 118 Q84 100 93 83 Q95 80 97 80Z" fill="#1a1a2e"/>
              {/* Cabello lateral derecho */}
              <path d="M133 80 Q136 90 133 100" stroke="#1a1a2e" strokeWidth="5" strokeLinecap="round" fill="none"/>
              {/* Ojo izquierdo */}
              <ellipse cx="109" cy="84" rx="2.5" ry="2.5" fill="#1a1a2e"/>
              <circle cx="110" cy="83" r="0.8" fill="white"/>
              {/* Ojo derecho */}
              <ellipse cx="121" cy="84" rx="2.5" ry="2.5" fill="#1a1a2e"/>
              <circle cx="122" cy="83" r="0.8" fill="white"/>
              {/* Sonrisa */}
              <path d="M110 90 Q115 94 120 90" stroke="#e67e22" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              {/* Mejilla */}
              <circle cx="106" cy="89" r="3" fill="#fca5a5" opacity="0.5"/>
              <circle cx="124" cy="89" r="3" fill="#fca5a5" opacity="0.5"/>
              {/* Brazo izquierdo */}
              <path d="M82 118 Q70 128 65 138" stroke="#10b981" strokeWidth="8" strokeLinecap="round"/>
              <ellipse cx="64" cy="139" rx="5" ry="4" fill="#fde68a"/>
              {/* Brazo derecho - sobre laptop */}
              <path d="M148 118 Q158 128 163 138" stroke="#10b981" strokeWidth="8" strokeLinecap="round"/>
              <ellipse cx="164" cy="139" rx="5" ry="4" fill="#fde68a"/>

              {/* Burbuja chart icon */}
              <circle cx="82" cy="58" r="18" fill="white" filter="url(#shadow)"/>
              <circle cx="82" cy="58" r="18" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
              <rect x="72" y="63" width="4" height="6" rx="1" fill="#10b981" opacity="0.7"/>
              <rect x="78" y="59" width="4" height="10" rx="1" fill="#10b981" opacity="0.9"/>
              <rect x="84" y="55" width="4" height="14" rx="1" fill="#059669"/>
              <rect x="90" y="57" width="4" height="12" rx="1" fill="#10b981" opacity="0.8"/>

              {/* Burbuja $ icon */}
              <circle cx="185" cy="52" r="16" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
              <text x="185" y="58" textAnchor="middle" fontSize="18" fill="#059669" fontWeight="bold">$</text>

              {/* Burbuja personas */}
              <circle cx="48" cy="85" r="14" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
              <circle cx="44" cy="82" r="4" fill="#6366f1"/>
              <path d="M38 92 Q44 88 50 92" stroke="#6366f1" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <circle cx="52" cy="82" r="3.5" fill="#818cf8" opacity="0.7"/>
              <path d="M46 92 Q52 89 58 92" stroke="#818cf8" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Accesos rápidos ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {MODULES.map(m => (
            <Link key={m.path} href={m.path}
              className="group flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: m.color }}>
                {m.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{m.name}</p>
                <p className="text-[10px] text-gray-400 truncate mt-0.5">{m.desc}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                className="h-3 w-3 text-gray-300 group-hover:text-gray-400 shrink-0">
                <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd"/>
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-gray-100"/>)}
        </div>
      ) : stats ? (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Resumen general</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
              label="Ahorros totales"
              value={fmt(stats.totalAhorros)}
              pct={stats.diff.ahorros.pct}
              absVal={stats.diff.ahorros.abs}
              isAmount={true}
              color="#10b981"
              sparkColor="#10b981"
              icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm.75 6a.75.75 0 0 0-1.5 0v.816a3.836 3.836 0 0 0-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 0 1-.921-.421l-.879-.66a.75.75 0 0 0-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 0 0 1.5 0v-.81a4.124 4.124 0 0 0 1.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 0 0-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 0 0 .933-1.175l-.415-.33a3.836 3.836 0 0 0-1.719-.755V8.25Z" clipRule="evenodd"/></svg>}
            />
            <KpiCard
              label="Préstamos activos"
              value={fmt(stats.saldoPrestamosActual)}
              pct={stats.diff.prestamos.pct}
              absVal={stats.diff.prestamos.abs}
              isAmount={true}
              color="#f97316"
              sparkColor="#f97316"
              icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75Z" clipRule="evenodd"/></svg>}
            />
            <KpiCard
              label="Depósitos (mes)"
              value={fmt(stats.depositosMes)}
              pct={stats.diff.depositos.pct}
              absVal={stats.diff.depositos.abs}
              isAmount={true}
              color="#3b82f6"
              sparkColor="#3b82f6"
              icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z"/></svg>}
            />
            <KpiCard
              label="Retiros (mes)"
              value={fmt(stats.retirosMes)}
              pct={stats.diff.retiros.pct}
              absVal={stats.diff.retiros.abs}
              isAmount={true}
              color="#ef4444"
              sparkColor="#ef4444"
              icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-.53 14.03a.75.75 0 0 0 1.06 0l3-3a.75.75 0 1 0-1.06-1.06l-1.72 1.72V8.25a.75.75 0 0 0-1.5 0v5.69l-1.72-1.72a.75.75 0 0 0-1.06 1.06l3 3Z" clipRule="evenodd"/></svg>}
            />
            <KpiCard
              label="Socios activos"
              value={String(stats.totalSocios)}
              pct={stats.diff.socios.pct}
              absVal={stats.diff.socios.abs}
              isAmount={false}
              color="#6366f1"
              sparkColor="#6366f1"
              icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd"/></svg>}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
