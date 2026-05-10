// app/socios/detalle/page.tsx
import Link from "next/link";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function fmtMoney(n: number | bigint | null | undefined) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
}
function fmtDate(iso: string | Date | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso as string);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function fmtDateTime(iso: string | Date | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso as string);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

async function getSocios() {
  return prisma.socio.findMany({
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    select: { id: true, numeroCuenta: true, nombres: true, apellidos: true, cedula: true, multas: true, saldoAhorros: true },
  });
}

async function getDetalleSocio(socioId: number) {
  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, cedula: true, edad: true, multas: true, saldoAhorros: true, fechaCreacion: true },
  });
  if (!socio) return null;

  const inversionActiva = await prisma.cuentaInversion.findFirst({
    where: { socioId, devuelto: false },
    include: { ronda: { select: { id: true, nombre: true, activa: true, fechaFin: true } } },
  }).catch(() => null);

  const movimientos = await prisma.movimientoCuenta.findMany({
    where: { socioId }, orderBy: { createdAt: "desc" }, take: 15,
    include: { ronda: { select: { nombre: true } } },
  }).catch(() => []);

  const prestamosActivos = await prisma.prestamo.findMany({
    where: { socioId, estado: "ACTIVO" },
    include: { ronda: { select: { nombre: true } }, cuotas: { where: { pagada: false }, orderBy: { fechaVenc: "asc" }, take: 1 } },
  });

  const rondas = await prisma.ronda.findMany({
    where: { OR: [{ participaciones: { some: { socioId } } }, { ahorros: { some: { socioId } } }, { aportes: { some: { socioId } } }] },
    orderBy: { fechaInicio: "desc" },
    select: { id: true, nombre: true, fechaInicio: true, fechaFin: true, activa: true, aportes: { where: { socioId }, select: { monto: true, multa: true } }, ahorros: { where: { socioId }, select: { monto: true } } },
  });

  const detallePorRonda = await Promise.all(rondas.map(async (r) => {
    const totalAportes = r.aportes.reduce((a, x) => a + Number(x.monto), 0);
    const totalMultas = r.aportes.reduce((a, x) => a + Number(x.multa), 0);
    const totalAhorros = r.ahorros.reduce((a, x) => a + Number(x.monto), 0);
    let interesGanado: number | null = null, montoInvertido: number | null = null, pctParticipacion: number | null = null;
    const inv = await prisma.cuentaInversion.findFirst({ where: { socioId, rondaId: r.id }, select: { montoInvertido: true, porcentajeParticipacion: true, interesesAcumulados: true } }).catch(() => null);
    if (inv) { montoInvertido = Number(inv.montoInvertido); pctParticipacion = Number(inv.porcentajeParticipacion); }
    if (!r.activa) { interesGanado = inv ? Number(inv.interesesAcumulados) : 0; }
    return { id: r.id, nombre: r.nombre, fechaInicio: r.fechaInicio, fechaFin: r.fechaFin, activa: r.activa, totalAportes, totalAhorros, totalMultas, interesGanado, montoInvertido, pctParticipacion };
  }));

  const totalGeneral = detallePorRonda.reduce((acc, d) => ({
    aportes: acc.aportes + d.totalAportes, ahorros: acc.ahorros + d.totalAhorros,
    multas: acc.multas + d.totalMultas, intereses: acc.intereses + (d.interesGanado ?? 0),
  }), { aportes: 0, ahorros: 0, multas: 0, intereses: 0 });

  return { socio, inversionActiva, movimientos, prestamosActivos, detallePorRonda, totalGeneral };
}

const TIPO_MOV: Record<string, { label: string; color: string; bg: string; signo: "+" | "-" }> = {
  AHORRO:     { label: "Ahorro",      color: "text-emerald-700", bg: "bg-emerald-100", signo: "+" },
  INVERSION:  { label: "Inversión",   color: "text-blue-700",    bg: "bg-blue-100",    signo: "-" },
  RETIRO:     { label: "Retiro",      color: "text-rose-700",    bg: "bg-rose-100",    signo: "-" },
  DEVOLUCION: { label: "Devolución",  color: "text-emerald-700", bg: "bg-emerald-100", signo: "+" },
  INTERES:    { label: "Interés",     color: "text-amber-700",   bg: "bg-amber-100",   signo: "+" },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ socioId?: string }> }) {
  const { socioId } = await searchParams;
  const socios = await getSocios();
  const selectedId = socioId ? Number.parseInt(socioId, 10) : undefined;
  const detalle = Number.isFinite(selectedId as number) ? await getDetalleSocio(selectedId as number) : null;
  const selectedSocio = socios.find(s => s.id === selectedId);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-7 8a7 7 0 0 1 14 0"/>
              </svg>
            </span>
            <div>
              <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Detalle por socio</h1>
              <p className="text-xs sm:text-sm text-gray-500">Cuentas, inversiones, movimientos y rondas.</p>
            </div>
          </div>
          {detalle && (
            <Link href={`/socios/retiros?socioId=${selectedId}`}
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-rose-700 shrink-0">
              ↑ Retiro
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">

        {/* Sidebar socios — se oculta en móvil si hay socio seleccionado */}
        <aside className={`lg:col-span-1 rounded-xl border bg-white shadow-sm overflow-hidden ${detalle ? "hidden lg:block" : "block"}`}>
          <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Socios <span className="text-gray-400 font-normal">({socios.length})</span></p>
            <Link href="/socios/nuevo" className="rounded-md border px-2 py-1 text-xs hover:bg-white">+ Nuevo</Link>
          </div>
          <ul className="divide-y max-h-[75vh] overflow-y-auto">
            {socios.map(s => {
              const isActive = s.id === selectedId;
              return (
                <li key={s.id}>
                  <Link href={`/socios/detalle?socioId=${s.id}`}
                    className={`flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50 transition-colors ${isActive ? "bg-violet-50 border-l-2 border-violet-500" : ""}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{s.apellidos}, {s.nombres}</p>
                      <p className="truncate text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-emerald-700">{fmtMoney(s.saldoAhorros ?? 0)}</p>
                      <p className="text-xs text-gray-400">ahorros</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Contenido principal */}
        <main className="lg:col-span-3 space-y-4">

          {/* Botón volver en móvil cuando hay socio seleccionado */}
          {detalle && (
            <div className="flex items-center gap-3 lg:hidden">
              <Link href="/socios/detalle" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                ← Ver todos
              </Link>
              <p className="text-sm font-medium text-gray-700 truncate">{detalle.socio?.nombres} {detalle.socio?.apellidos}</p>
            </div>
          )}

          {!detalle ? (
            <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-300 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-7 8a7 7 0 0 1 14 0"/>
                </svg>
              </div>
              <p className="text-sm text-gray-400">Selecciona un socio de la lista para ver su información</p>
            </div>
          ) : (
            <>
              {/* Cabecera socio */}
              <section className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 text-lg font-bold shrink-0">
                      {detalle.socio!.nombres[0]}{detalle.socio!.apellidos[0]}
                    </div>
                    <div>
                      <h2 className="text-base sm:text-xl font-bold text-gray-900">
                        {detalle.socio!.nombres} {detalle.socio!.apellidos}
                      </h2>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                        <span className="font-mono">{detalle.socio!.numeroCuenta}</span>
                        <span className="mx-1.5 text-gray-300">·</span>
                        CI {detalle.socio!.cedula}
                        <span className="mx-1.5 text-gray-300">·</span>
                        {detalle.socio!.edad} años
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Miembro desde {fmtDate(detalle.socio!.fechaCreacion)}</p>
                    </div>
                  </div>
                  <Link href={`/socios/retiros?socioId=${selectedId}`}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 shrink-0">
                    ↑ Retirar
                  </Link>
                </div>
              </section>

              {/* Dos cuentas */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Cuenta Ahorros */}
                <section className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 sm:p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                          <path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21ZM9 15.75h1.5V12H9v3.75Zm4.5 0H15V12h-1.5v3.75ZM12 6.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/>
                        </svg>
                      </span>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Cuenta Ahorros</p>
                        <p className="text-xs text-gray-500">Saldo libre · disponible</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Libre</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums">{fmtMoney(detalle.socio!.saldoAhorros)}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white/80 border border-emerald-100 p-2.5">
                      <p className="text-xs text-gray-400">Total ahorrado</p>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">{fmtMoney(detalle.totalGeneral.ahorros)}</p>
                    </div>
                    <div className="rounded-lg bg-white/80 border border-emerald-100 p-2.5">
                      <p className="text-xs text-gray-400">Total aportes</p>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">{fmtMoney(detalle.totalGeneral.aportes)}</p>
                    </div>
                  </div>
                  <Link href={`/socios/retiros?socioId=${selectedId}`}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
                    ↓ Registrar retiro
                  </Link>
                </section>

                {/* Cuenta Inversión */}
                <section className={`rounded-xl border-2 p-4 sm:p-5 shadow-sm ${detalle.inversionActiva ? "border-blue-200 bg-gradient-to-br from-blue-50 to-white" : "border-gray-200 bg-gray-50/50"}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-white shrink-0 ${detalle.inversionActiva ? "bg-blue-600" : "bg-gray-400"}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd"/>
                          <path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clipRule="evenodd"/>
                        </svg>
                      </span>
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-wider ${detalle.inversionActiva ? "text-blue-700" : "text-gray-400"}`}>Cuenta Inversión</p>
                        <p className="text-xs text-gray-500">{detalle.inversionActiva ? `Ronda ${detalle.inversionActiva.ronda.nombre} · bloqueado` : "Sin inversión activa"}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${detalle.inversionActiva ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
                      {detalle.inversionActiva ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  {detalle.inversionActiva ? (
                    <>
                      <p className="text-2xl sm:text-3xl font-bold text-blue-700 tabular-nums">{fmtMoney(detalle.inversionActiva.montoInvertido)}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-white/80 border border-blue-100 p-2.5">
                          <p className="text-xs text-gray-400">% participación</p>
                          <p className="text-sm font-bold text-blue-700 mt-0.5">{Number(detalle.inversionActiva.porcentajeParticipacion).toFixed(2)}%</p>
                        </div>
                        <div className="rounded-lg bg-white/80 border border-blue-100 p-2.5">
                          <p className="text-xs text-gray-400">Intereses acumulados</p>
                          <p className="text-sm font-bold text-amber-700 mt-0.5">{fmtMoney(detalle.inversionActiva.interesesAcumulados)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-100/70 px-3 py-2 text-xs text-blue-700">
                        <span>🔒 Bloqueado hasta cierre de ronda{detalle.inversionActiva.ronda.fechaFin && <> · {fmtDate(detalle.inversionActiva.ronda.fechaFin)}</>}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="text-sm text-gray-400">Sin inversión activa</p>
                      <p className="text-xs text-gray-300 mt-1">Se activa al iniciar una nueva ronda</p>
                    </div>
                  )}
                </section>
              </div>

              {/* Préstamos activos */}
              {detalle.prestamosActivos.length > 0 && (
                <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Préstamos activos</p>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{detalle.prestamosActivos.length}</span>
                  </div>
                  <ul className="divide-y">
                    {detalle.prestamosActivos.map(p => {
                      const next = p.cuotas[0] ?? null;
                      const overdue = next ? Math.max(0, Math.floor((Date.now() - new Date(next.fechaVenc).getTime()) / 86400000)) : 0;
                      return (
                        <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">Préstamo #{p.id} <span className="text-gray-400 font-normal">· {p.ronda.nombre}</span></p>
                            <p className="text-xs text-gray-500 mt-0.5">Saldo: <strong className="text-blue-700">{fmtMoney(p.saldoActual)}</strong>{next && <> · Próx. {fmtDate(next.fechaVenc)}</>}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {overdue > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">{overdue}d mora</span>}
                            <Link href={`/prestamos/${p.id}`} className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50">Ver</Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {/* Movimientos recientes */}
              <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Movimientos recientes</p>
                  <span className="text-xs text-gray-400">Últimos {detalle.movimientos.length}</span>
                </div>
                {detalle.movimientos.length === 0 ? (
                  <p className="p-6 text-center text-sm text-gray-400">No hay movimientos aún.</p>
                ) : (
                  <ul className="divide-y">
                    {detalle.movimientos.map(m => {
                      const t = TIPO_MOV[m.tipo] ?? { label: m.tipo, color: "text-gray-700", bg: "bg-gray-100", signo: "+" as const };
                      return (
                        <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50/70">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${t.bg} ${t.color}`}>{t.signo}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                <span className={t.color}>{t.label}</span>
                                {m.ronda && <span className="ml-2 text-xs text-gray-400">{m.ronda.nombre}</span>}
                              </p>
                              {m.nota && <p className="text-xs text-gray-400 truncate">{m.nota}</p>}
                              <p className="text-xs text-gray-300">{fmtDateTime(m.createdAt)}</p>
                            </div>
                          </div>
                          <p className={`tabular-nums font-semibold shrink-0 text-sm ${t.color}`}>{t.signo}{fmtMoney(m.monto)}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Historial rondas — tabla desktop / tarjetas móvil */}
              <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-700">Historial de rondas</p>
                </div>

                {/* Tabla desktop */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Ronda</th>
                        <th className="px-4 py-3 text-right">Aportes</th>
                        <th className="px-4 py-3 text-right">Ahorros</th>
                        <th className="px-4 py-3 text-right">Invertido</th>
                        <th className="px-4 py-3 text-right">% Part.</th>
                        <th className="px-4 py-3 text-right">Intereses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.detallePorRonda.map(r => (
                        <tr key={r.id} className="border-t hover:bg-gray-50/70">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{r.nombre}</p>
                            <p className="text-xs text-gray-400">{fmtDate(r.fechaInicio)} → {fmtDate(r.fechaFin ?? null)}</p>
                            {r.activa && <span className="mt-0.5 inline-flex rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">Activa</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(r.totalAportes)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(r.totalAhorros)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {r.montoInvertido != null ? <span className="font-medium text-blue-700">{fmtMoney(r.montoInvertido)}</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {r.pctParticipacion != null ? <span className="font-medium text-blue-700">{r.pctParticipacion.toFixed(2)}%</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {r.activa ? <span className="text-xs text-gray-400 italic">Al cierre</span> : <span className="font-semibold text-amber-700">{fmtMoney(r.interesGanado ?? 0)}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-gray-50">
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtMoney(detalle.totalGeneral.aportes)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtMoney(detalle.totalGeneral.ahorros)}</td>
                        <td colSpan={2} />
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-700">{fmtMoney(detalle.totalGeneral.intereses)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Tarjetas móvil rondas */}
                <ul className="sm:hidden divide-y">
                  {detalle.detallePorRonda.map(r => (
                    <li key={r.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900">{r.nombre}</p>
                          <p className="text-xs text-gray-400">{fmtDate(r.fechaInicio)} → {fmtDate(r.fechaFin ?? null)}</p>
                        </div>
                        {r.activa
                          ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Activa</span>
                          : <span className="text-sm font-semibold text-amber-700">{fmtMoney(r.interesGanado ?? 0)}</span>
                        }
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-xs">
                        <div className="rounded bg-gray-50 p-2 text-center">
                          <p className="text-gray-400">Aportes</p>
                          <p className="font-semibold text-gray-700 tabular-nums mt-0.5">{fmtMoney(r.totalAportes)}</p>
                        </div>
                        <div className="rounded bg-emerald-50 p-2 text-center">
                          <p className="text-emerald-400">Ahorros</p>
                          <p className="font-semibold text-emerald-700 tabular-nums mt-0.5">{fmtMoney(r.totalAhorros)}</p>
                        </div>
                        <div className="rounded bg-blue-50 p-2 text-center">
                          <p className="text-blue-400">Invertido</p>
                          <p className="font-semibold text-blue-700 tabular-nums mt-0.5">
                            {r.montoInvertido != null ? fmtMoney(r.montoInvertido) : "—"}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                  <li className="p-4 bg-gray-50">
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total</span>
                      <span className="text-amber-700">{fmtMoney(detalle.totalGeneral.intereses)} intereses</span>
                    </div>
                  </li>
                </ul>

                <div className="border-t bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-400">Los intereses se calculan al cerrar la ronda según % de participación.</p>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
