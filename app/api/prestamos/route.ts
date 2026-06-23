// app/api/prestamos/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { crearMovimientoFondo } from "@/lib/movimiento-fondo";
type CreatePrestamoBody = {
  socioId: number;
  monto: number;
  tasaAnual: number;
  plazoSemanas: number;
  fechaInicio: string;
};
function isValidDateOnly(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function toDecimal(n: number) {
  return new Prisma.Decimal(round2(n));
}
function buildSchedule(params: {
  principal: number;
  tasaMensualPct: number;
  plazoSemanas: number;
  startDate: Date;
}) {
  const { principal: P, tasaMensualPct, plazoSemanas, startDate } = params;
  if (plazoSemanas <= 0) throw new Error("plazoSemanas debe ser mayor a 0");
  if (P <= 0) throw new Error("monto debe ser mayor a 0");
  if (tasaMensualPct < 0) throw new Error("tasaAnual no puede ser negativa");
  const interesMensual = round2(P * (tasaMensualPct / 100));
  const mesesCompletos = Math.floor(plazoSemanas / 4);
  const semanasRestantes = plazoSemanas % 4;
  const totalCuotas = mesesCompletos + (semanasRestantes > 0 ? 1 : 0);
  if (totalCuotas === 0) throw new Error("El plazo no genera cuotas");
  const capitalPorCuota = round2(P / totalCuotas);
  let saldo = P;
  let diaAcumulado = 0;
  return Array.from({ length: totalCuotas }, (_, i) => {
    const numero = i + 1;
    const esUltima = numero === totalCuotas;
    const esParcial = esUltima && semanasRestantes > 0;
    const diasEstaCuota = esParcial ? semanasRestantes * 7 : 28;
    diaAcumulado += diasEstaCuota;
    const capital = esUltima ? round2(saldo) : capitalPorCuota;
    const interes = esParcial
      ? round2(interesMensual * (semanasRestantes / 4))
      : interesMensual;
    const newSaldo = round2(saldo - capital);
    const result = {
      numero,
      fechaVenc: addDays(startDate, diaAcumulado),
      cuota: round2(capital + interes),
      interes,
      capital,
      saldo: newSaldo,
    };
    saldo = newSaldo;
    return result;
  });
}
// ===== GET =====
export async function GET() {
  try {
    const prestamos = await prisma.prestamo.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
        ronda: { select: { id: true, nombre: true, activa: true, fechaInicio: true, fechaFin: true } },
        cuotas: { where: { pagada: false }, orderBy: { fechaVenc: "asc" }, take: 1 },
      },
    });
    return NextResponse.json({
      prestamos: prestamos.map(p => ({
        id: p.id, socio: p.socio, ronda: p.ronda,
        monto: Number(p.monto), tasaAnual: Number(p.tasaAnual),
        plazoMeses: p.plazoMeses, fechaInicio: p.fechaInicio,
        estado: p.estado, saldoActual: Number(p.saldoActual),
        nextPayment: p.cuotas[0]
          ? { cuotaId: p.cuotas[0].id, fechaVenc: p.cuotas[0].fechaVenc, cuota: Number(p.cuotas[0].cuota) }
          : null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
// ===== POST =====
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<CreatePrestamoBody>;
    if (!body?.socioId) throw new Error("socioId es requerido");
    if (!body?.monto || Number(body.monto) <= 0) throw new Error("monto inválido");
    if (body.tasaAnual == null || Number(body.tasaAnual) < 0) throw new Error("tasaAnual inválida");
    if (!body?.plazoSemanas || Number(body.plazoSemanas) <= 0) throw new Error("plazoSemanas inválido");
    if (!body?.fechaInicio || !isValidDateOnly(body.fechaInicio)) throw new Error("fechaInicio debe ser YYYY-MM-DD");
    const socioId = Number(body.socioId);
    const monto = Number(body.monto);
    const tasaMensualPct = Number(body.tasaAnual);
    const plazoSemanas = Number(body.plazoSemanas);
    const fechaInicio = new Date(`${body.fechaInicio}T00:00:00`);

    const socio = await prisma.socio.findUnique({ where: { id: socioId } });
    if (!socio) throw new Error("Socio no existe");

    const rondaActiva = await prisma.ronda.findFirst({
      where: { activa: true },
      orderBy: { fechaInicio: "desc" },
    });
    if (!rondaActiva) throw new Error("No hay ronda activa.");

    // ✅ Validación: semanas no pueden exceder el fin de la ronda
    if (rondaActiva.fechaFin) {
      const diffMs = rondaActiva.fechaFin.getTime() - fechaInicio.getTime();
      const diasRestantes = diffMs / (1000 * 60 * 60 * 24);
      // Usar Math.round para tolerancia de fechas con horas (e.g. 147.0 días = 21 semanas exactas)
      // Sumar 0.5 días de tolerancia para evitar rechazo por diferencias de horas
      const maxSemanas = Math.round((diasRestantes + 0.5) / 7);
      if (plazoSemanas > maxSemanas + 1) {
        throw new Error(
          `El plazo (${plazoSemanas} sem.) excede el máximo permitido (${maxSemanas + 1} sem. = ${maxSemanas} restantes + 1 extra). ` +
          `La ronda termina el ${rondaActiva.fechaFin.toISOString().slice(0, 10)}.`
        );
      }
    }

    const schedule = buildSchedule({ principal: monto, tasaMensualPct, plazoSemanas, startDate: fechaInicio });
    const result = await prisma.$transaction(async (tx) => {
      const prestamo = await tx.prestamo.create({
        data: {
          rondaId: rondaActiva.id,
          socioId,
          monto: toDecimal(monto),
          tasaAnual: toDecimal(tasaMensualPct),
          plazoMeses: Math.ceil(plazoSemanas / 4),
          fechaInicio,
          estado: "ACTIVO",
          saldoActual: toDecimal(monto),
        },
      });
      await tx.prestamoCuota.createMany({
        data: schedule.map(c => ({
          prestamoId: prestamo.id,
          numero: c.numero,
          fechaVenc: c.fechaVenc,
          cuota: toDecimal(c.cuota),
          interes: toDecimal(c.interes),
          capital: toDecimal(c.capital),
          saldo: toDecimal(c.saldo),
          pagada: false,
        })),
      });

      // Registrar salida del fondo y actualizar saldo disponible
      await crearMovimientoFondo(tx, {
        rondaId: rondaActiva.id,
        tipo: "PRESTAMO_OTORGADO",
        monto,
        prestamoId: prestamo.id,
        nota: `Préstamo otorgado a socio #${socioId}`,
      });
      await tx.ronda.update({
        where: { id: rondaActiva.id },
        data: { saldoFondoDisponible: { decrement: toDecimal(monto) } },
      });

      return tx.prestamo.findUnique({
        where: { id: prestamo.id },
        include: {
          socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
          ronda: { select: { id: true, nombre: true, activa: true, fechaInicio: true, fechaFin: true } },
          cuotas: { orderBy: { numero: "asc" } },
        },
      });
    });
    if (!result) throw new Error("Error al obtener el préstamo creado");
    return NextResponse.json({
      prestamo: {
        ...result,
        monto: Number(result.monto),
        tasaAnual: Number(result.tasaAnual),
        saldoActual: Number(result.saldoActual),
        cuotas: result.cuotas.map(c => ({
          ...c,
          cuota: Number(c.cuota),
          interes: Number(c.interes),
          capital: Number(c.capital),
          saldo: Number(c.saldo),
        })),
      },
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error al crear préstamo" }, { status: 400 });
  }
}
