// app/api/prestamos/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type CreatePrestamoBody = {
  socioId: number;
  monto: number;
  tasaAnual: number;   // % mensual plano
  plazoMeses: number;
  fechaInicio: string; // YYYY-MM-DD
};

function isValidDateOnly(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toMoneyDecimal(n: number) {
  return new Prisma.Decimal(round2(n));
}

/** Meses completos entre dos fechas */
function mesesEntre(desde: Date, hasta: Date): number {
  const diffMs = hasta.getTime() - desde.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375));
}

/** Interés plano: cuota fija = capital/n + principal*tasa_mensual */
function buildSchedule(params: {
  principal: number;
  tasaMensualPct: number;
  plazoMeses: number;
  startDate: Date;
}) {
  const P = params.principal;
  const n = params.plazoMeses;
  const pct = params.tasaMensualPct / 100;

  if (n <= 0) throw new Error("plazoMeses debe ser mayor a 0");
  if (P <= 0) throw new Error("monto debe ser mayor a 0");
  if (params.tasaMensualPct < 0) throw new Error("tasaAnual no puede ser negativa");

  const interesMensual = round2(P * pct);
  const capitalMensual = round2(P / n);
  let saldo = P;

  return Array.from({ length: n }, (_, i) => {
    const numero = i + 1;
    const capital = numero === n ? round2(saldo) : capitalMensual;
    const newSaldo = round2(saldo - capital);
    const result = {
      numero,
      fechaVenc: addMonths(params.startDate, numero),
      cuota: round2(interesMensual + capital),
      interes: interesMensual,
      capital,
      saldo: newSaldo,
    };
    saldo = newSaldo;
    return result;
  });
}

// ===== GET: listar préstamos =====
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

    const normalized = prestamos.map((p) => {
      const next = p.cuotas[0] ?? null;
      return {
        id: p.id,
        socio: p.socio,
        ronda: p.ronda,
        monto: Number(p.monto),
        tasaAnual: Number(p.tasaAnual),
        plazoMeses: p.plazoMeses,
        fechaInicio: p.fechaInicio,
        estado: p.estado,
        saldoActual: Number(p.saldoActual),
        nextPayment: next ? { cuotaId: next.id, fechaVenc: next.fechaVenc, cuota: Number(next.cuota) } : null,
      };
    });

    return NextResponse.json({ prestamos: normalized });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error al listar préstamos" }, { status: 500 });
  }
}

// ===== POST: crear préstamo =====
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<CreatePrestamoBody>;

    if (!body?.socioId) throw new Error("socioId es requerido");
    if (!body?.monto || Number(body.monto) <= 0) throw new Error("monto inválido");
    if (body.tasaAnual == null || Number(body.tasaAnual) < 0) throw new Error("tasaAnual inválida");
    if (!body?.plazoMeses || Number(body.plazoMeses) <= 0) throw new Error("plazoMeses inválido");
    if (!body?.fechaInicio || !isValidDateOnly(body.fechaInicio)) throw new Error("fechaInicio debe ser YYYY-MM-DD");

    const socioId = Number(body.socioId);
    const monto = Number(body.monto);
    const tasaMensualPct = Number(body.tasaAnual);
    const plazoMeses = Number(body.plazoMeses);
    const fechaInicio = new Date(`${body.fechaInicio}T00:00:00`);

    const socio = await prisma.socio.findUnique({ where: { id: socioId } });
    if (!socio) throw new Error("Socio no existe");

    const rondaActiva = await prisma.ronda.findFirst({
      where: { activa: true },
      orderBy: { fechaInicio: "desc" },
    });
    if (!rondaActiva) throw new Error("No hay ronda activa. Crea/activa una ronda primero.");

    // ✅ VALIDACIÓN: plazo no puede exceder meses restantes de la ronda
    if (rondaActiva.fechaFin) {
      const maxMeses = mesesEntre(fechaInicio, rondaActiva.fechaFin);
      if (plazoMeses > maxMeses) {
        throw new Error(
          `El plazo (${plazoMeses} meses) excede los meses restantes de la ronda (${maxMeses} meses). ` +
          `La ronda termina el ${rondaActiva.fechaFin.toISOString().slice(0, 10)}.`
        );
      }
    }

    const schedule = buildSchedule({
      principal: monto,
      tasaMensualPct,
      plazoMeses,
      startDate: fechaInicio,
    });

    const result = await prisma.$transaction(async (tx) => {
      const prestamo = await tx.prestamo.create({
        data: {
          rondaId: rondaActiva.id,
          socioId,
          monto: toMoneyDecimal(monto),
          tasaAnual: new Prisma.Decimal(round2(tasaMensualPct)),
          plazoMeses,
          fechaInicio,
          estado: "ACTIVO",
          saldoActual: toMoneyDecimal(monto),
        },
      });

      await tx.prestamoCuota.createMany({
        data: schedule.map((c) => ({
          prestamoId: prestamo.id,
          numero: c.numero,
          fechaVenc: c.fechaVenc,
          cuota: toMoneyDecimal(c.cuota),
          interes: toMoneyDecimal(c.interes),
          capital: toMoneyDecimal(c.capital),
          saldo: toMoneyDecimal(c.saldo),
          pagada: false,
        })),
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

    const payload = {
      ...result,
      monto: Number(result.monto),
      tasaAnual: Number(result.tasaAnual),
      saldoActual: Number(result.saldoActual),
      cuotas: result.cuotas.map((c) => ({
        ...c,
        cuota: Number(c.cuota),
        interes: Number(c.interes),
        capital: Number(c.capital),
        saldo: Number(c.saldo),
      })),
    };

    return NextResponse.json({ prestamo: payload }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error al crear préstamo" }, { status: 400 });
  }
}
