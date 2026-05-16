// app/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type RondaInfo = {
  id: number; nombre: string; semanaActual: number;
  montoAporte: string; fechaInicio: string; intervaloDiasCobro: number;
  participaciones: { orden: number; socio: { nombres: string; apellidos: string } }[];
};
type Stats = { totalSocios: number; totalAhorros: number };

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "—" :
    new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
};

const MODULES = [
  { name: "Socios", desc: "Gestiona los miembros", path: "/socios", color: "bg-indigo-500",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd"/></svg> },
  { name: "Ronda actual", desc: "Cobros y ahorros", path: "/rondas/actual", color: "bg-emerald-500",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd"/></svg> },
  { name: "Nueva ronda", desc: "Crear nueva ronda", path: "/rondas/registro_ronda", color: "bg-teal-500",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd"/></svg> },
  { name: "Préstamos", desc: "Solicitudes y pagos", path: "/prestamos/solicitud", color: "bg-orange-500",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z" clipRule="evenodd"/></svg> },
  { name: "Depósitos", desc: "Ahorros libres", path: "/ahorros/registro", color: "bg-blue-500",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM2.273 8.625A4.483 4.483 0 0 1 5.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 6H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z"/></svg> },
  { name: "Retiros", desc: "Retirar saldo", path: "/socios/retiros", color: "bg-rose-500",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-.53 14.03a.75.75 0 0 0 1.06 0l3-3a.75.75 0 1 0-1.06-1.06l-1.72 1.72V8.25a.75.75 0 0 0-1.5 0v5.69l-1.72-1.72a.75.75 0 0 0-1.06 1.06l3 3Z" clipRule="evenodd"/></svg> },
  { name: "Historial", desc: "Rondas anteriores", path: "/rondas/historial", color: "bg-slate-500",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M1.5 5.625c0-1.036.84-1.875 1.875-1.875h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 18.375V5.625ZM21 9.375A.375.375 0 0 0 20.625 9h-7.5a.375.375 0 0 0-.375.375v1.5c0 .207.168.375.375.375h7.5A.375.375 0 0 0 21 10.875v-1.5Z" clipRule="evenodd"/></svg> },
  { name: "Reportes", desc: "Configurar reportes", path: "/reportes/config", color: "bg-violet-500",
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd"/><path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clipRule="evenodd"/></svg> },
];

export default function HomeDashboard() {
  const [ronda, setRonda] = useState<RondaInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const hora = now.getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  useEffect(() => {
    async function cargar() {
      try {
        const [rRes, sRes] = await Promise.all([
          fetch("/api/rondas", { cache: "no-store" }),
          fetch("/api/socios", { cache: "no-store" }),
        ]);

        if (rRes.status !== 204) setRonda(await rRes.json());

        const socios = await sRes.json();
        if (Array.isArray(socios)) {
          setStats({
            totalSocios: socios.length,
            totalAhorros: socios.reduce((a: number, s: any) => a + Number(s.saldoAhorros ?? 0), 0),
          });
        }
      } catch { /* silencioso */ }
      finally { setLoading(false); }
    }
    cargar();
  }, []);

  const participantes = ronda?.participaciones
    ? [...ronda.participaciones].sort((a, b) => a.orden - b.orden)
    : [];
  const totalPart = participantes.length;
  const semActual = ronda?.semanaActual ?? 1;
  const idx = totalPart > 0 ? ((semActual - 1) % totalPart + totalPart) % totalPart : 0;
  const cobraAhora = participantes[idx];
  const cobraSig = totalPart > 0 ? participantes[(idx + 1) % totalPart] : null;
  const intervalo = ronda?.intervaloDiasCobro ?? 7;
  const fechaSem = ronda?.fechaInicio ? fmtDate(addDaysISO(ronda.fechaInicio, (semActual - 1) * intervalo)) : null;
  const fechaFin = ronda?.fechaInicio && totalPart > 0 ? fmtDate(addDaysISO(ronda.fechaInicio, (totalPart - 1) * intervalo)) : null;
  const progreso = totalPart > 0 ? Math.min(100, ((semActual - 1) / totalPart) * 100) : 0;

  return (
    <div className="space-y-5">

      {/* Saludo */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{saludo} 👋</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)}
          </p>
        </div>
        {ronda && (
          <Link href="/rondas/actual"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700">
            Ir a ronda actual →
          </Link>
        )}
      </div>

      {/* Ronda activa */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      ) : ronda ? (
        <>
          {/* Hero de la ronda */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 p-5 sm:p-6 text-white shadow-lg overflow-hidden relative">
            <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-white/5 -translate-y-10 translate-x-10" />
            <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-white/5 translate-y-8 -translate-x-6" />
            <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
                    Ronda activa
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">
                    Semana {semActual}/{totalPart}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold">{ronda.nombre}</h2>
                {fechaSem && <p className="text-emerald-100 text-sm mt-0.5">{fechaSem}</p>}

                {/* Progreso */}
                <div className="mt-4 w-full sm:w-80">
                  <div className="flex justify-between text-xs text-emerald-200 mb-1.5">
                    <span>Progreso</span>
                    <span>{Math.round(progreso)}% completado</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${progreso}%` }} />
                  </div>
                </div>
              </div>

              {/* Quién cobra */}
              <div className="flex flex-row sm:flex-col gap-2 sm:min-w-[160px]">
                {cobraAhora && (
                  <div className="flex-1 sm:flex-none rounded-xl bg-white/15 backdrop-blur-sm px-3 py-2.5 border border-white/20">
                    <p className="text-[10px] font-medium text-emerald-200 uppercase tracking-wide">Cobra esta semana</p>
                    <p className="text-sm font-bold mt-0.5 leading-tight">
                      {cobraAhora.socio.nombres}<br/>{cobraAhora.socio.apellidos}
                    </p>
                  </div>
                )}
                {cobraSig && (
                  <div className="flex-1 sm:flex-none rounded-xl bg-white/10 px-3 py-2.5 border border-white/10">
                    <p className="text-[10px] font-medium text-emerald-300 uppercase tracking-wide">Siguiente</p>
                    <p className="text-xs font-semibold mt-0.5 text-emerald-100 leading-tight">
                      {cobraSig.socio.nombres} {cobraSig.socio.apellidos}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Socios en ronda", value: String(totalPart), sub: "participantes activos", color: "text-indigo-600", bg: "bg-indigo-50", emoji: "👥" },
              { label: "Aporte semanal", value: fmt(Number(ronda.montoAporte)), sub: "por participante", color: "text-emerald-700", bg: "bg-emerald-50", emoji: "💵" },
              { label: "Total socios", value: String(stats?.totalSocios ?? "—"), sub: "en el sistema", color: "text-blue-600", bg: "bg-blue-50", emoji: "🏦" },
              { label: "Total ahorros", value: fmt(stats?.totalAhorros ?? 0), sub: "saldo acumulado", color: "text-amber-700", bg: "bg-amber-50", emoji: "💰" },
            ].map(k => (
              <div key={k.label} className={`rounded-xl border bg-white p-4 shadow-sm`}>
                <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${k.bg} text-lg mb-2`}>{k.emoji}</div>
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-xl font-bold tabular-nums mt-0.5 ${k.color}`}>{k.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Fechas info */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Inicio de ronda", value: fmtDate(ronda.fechaInicio) },
              { label: "Semana actual", value: fechaSem ?? "—" },
              { label: "Fin estimado", value: fechaFin ?? "—" },
            ].map(f => (
              <div key={f.label} className="rounded-xl border bg-white p-3.5 shadow-sm text-center">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{f.label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-1">{f.value}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-gray-300">
              <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd"/>
            </svg>
          </div>
          <p className="text-gray-500 text-sm mb-1 font-medium">No hay ronda activa</p>
          <p className="text-gray-400 text-xs mb-5">Crea una nueva ronda para comenzar a gestionar los cobros.</p>
          <div className="flex justify-center gap-3">
            <Link href="/rondas/registro_ronda"
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
              + Crear nueva ronda
            </Link>
            <Link href="/rondas/historial"
              className="rounded-xl border px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
              Ver historial
            </Link>
          </div>
          {/* KPIs socios aunque no haya ronda */}
          {stats && (
            <div className="mt-6 grid grid-cols-2 gap-3 max-w-xs mx-auto">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Total socios</p>
                <p className="text-lg font-bold text-gray-700">{stats.totalSocios}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Total ahorros</p>
                <p className="text-lg font-bold text-emerald-700">{fmt(stats.totalAhorros)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accesos rápidos */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {MODULES.map(m => (
            <Link key={m.path} href={m.path}
              className="group flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${m.color} text-white`}>
                {m.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{m.name}</p>
                <p className="text-[10px] text-gray-400 truncate mt-0.5">{m.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
