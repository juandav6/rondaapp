// app/socios/detalle/page.tsx
import Link from "next/link";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function fmtMoney(n: number | bigint, currency = "USD", locale = "es-EC") {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(n || 0));
}

function fmtDate(iso: string | Date | null | undefined, locale = "es-EC") {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

async function getSocios() {
  return prisma.socio.findMany({
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    select: { id: true, numeroCuenta: true, nombres: true, apellidos: true, cedula: true, multas: true },
  });
}

async function getDetalleSocio(socioId: number) {
  // ── 1. Rondas en las que participó ──────────────────────────────────────────
  const rondas = await prisma.ronda.findMany({
    where: {
      OR: [
        { participaciones: { some: { socioId } } },
        { ahorros: { some: { socioId } } },
        { aportes: { some: { socioId } } },
      ],
    },
    orderBy: { fechaInicio: "desc" },
    select: {
      id: true,
      nombre: true,
      fechaInicio: true,
      fechaFin: true,
      activa: true,
      aportes: { where: { socioId }, select: { monto: true, multa: true } },
      ahorros: { where: { socioId }, select: { monto: true, semana: true } },
    },
  });

  // ── 2. Para cada ronda CERRADA: calcular intereses ganados ──────────────────
  // Lógica:
  //   - totalInteresRonda = suma de interés proyectado de todos los préstamos de esa ronda
  //   - proporción socio   = aportes del socio / total aportes de todos los socios en la ronda
  //   - interesGanado      = totalInteresRonda × proporción

  const detallePorRonda = await Promise.all(
    rondas.map(async (r) => {
      const totalAportesSocio = r.aportes.reduce((acc, a) => acc + Number(a.monto), 0);
      const totalMultasSocio  = r.aportes.reduce((acc, a) => acc + Number(a.multa), 0);
      const totalAhorrosSocio = r.ahorros.reduce((acc, a) => acc + Number(a.monto), 0);

      let interesGanado: number | null = null;

      // Solo calcular si la ronda está cerrada (activa = false)
      if (!r.activa) {
        // Total aportes de TODOS los socios en esta ronda
        const todosAportes = await prisma.aporte.aggregate({
          where: { rondaId: r.id },
          _sum: { monto: true },
        });
        const totalAportesRonda = Number(todosAportes._sum.monto ?? 0);

        // Total interés proyectado de todos los préstamos de esta ronda
        // (suma de interes de cada cuota × plazoMeses, o sumamos directamente las cuotas de interés)
        const prestamosRonda = await prisma.prestamo.findMany({
          where: { rondaId: r.id },
          include: {
            cuotas: { select: { interes: true } },
          },
        });

        const totalInteresRonda = prestamosRonda.reduce((acc, p) => {
          return acc + p.cuotas.reduce((a, c) => a + Number(c.interes), 0);
        }, 0);

        // Proporción del socio
        if (totalAportesRonda > 0 && totalInteresRonda > 0) {
          const proporcion = totalAportesSocio / totalAportesRonda;
          interesGanado = Math.round(proporcion * totalInteresRonda * 100) / 100;
        } else {
          interesGanado = 0;
        }
      }

      return {
        id: r.id,
        nombre: r.nombre,
        fechaInicio: r.fechaInicio,
        fechaFin: r.fechaFin,
        activa: r.activa,
        totalAportes: totalAportesSocio,
        totalAhorros: totalAhorrosSocio,
        totalMultas: totalMultasSocio,
        interesGanado, // null si la ronda está activa, número si está cerrada
      };
    })
  );

  const totalGeneral = detallePorRonda.reduce(
    (acc, d) => ({
      aportes: acc.aportes + d.totalAportes,
      ahorros: acc.ahorros + d.totalAhorros,
      multas:  acc.multas  + d.totalMultas,
      intereses: acc.intereses + (d.interesGanado ?? 0),
    }),
    { aportes: 0, ahorros: 0, multas: 0, intereses: 0 }
  );

  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    select: { multas: true, nombres: true, apellidos: true, numeroCuenta: true, cedula: true },
  });

  return {
    socio,
    detallePorRonda,
    totalGeneral: {
      ...totalGeneral,
      multas: totalGeneral.multas + Number(socio?.multas ?? 0),
      multasAporte: totalGeneral.multas,
      multasExtraSocio: Number(socio?.multas ?? 0),
    },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ socioId?: string }>;
}) {
  const { socioId } = await searchParams;
  const socios = await getSocios();
  const selectedId = socioId ? Number.parseInt(socioId, 10) : undefined;
  const detalle = Number.isFinite(selectedId as number) ? await getDetalleSocio(selectedId as number) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-7 8a7 7 0 0 1 14 0"/>
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Detalle por socio</h1>
            <p className="text-sm text-gray-600">Selecciona un socio para ver sus rondas, ahorros e intereses ganados.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Lista de socios */}
        <aside className="md:col-span-1 rounded-xl border bg-white p-6 shadow-sm">
          <header className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Socios</h2>
            <Link href="/socios/nuevo" className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-gray-50">Nuevo</Link>
          </header>
          <ul className="divide-y rounded-lg border">
            {socios.map((s) => {
              const isActive = s.id === selectedId;
              return (
                <li key={s.id}>
                  <Link
                    href={`/socios/detalle?socioId=${s.id}`}
                    className={`flex items-center justify-between gap-3 p-3 hover:bg-gray-50 ${isActive ? "bg-violet-50" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                      <p className="truncate text-xs text-gray-500">Cuenta {s.numeroCuenta} · CI {s.cedula}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Detalle */}
        <main className="md:col-span-2 space-y-6">
          {!detalle ? (
            <div className="rounded-xl border bg-white p-6 text-gray-600 shadow-sm">
              Selecciona un socio para ver su detalle.
            </div>
          ) : (
            <>
              {/* Cabecera socio */}
              <section className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                        <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-7 8a7 7 0 0 1 14 0"/>
                      </svg>
                    </span>
                    <div>
                      <h2 className="text-xl font-semibold">{detalle.socio?.apellidos}, {detalle.socio?.nombres}</h2>
                      <p className="text-sm text-gray-600">Cuenta {detalle.socio?.numeroCuenta} · CI {detalle.socio?.cedula}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Totales generales */}
              <section className="rounded-xl border bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold">Totales generales</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">Aportes</p>
                    <p className="mt-1 text-xl font-semibold">{fmtMoney(detalle.totalGeneral.aportes)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">Ahorros</p>
                    <p className="mt-1 text-xl font-semibold">{fmtMoney(detalle.totalGeneral.ahorros)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">Multas</p>
                    <p className="mt-1 text-xl font-semibold text-rose-600">{fmtMoney(detalle.totalGeneral.multasAporte)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">Intereses ganados</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-600">{fmtMoney(detalle.totalGeneral.intereses)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Solo rondas cerradas</p>
                  </div>
                </div>
              </section>

              {/* Tabla de rondas */}
              <section className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Z"/>
                    </svg>
                  </span>
                  <h3 className="text-lg font-semibold">Rondas participadas</h3>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                      <tr>
                        <th className="px-4 py-3">Ronda</th>
                        <th className="px-4 py-3">Inicio</th>
                        <th className="px-4 py-3">Fin</th>
                        <th className="px-4 py-3 text-right">Aportes</th>
                        <th className="px-4 py-3 text-right">Ahorros</th>
                        <th className="px-4 py-3 text-right">Multas</th>
                        <th className="px-4 py-3 text-right">Intereses ganados</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {detalle.detallePorRonda.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {r.nombre}
                            {r.activa && (
                              <span className="ml-2 inline-flex rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                                Activa
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">{fmtDate(r.fechaInicio)}</td>
                          <td className="px-4 py-3">{fmtDate(r.fechaFin ?? null)}</td>
                          <td className="px-4 py-3 text-right">{fmtMoney(r.totalAportes)}</td>
                          <td className="px-4 py-3 text-right">{fmtMoney(r.totalAhorros)}</td>
                          <td className="px-4 py-3 text-right">{fmtMoney(r.totalMultas)}</td>
                          <td className="px-4 py-3 text-right">
                            {r.activa ? (
                              <span className="text-xs text-gray-400 italic">Disponible al cerrar</span>
                            ) : (
                              <span className="font-semibold text-emerald-600">{fmtMoney(r.interesGanado ?? 0)}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  Los intereses ganados se calculan proporcionalmente a los aportes del socio sobre el total de la ronda,
                  aplicado al interés total generado por todos los préstamos de esa ronda.
                </p>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
