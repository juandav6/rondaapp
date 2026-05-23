// app/socios/kardex/page.tsx
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { SocioSearch } from "../detalle/components";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (d: Date | string | null) => {
  if (!d) return "—";
  const dt = new Date(d as string);
  if (isNaN(dt.getTime())) return "—";
  // Usar UTC para evitar desfase de timezone
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
  }).format(dt);
};

// Tipo de cada línea del kardex
type KardexLine = {
  fecha: Date;
  concepto: string;
  referencia: string;
  debe: number;   // salidas: retiros, inversiones
  haber: number;  // entradas: ahorros, devoluciones, intereses
  saldo: number;
};

async function getSocios() {
  return prisma.socio.findMany({
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    select: { id: true, numeroCuenta: true, nombres: true, apellidos: true, cedula: true, saldoAhorros: true },
  });
}

async function getKardex(socioId: number) {
  const socio = await prisma.socio.findUnique({ where: { id: socioId } });
  if (!socio) return null;

  // Todos los movimientos de cuenta ordenados por fecha, con INVERSION antes que AHORRO en misma fecha
  const movimientos = await prisma.movimientoCuenta.findMany({
    where: { socioId },
    include: { ronda: { select: { nombre: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  // Ordenar: misma fecha → INVERSION primero, luego AHORRO/DEVOLUCION/INTERES, luego RETIRO
  const TIPO_ORDEN: Record<string, number> = {
    DEVOLUCION: 1,  // retorno capital ronda anterior
    INTERES:    2,  // intereses ronda anterior
    INVERSION:  3,  // entrada al nuevo fondo
    AHORRO:     4,  // ahorro semanal
    RETIRO:     5,
  };
  movimientos.sort((a, b) => {
    const diffFecha = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (Math.abs(diffFecha) > 86400000) return diffFecha; // fechas distintas → orden normal
    // Mismo día → ordenar por tipo
    return (TIPO_ORDEN[a.tipo] ?? 9) - (TIPO_ORDEN[b.tipo] ?? 9);
  });

  const TIPO_CFG: Record<string, { esHaber: boolean; concepto: string }> = {
    AHORRO:     { esHaber: true,  concepto: "Depósito / Ahorro" },
    RETIRO:     { esHaber: false, concepto: "Retiro" },
    INVERSION:  { esHaber: false, concepto: "Aporte al fondo" },
    DEVOLUCION: { esHaber: true,  concepto: "Devolución capital" },
    INTERES:    { esHaber: true,  concepto: "Intereses ganados" },
  };

  let saldoAcum = 0;
  const lineas: KardexLine[] = movimientos.map(m => {
    const cfg = TIPO_CFG[m.tipo] ?? { esHaber: true, concepto: m.tipo };
    const monto = Number(m.monto);
    const haber = cfg.esHaber ? monto : 0;
    const debe  = cfg.esHaber ? 0 : monto;
    saldoAcum = saldoAcum + haber - debe;
    return {
      fecha: m.createdAt,
      concepto: cfg.concepto,
      referencia: m.nota ?? (m.ronda?.nombre ?? "—"),
      debe,
      haber,
      saldo: saldoAcum,
    };
  });

  return { socio, lineas, saldoFinal: saldoAcum };
}

function cn(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

export default async function KardexPage({ searchParams }: { searchParams: Promise<{ socioId?: string }> }) {
  const { socioId } = await searchParams;
  const socios = await getSocios();
  const selectedId = socioId ? parseInt(socioId, 10) : undefined;
  const kardex = Number.isFinite(selectedId) ? await getKardex(selectedId!) : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Zm6.905 9.97a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l1.72-1.72V18a.75.75 0 0 0 1.5 0v-4.19l1.72 1.72a.75.75 0 1 0 1.06-1.06l-3-3Z" clipRule="evenodd"/>
              <path d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z"/>
            </svg>
          </span>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Kardex del socio</h1>
            <p className="text-xs text-gray-500">Historial de movimientos con debe, haber y saldo acumulado</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Lista socios */}
        <aside className={cn("lg:col-span-1 rounded-xl border bg-white shadow-sm overflow-hidden", kardex ? "hidden lg:block" : "block")}>
          <div className="border-b bg-gray-50 px-4 py-3">
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
              const active = s.id === selectedId;
              return (
                <li key={s.id} data-search={`${s.apellidos} ${s.nombres} ${s.numeroCuenta} ${s.cedula}`.toLowerCase()}>
                  <Link href={`/socios/kardex?socioId=${s.id}`}
                    className={cn("flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50 transition-colors",
                      active ? "bg-teal-50 border-l-2 border-teal-500" : "")}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{s.apellidos}, {s.nombres}</p>
                      <p className="truncate text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                    </div>
                    <p className="text-xs font-semibold text-teal-700 shrink-0">{fmt(s.saldoAhorros)}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Kardex */}
        <main className="lg:col-span-3 space-y-4">
          {kardex && (
            <div className="flex items-center gap-3 lg:hidden">
              <Link href="/socios/kardex" className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">← Lista</Link>
              <p className="text-sm font-medium text-gray-700 truncate">{kardex.socio.nombres} {kardex.socio.apellidos}</p>
            </div>
          )}

          {!kardex ? (
            <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-300 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Zm6.905 9.97a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l1.72-1.72V18a.75.75 0 0 0 1.5 0v-4.19l1.72 1.72a.75.75 0 1 0 1.06-1.06l-3-3Z" clipRule="evenodd"/>
                </svg>
              </div>
              <p className="text-sm text-gray-400">Selecciona un socio para ver su kardex</p>
            </div>
          ) : (
            <>
              {/* Encabezado socio */}
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700 font-bold text-sm shrink-0">
                      {kardex.socio.nombres[0]}{kardex.socio.apellidos[0]}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{kardex.socio.nombres} {kardex.socio.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{kardex.socio.numeroCuenta} · CI {kardex.socio.cedula}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/socios/detalle?socioId=${selectedId}`}
                      className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      Ver detalle
                    </Link>
                  </div>
                </div>

                {/* KPIs */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: "Total entradas (Haber)", value: fmt(kardex.lineas.reduce((s, l) => s + l.haber, 0)), color: "text-emerald-700", bg: "bg-emerald-50" },
                    { label: "Total salidas (Debe)", value: fmt(kardex.lineas.reduce((s, l) => s + l.debe, 0)), color: "text-rose-700", bg: "bg-rose-50" },
                    { label: "Saldo final", value: fmt(kardex.saldoFinal), color: "text-teal-700 font-bold", bg: "bg-teal-50" },
                  ].map(k => (
                    <div key={k.label} className={cn("rounded-lg p-2.5 text-center", k.bg)}>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{k.label}</p>
                      <p className={cn("text-sm tabular-nums mt-0.5", k.color)}>{k.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nota saldo almacenado vs calculado */}
              {Math.abs(kardex.saldoFinal - Number(kardex.socio.saldoAhorros)) > 0.01 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-amber-500">
                    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
                  </svg>
                  <span>
                    <strong>Diferencia detectada:</strong> El saldo calculado por movimientos ({fmt(kardex.saldoFinal)}) difiere del saldo almacenado ({fmt(Number(kardex.socio.saldoAhorros))}). Usa el script SQL de corrección en Neon para sincronizar.
                  </span>
                </div>
              )}

              {/* Tabla kardex */}
              {kardex.lineas.length === 0 ? (
                <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">Sin movimientos registrados para este socio</div>
              ) : (
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Kardex de movimientos</p>
                    <p className="text-xs text-gray-400">{kardex.lineas.length} registros</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-3 text-left">Fecha</th>
                          <th className="px-4 py-3 text-left">Concepto</th>
                          <th className="px-4 py-3 text-left">Referencia</th>
                          <th className="px-4 py-3 text-right text-rose-600">Debe (−)</th>
                          <th className="px-4 py-3 text-right text-emerald-600">Haber (+)</th>
                          <th className="px-4 py-3 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kardex.lineas.map((l, i) => (
                          <tr key={i} className="border-t hover:bg-gray-50/60">
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(l.fecha)}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{l.concepto}</td>
                            <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate">{l.referencia}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {l.debe > 0
                                ? <span className="text-rose-600 font-medium">{fmt(l.debe)}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {l.haber > 0
                                ? <span className="text-emerald-600 font-medium">{fmt(l.haber)}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className={cn("px-4 py-3 text-right tabular-nums font-semibold",
                              l.saldo >= 0 ? "text-teal-700" : "text-rose-700")}>
                              {fmt(l.saldo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-700">TOTAL</td>
                          <td className="px-4 py-3 text-right tabular-nums font-bold text-rose-700">
                            {fmt(kardex.lineas.reduce((s, l) => s + l.debe, 0))}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">
                            {fmt(kardex.lineas.reduce((s, l) => s + l.haber, 0))}
                          </td>
                          <td className={cn("px-4 py-3 text-right tabular-nums font-bold text-base",
                            kardex.saldoFinal >= 0 ? "text-teal-700" : "text-rose-700")}>
                            {fmt(kardex.saldoFinal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
