// app/api/prestamos/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type CreatePrestamoBody = {
  socioId: number;
  monto: number;        // principal
  tasaAnual: number;    // % anual, ej 24
  plazoMeses: number;   // meses
  fechaInicio: string;  // YYYY-MM-DD
};

// ===== helpers =====
function isValidDateOnly(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addMonths(date: Date, months: number) {
  // evita errores con meses y fin de mes
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);

  // si el mes "saltó" (por ejemplo 31 → febrero), ajusta
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toMoneyDecimal(n: number) {
  return new Prisma.Decimal(round2(n));
}

// Amortización francesa: cuota fija
function buildSchedule(params: {
  principal: number;
  tasaAnual: number;     // %
  plazoMeses: number;
  startDate: Date;
}) {
  const P = params.principal;
  const n = params.plazoMeses;
  const r = (params.tasaAnual / 100) / 12; // tasa mensual

  if (n <= 0) throw new Error("plazoMeses debe ser mayor a 0");
  if (P <= 0) throw new Error("monto debe ser mayor a 0");
  if (params.tasaAnual < 0) throw new Error("tasaAnual no puede ser negativa");

  let cuota: number;
  if (r === 0) cuota = P / n;
  else {
    const pow = Math.pow(1 + r, n);
    cuota = (P * (r * pow)) / (pow - 1);
  }
  cuota = round2(cuota);

  let saldo = P;
  const out: Array<{
    numero: number;
    fechaVenc: Date;
    cuota: number;
    interes: number;
    capital: number;
    saldo: number;
  }> = [];

  for (let i = 1; i <= n; i++) {
    const interes = round2(saldo * r);
    let capital = round2(cuota - interes);

    // última cuota ajusta para cerrar saldo exacto
    if (i === n) {
      capital = round2(saldo);
    }
    const newSaldo = round2(saldo - capital);

    const fechaVenc = addMonths(params.startDate, i);

    out.push({
      numero: i,
      fechaVenc,
      cuota: round2(interes + capital),
      interes,
      capital,
      saldo: newSaldo,
    });

    saldo = newSaldo;
  }

  return out;
}

// ===== GET: listar préstamos (resumen) =====
export async function GET() {
  try {
    const prestamos = await prisma.prestamo.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
        ronda: { select: { id: true, nombre: true, activa: true, fechaInicio: true, fechaFin: true } },
        cuotas: {
          where: { pagada: false },
          orderBy: { fechaVenc: "asc" },
          take: 1, // próxima cuota
        },
      },
    });

    // serialización simple de Decimal
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
        nextPayment: next
          ? {
              cuotaId: next.id,
              fechaVenc: next.fechaVenc,
              cuota: Number(next.cuota),
            }
          : null,
      };
    });

    return NextResponse.json({ prestamos: normalized });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error al listar préstamos" },
      { status: 500 }
    );
  }
}

// ===== POST: crear préstamo + cuotas en ronda activa =====
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
    const tasaAnual = Number(body.tasaAnual);
    const plazoMeses = Number(body.plazoMeses);
    const fechaInicio = new Date(`${body.fechaInicio}T00:00:00`);

    const socio = await prisma.socio.findUnique({ where: { id: socioId } });
    if (!socio) throw new Error("Socio no existe");

    const rondaActiva = await prisma.ronda.findFirst({
      where: { activa: true },
      orderBy: { fechaInicio: "desc" },
    });
    if (!rondaActiva) throw new Error("No hay ronda activa. Crea/activa una ronda primero.");

    const schedule = buildSchedule({
      principal: monto,
      tasaAnual,
      plazoMeses,
      startDate: fechaInicio,
    });

    const result = await prisma.$transaction(async (tx) => {
      const prestamo = await tx.prestamo.create({
        data: {
          rondaId: rondaActiva.id,
          socioId,
          monto: toMoneyDecimal(monto),
          tasaAnual: new Prisma.Decimal(round2(tasaAnual)),
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

      const full = await tx.prestamo.findUnique({
        where: { id: prestamo.id },
        include: {
          socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } },
          ronda: { select: { id: true, nombre: true, activa: true, fechaInicio: true, fechaFin: true } },
          cuotas: { orderBy: { numero: "asc" } },
        },
      });

      return full!;
    });

    // normaliza decimales
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
    return NextResponse.json(
      { error: e?.message ?? "Error al crear préstamo" },
      { status: 400 }
    );
  }
}
