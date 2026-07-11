// app/socios/detalle/page.tsx
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import { SocioSearch, MultasSection } from "./components";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const fmt = (n: number | bigint | null | undefined) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (iso: string | Date | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso as string);
  return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

async function getSocios() {
  return prisma.socio.findMany({
    where: { activo: true },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    select: { id: true, numeroCuenta: true, nombres: true, apellidos: true, cedula: true, saldoAhorros: true },
  });
}

async function getDetalleSocio(socioId: number) {
  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, cedula: true, edad: true, saldoAhorros: true, fechaCreacion: true },
  });
  if (!socio) return null;

  const [inversionActiva, movimientos, prestamos, prestamosExpress, detallePorRonda] = await Promise.all([
    prisma.cuentaInversion.findFirst({
      where: { socioId, devuelto: false },
      include: { ronda: { select: { id: true, nombre: true, activa: true } } },
    }).catch(() => null),

    prisma.movimientoCuenta.findMany({
      where: { socioId }, orderBy: { createdAt: "desc" }, take: 20,
      include: { ronda: { select: { nombre: true } } },
    }).catch(() => []),

    prisma.prestamo.findMany({
      where: { socioId },
      include: {
        ronda: { select: { nombre: true } },
        cuotas: { orderBy: { numero: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => []),

    (prisma as any).prestamoExpress.findMany({
      where: { socioId },
      include: { ronda: { select: { nombre: true } } },
      orderBy: { createdAt: "desc" },
    }).catch(() => []),

    prisma.ronda.findMany({
      where: { OR: [{ participaciones: { some: { socioId } } }] },
      orderBy: { fechaInicio: "desc" },
      select: {
        id: true, nombre: true, fechaInicio: true, fechaFin: true, activa: true, semanaActual: true,
        aportes: { where: { socioId }, select: { monto: true, multa: true, semana: true } },
        ahorros: { where: { socioId }, select: { monto: true, semana: true } },
      },
    }).then(rondas => Promise.all(rondas.map(async r => {
      const inv = await prisma.cuentaInversion.findFirst({
        where: { socioId, rondaId: r.id }, select: { montoInvertido: true, porcentajeParticipacion: true, interesesAcumulados: true },
      }).catch(() => null);
      return {
        id: r.id, nombre: r.nombre, fechaInicio: r.fechaInicio, fechaFin: r.fechaFin, activa: r.activa, semanaActual: r.semanaActual,
        totalAportes: r.aportes.reduce((s, a) => s + Number(a.monto), 0),
        totalAhorros: r.ahorros.reduce((s, a) => s + Number(a.monto), 0),
        semanaActual2: r.semanaActual,
        montoInvertido: inv ? Number(inv.montoInvertido) : null,
        pctParticipacion: inv ? Number(inv.porcentajeParticipacion) : null,
        interesesGanados: inv ? Number(inv.interesesAcumulados) : 0,
      };
    }))).catch(() => []),
  ]);

  const totalGeneral = detallePorRonda.reduce((acc, r) => ({
    aportes: acc.aportes + r.totalAportes,
    ahorros: acc.ahorros + r.totalAhorros,
    intereses: acc.intereses + r.interesesGanados,
  }), { aportes: 0, ahorros: 0, intereses: 0 });

  return { socio, inversionActiva, movimientos, prestamos, prestamosExpress, detallePorRonda, totalGeneral };
}

const TIPO_MOV: Record<string, { label: string; color: string; bg: string; signo: "+" | "−" }> = {
  AHORRO:     { label: "Ahorro",      color: "text-emerald-700", bg: "bg-emerald-100", signo: "+" },
  INVERSION:  { label: "Inversión",   color: "text-blue-700",    bg: "bg-blue-100",    signo: "−" },
  RETIRO:     { label: "Retiro",      color: "text-rose-700",    bg: "bg-rose-100",    signo: "−" },
  DEVOLUCION: { label: "Devolución",  color: "text-emerald-700", bg: "bg-emerald-100", signo: "+" },
  INTERES:    { label: "Interés",     color: "text-amber-700",   bg: "bg-amber-100",   signo: "+" },
};

function cn(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

export default async function Page({ searchParams }: { searchParams: Promise<{ socioId?: string }> }) {
  const { socioId } = await searchParams;
  const socios = await getSocios();
  const selectedId = socioId ? Number.parseInt(socioId, 10) : undefined;
  const detalle = Number.isFinite(selectedId as number) ? await getDetalleSocio(selectedId as number) : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd"/>
            </svg>
          </span>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Detalle por socio</h1>
            <p className="text-xs text-gray-500">Ahorros, inversiones, préstamos, express y multas</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">

        {/* Sidebar socios */}
        <aside className={cn("lg:col-span-1 rounded-xl border bg-white shadow-sm overflow-hidden", detalle ? "hidden lg:block" : "block")}>
          <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Socios <span className="text-gray-400 font-normal">({socios.length})</span></p>
          </div>
          <div className="border-b px-3 py-2">
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none">
                <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd"/>
              </svg>
              <SocioSearch socios={socios} selectedId={selectedId} />
            </div>
          </div>
          <ul className="divide-y max-h-[65vh] overflow-y-auto" id="socios-list">
            {socios.map(s => {
              const isActive = s.id === selectedId;
              return (
                <li key={s.id} data-search={`${s.apellidos} ${s.nombres} ${s.numeroCuenta} ${s.cedula}`.toLowerCase()}>
                  <Link href={`/socios/detalle?socioId=${s.id}`}
                    className={cn("flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50 transition-colors", isActive ? "bg-violet-50 border-l-2 border-violet-500" : "")}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{s.apellidos}, {s.nombres}</p>
                      <p className="truncate text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                    </div>
                    <p className="text-xs font-semibold text-emerald-700 shrink-0">{fmt(s.saldoAhorros)}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Contenido */}
        <main className="lg:col-span-3 space-y-4">
          {detalle && (
            <div className="flex items-center gap-3 lg:hidden">
              <Link href="/socios/detalle" className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">← Lista</Link>
              <p className="text-sm font-medium text-gray-700 truncate">{detalle.socio?.nombres} {detalle.socio?.apellidos}</p>
            </div>
          )}

          {!detalle ? (
            <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-300 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd"/>
                </svg>
              </div>
              <p className="text-sm text-gray-400">Selecciona un socio para ver su información completa</p>
            </div>
          ) : (
            <>
              {/* ── Perfil ── */}
              <section className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 text-lg font-bold shrink-0">
                      {detalle.socio!.nombres[0]}{detalle.socio!.apellidos[0]}
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-gray-900">{detalle.socio!.nombres} {detalle.socio!.apellidos}</h2>
                      <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
                        <span className="font-mono">{detalle.socio!.numeroCuenta}</span>
                        <span className="text-gray-300">·</span>
                        <span>CI {detalle.socio!.cedula}</span>
                        <span className="text-gray-300">·</span>
                        <span>{detalle.socio!.edad} años</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Miembro desde {fmtDate(detalle.socio!.fechaCreacion)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/ahorros/registro?socioId=${selectedId}`}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                      + Depósito
                    </Link>
                    <Link href={`/socios/retiros?socioId=${selectedId}`}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100">
                      ↑ Retiro
                    </Link>
                  </div>
                </div>
              </section>

              {/* ── KPIs resumen ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Saldo ahorros", value: fmt(detalle.socio!.saldoAhorros), color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100" },
                  { label: "Total aportes", value: fmt(detalle.totalGeneral.aportes), color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-100" },
                  { label: "Total ahorrado", value: fmt(detalle.totalGeneral.ahorros), color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-100" },
                  { label: "Intereses ganados", value: fmt(detalle.totalGeneral.intereses), color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-100" },
                ].map(k => (
                  <div key={k.label} className={cn("rounded-xl border p-3", k.bg, k.border)}>
                    <p className={cn("text-[10px] font-semibold uppercase tracking-wide", k.color)}>{k.label}</p>
                    <p className={cn("text-lg font-bold tabular-nums mt-0.5", k.color)}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* ── Cuentas ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Ahorros */}
                <section className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM2.273 8.625A4.483 4.483 0 0 1 5.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 6H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z"/></svg>
                    </span>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Cuenta Ahorros</p>
                  </div>
                  <p className="text-3xl font-bold text-emerald-700 tabular-nums">{fmt(detalle.socio!.saldoAhorros)}</p>
                  <p className="text-xs text-gray-400 mt-1">Saldo libre disponible para retiro</p>
                </section>

                {/* Inversión */}
                <section className={cn("rounded-xl border-2 p-4 shadow-sm", detalle.inversionActiva ? "border-blue-200 bg-gradient-to-br from-blue-50 to-white" : "border-gray-200 bg-gray-50")}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg text-white", detalle.inversionActiva ? "bg-blue-600" : "bg-gray-400")}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd"/><path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clipRule="evenodd"/></svg>
                    </span>
                    <p className={cn("text-xs font-bold uppercase tracking-wider", detalle.inversionActiva ? "text-blue-700" : "text-gray-400")}>Cuenta Inversión</p>
                  </div>
                  {detalle.inversionActiva ? (
                    <>
                      <p className="text-3xl font-bold text-blue-700 tabular-nums">{fmt(detalle.inversionActiva.montoInvertido)}</p>
                      <p className="text-xs text-gray-500 mt-1">{detalle.inversionActiva.ronda.nombre} · {Number(detalle.inversionActiva.porcentajeParticipacion).toFixed(2)}% participación</p>
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-gray-300">$0.00</p>
                      <p className="text-xs text-gray-400 mt-1">Sin inversión activa</p>
                    </>
                  )}
                </section>
              </div>

              {/* ── Préstamos ── */}
              {detalle.prestamos.length > 0 && (
                <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-indigo-600">
                        <path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM18.75 9a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM4.5 9.75A.75.75 0 0 1 5.25 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75V9.75Z" clipRule="evenodd"/><path d="M2.25 18a.75.75 0 0 0 0 1.5c5.4 0 10.63.722 15.6 2.075 1.19.324 2.4-.558 2.4-1.82V18.75a.75.75 0 0 0-.75-.75H2.25Z"/>
                      </svg>
                      <p className="text-sm font-semibold text-gray-800">Préstamos</p>
                    </div>
                    <span className="text-xs text-gray-400">{detalle.prestamos.length} registro{detalle.prestamos.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="divide-y">
                    {detalle.prestamos.map(p => {
                      const cuotasPagadas = p.cuotas.filter((c: any) => c.pagada).length;
                      const cuotasPendientes = p.cuotas.filter((c: any) => !c.pagada).length;
                      const proximaCuota = p.cuotas.find((c: any) => !c.pagada);
                      return (
                        <div key={p.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                                  p.estado === "ACTIVO" ? "bg-emerald-100 text-emerald-700" :
                                  p.estado === "CANCELADO" ? "bg-orange-100 text-orange-700" :
                                  "bg-gray-100 text-gray-500")}>
                                  {p.estado}
                                </span>
                                <span className="text-xs text-gray-400">{p.ronda?.nombre}</span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900 mt-1">{fmt(Number(p.monto))} · {Number(p.tasaAnual).toFixed(2)}% · {p.plazoMeses} meses</p>
                              {p.notaCancelacion && <p className="text-xs text-orange-600 mt-0.5 italic">{p.notaCancelacion}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-indigo-700">{fmt(Number(p.saldoActual))}</p>
                              <p className="text-xs text-gray-400">saldo</p>
                            </div>
                          </div>
                          {p.estado === "ACTIVO" && (
                            <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
                              <div className="rounded bg-gray-50 px-2 py-1.5">
                                <p className="text-gray-400">Pagadas</p>
                                <p className="font-semibold text-emerald-600">{cuotasPagadas}/{p.plazoMeses}</p>
                              </div>
                              <div className="rounded bg-gray-50 px-2 py-1.5">
                                <p className="text-gray-400">Pendientes</p>
                                <p className="font-semibold text-amber-600">{cuotasPendientes}</p>
                              </div>
                              {proximaCuota && (
                                <div className="rounded bg-indigo-50 px-2 py-1.5">
                                  <p className="text-indigo-400">Próxima</p>
                                  <p className="font-semibold text-indigo-700">{fmt(Number(proximaCuota.cuota))}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── Préstamos Express ── */}
              {detalle.prestamosExpress.length > 0 && (
                <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <div className="border-b bg-indigo-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-indigo-600">
                        <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd"/>
                      </svg>
                      <p className="text-sm font-semibold text-indigo-800">Préstamos Express</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-medium">
                        {detalle.prestamosExpress.filter((e: any) => e.estado === "PENDIENTE").length} pendiente{detalle.prestamosExpress.filter((e: any) => e.estado === "PENDIENTE").length !== 1 ? "s" : ""}
                      </span>
                      <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-medium">
                        {detalle.prestamosExpress.filter((e: any) => e.estado === "COBRADO").length} cobrado{detalle.prestamosExpress.filter((e: any) => e.estado === "COBRADO").length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y">
                    {detalle.prestamosExpress.map((e: any) => (
                      <div key={e.id} className={cn("px-4 py-3 flex items-center justify-between gap-3", e.estado === "PENDIENTE" && "bg-amber-50/40")}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                              e.estado === "PENDIENTE" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                              {e.estado}
                            </span>
                            <span className="text-xs text-gray-400">Sem. {e.semana} · {e.ronda?.nombre}</span>
                            {e.semanasVencidas > 0 && (
                              <span className="rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-bold">
                                +{e.semanasVencidas} sem. retraso
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Principal: {fmt(Number(e.principal))} · Interés: {fmt(Number(e.interesAcumulado ?? e.interes ?? 0))}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-indigo-700 tabular-nums shrink-0">{fmt(Number(e.total))}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t bg-gray-50 px-4 py-2 flex justify-between text-xs">
                    <span className="text-gray-500">Total intereses generados</span>
                    <span className="font-bold text-indigo-700">
                      {fmt(detalle.prestamosExpress.reduce((s: number, e: any) => s + Number(e.interesAcumulado ?? e.interes ?? 0), 0))}
                    </span>
                  </div>
                </section>
              )}

              {/* ── Historial de multas ── */}
              <MultasSection socioId={selectedId!} />

              {/* ── Participación por ronda ── */}
              {detalle.detallePorRonda.length > 0 && (
                <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <div className="border-b bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-800">Participación por ronda</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-3 text-left">Ronda</th>
                          <th className="px-4 py-3 text-right">Aportes</th>
                          <th className="px-4 py-3 text-right">Ahorros</th>
                          <th className="px-4 py-3 text-right">Invertido</th>
                          <th className="px-4 py-3 text-right">%</th>
                          <th className="px-4 py-3 text-right">Intereses</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.detallePorRonda.map(r => (
                          <tr key={r.id} className="border-t hover:bg-gray-50/60">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{r.nombre}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className={cn("inline-block h-1.5 w-1.5 rounded-full", r.activa ? "bg-emerald-500" : "bg-gray-300")}/>
                                <span className="text-xs text-gray-400">{r.activa ? "Activa" : fmtDate(r.fechaFin)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmt(r.totalAportes)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-teal-700">{fmt(r.totalAhorros)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-blue-700">
                              {r.montoInvertido != null ? fmt(r.montoInvertido) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-500">
                              {r.pctParticipacion != null ? `${r.pctParticipacion.toFixed(2)}%` : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-amber-700">
                              {r.interesesGanados > 0 ? fmt(r.interesesGanados) : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* ── Movimientos recientes ── */}
              {detalle.movimientos.length > 0 && (
                <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <div className="border-b bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-800">Movimientos recientes</p>
                    <p className="text-xs text-gray-400 mt-0.5">Últimos {detalle.movimientos.length} registros</p>
                  </div>
                  <ul className="divide-y">
                    {detalle.movimientos.map(m => {
                      const cfg = TIPO_MOV[m.tipo] ?? { label: m.tipo, color: "text-gray-600", bg: "bg-gray-100", signo: "+" as const };
                      return (
                        <li key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60">
                          <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", cfg.bg, cfg.color)}>
                            {cfg.signo}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{m.nota || cfg.label}</p>
                            <p className="text-xs text-gray-400">
                              {m.ronda?.nombre && <span>{m.ronda.nombre} · </span>}
                              {fmtDate(m.createdAt)}
                            </p>
                          </div>
                          <span className={cn("text-sm font-semibold tabular-nums shrink-0", cfg.color)}>
                            {cfg.signo}{fmt(Number(m.monto))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <div className="border-t bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-400">Los intereses se calculan según % de participación al cerrar la ronda.</p>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
