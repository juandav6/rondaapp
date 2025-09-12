// app/socios/detalle/page.tsx
import Link from "next/link";
import { PrismaClient } from "@prisma/client";

// (opcional pero recomendado) Reutiliza Prisma en dev para evitar demasiados clientes
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
  const rondas = await prisma.ronda.findMany({
    where: {
      OR: [
        { participaciones: { some: { socioId } } }, // rondas “normales”
        { ahorros: { some: { socioId } } },         // incluye Saldo inicial (semana 0)
        { aportes: { some: { socioId } } },         // por si acaso hubo aportes sin participación
      ],
    },
    orderBy: { fechaInicio: "desc" },
    select: {
      id: true,
      nombre: true,
      fechaInicio: true,
      fechaFin: true,
      // solo los movimientos del socio
      aportes: { where: { socioId }, select: { monto: true, multa: true } },
      ahorros: { where: { socioId }, select: { monto: true, semana: true } },
    },
  });

  const detallePorRonda = rondas.map((r) => {
    const totalAportes = r.aportes.reduce((acc, a) => acc + Number(a.monto), 0);
    const totalMultas  = r.aportes.reduce((acc, a) => acc + Number(a.multa), 0);
    const totalAhorros = r.ahorros.reduce((acc, a) => acc + Number(a.monto), 0);
    return {
      id: r.id,
      nombre: r.nombre,
      fechaInicio: r.fechaInicio,
      fechaFin: r.fechaFin,
      totalAportes,
      totalAhorros,     // ← aquí ya entra el “Saldo inicial” (semana 0)
      totalMultas,
    };
  });

  const totalGeneral = detallePorRonda.reduce(
    (acc, d) => ({
      aportes: acc.aportes + d.totalAportes,
      ahorros: acc.ahorros + d.totalAhorros,
      multas:  acc.multas  + d.totalMultas,
    }),
    { aportes: 0, ahorros: 0, multas: 0 }
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


// ✅ searchParams ahora es Promise y lo desenvuelves
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-7 8a7 7 0 0 1 14 0"/></svg>
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Detalle por socio</h1>
            <p className="text-sm text-gray-600">Selecciona un socio para ver sus rondas y totales.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Listado de socios */}
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
                    className={`flex items-center justify-between gap-3 p-3 hover:bg-gray-50 ${isActive ? "bg-gray-50" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                      <p className="truncate text-xs text-gray-500">Cuenta {s.numeroCuenta} • CI {s.cedula}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Multas extra</p>
                      <p className="text-sm font-medium">{fmtMoney(s.multas)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Detalle del socio */}
        <main className="md:col-span-2 space-y-6">
          {!detalle ? (
            <div className="rounded-xl border bg-white p-6 text-gray-600 shadow-sm">Selecciona un socio para ver su detalle.</div>
          ) : (
            <>
              {/* Tarjeta de cabecera del socio */}
              <section className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M4 6a2 2 0 0 1 2-2h2.5a1 1 0 0 1 .8.4l1.4 1.8H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z"/></svg>
                    </span>
                    <div>
                      <h2 className="text-xl font-semibold">{detalle.socio?.apellidos}, {detalle.socio?.nombres}</h2>
                      <p className="text-sm text-gray-600">Cuenta {detalle.socio?.numeroCuenta} • CI {detalle.socio?.cedula}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Totales generales */}
              <section className="rounded-xl border bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold">Totales generales</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">Aportes</p>
                    <p className="mt-1 text-xl font-semibold">{fmtMoney(detalle.totalGeneral.aportes)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">Ahorros</p>
                    <p className="mt-1 text-xl font-semibold">{fmtMoney(detalle.totalGeneral.ahorros)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">Multas (aportes)</p>
                    <p className="mt-1 text-xl font-semibold">{fmtMoney(detalle.totalGeneral.multasAporte)}</p>
                  </div>
                </div>
              </section>

              {/* Tabla de rondas */}
              <section className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Z"/></svg>
                  </span>
                  <h3 className="text-lg font-semibold">Rondas en las que ha participado</h3>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full table-auto text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                      <tr>
                        <th className="px-4 py-2">Ronda</th>
                        <th className="px-4 py-2">Inicio</th>
                        <th className="px-4 py-2">Fin</th>
                        <th className="px-4 py-2 text-right">Aportes</th>
                        <th className="px-4 py-2 text-right">Ahorros</th>
                        <th className="px-4 py-2 text-right">Multas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {detalle.detallePorRonda.map((r) => {
                        const total = r.totalAportes + r.totalAhorros + r.totalMultas;
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-900">{r.nombre}</td>
                            <td className="px-4 py-2">{fmtDate(r.fechaInicio)}</td>
                            <td className="px-4 py-2">{fmtDate(r.fechaFin ?? null)}</td>
                            <td className="px-4 py-2 text-right">{fmtMoney(r.totalAportes)}</td>
                            <td className="px-4 py-2 text-right">{fmtMoney(r.totalAhorros)}</td>
                            <td className="px-4 py-2 text-right">{fmtMoney(r.totalMultas)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

