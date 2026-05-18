// app/api/rondas/[id]/semanas/[semana]/detalle/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();

function toDecimal(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return new Prisma.Decimal(0);
  return new Prisma.Decimal(v.toFixed(2));
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string; semana: string } }
) {
  try {
    const rondaId = Number(params.id);
    const semana = Number(params.semana);
    if (!Number.isFinite(rondaId) || rondaId <= 0)
      return NextResponse.json({ error: "rondaId inválido" }, { status: 400 });
    if (!Number.isFinite(semana) || semana <= 0)
      return NextResponse.json({ error: "semana inválida" }, { status: 400 });

    const participaciones = await prisma.participacion.findMany({
      where: { rondaId, activo: true },
      include: { socio: true },
      orderBy: { orden: "asc" },
    });

    const socioIds = participaciones.map((p) => p.socioId);

    const [aportes, ahorros] = await Promise.all([
      prisma.aporte.findMany({ where: { rondaId, semana, socioId: { in: socioIds } } }),
      prisma.ahorro.findMany({ where: { rondaId, semana, socioId: { in: socioIds } } }),
    ]);

    const aporteBySocio = new Map<number, { monto: Prisma.Decimal; multa: Prisma.Decimal }>();
    aportes.forEach((a) => aporteBySocio.set(a.socioId, { monto: a.monto, multa: a.multa }));

    const ahorroBySocio = new Map<number, Prisma.Decimal>();
    ahorros.forEach((a) => ahorroBySocio.set(a.socioId, a.monto));

    const rows = participaciones.map((p) => {
      const ap = aporteBySocio.get(p.socioId);
      const ah = ahorroBySocio.get(p.socioId);
      return {
        socioId: p.socioId,
        orden: p.orden,
        numeroCuenta: p.socio.numeroCuenta,
        nombres: p.socio.nombres,
        apellidos: p.socio.apellidos,
        aporteSemana: Number(ap?.monto ?? 0),
        multaSemana: Number(ap?.multa ?? 0),
        ahorroSemana: Number(ah ?? 0),
      };
    });

    return NextResponse.json({ rondaId, semana, rows });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error al obtener detalle semanal" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string; semana: string } }
) {
  try {
    const rondaId = Number(params.id);
    const semana = Number(params.semana);
    if (!Number.isFinite(rondaId) || rondaId <= 0)
      return NextResponse.json({ error: "rondaId inválido" }, { status: 400 });
    if (!Number.isFinite(semana) || semana <= 0)
      return NextResponse.json({ error: "semana inválida" }, { status: 400 });

    const body = await req.json().catch(() => null);
    const updates = Array.isArray(body?.updates) ? body.updates : null;
    if (!updates)
      return NextResponse.json({ error: "updates requerido" }, { status: 400 });

    for (const u of updates) {
      if (!u || !Number.isFinite(Number(u.socioId)))
        return NextResponse.json({ error: "socioId inválido en updates" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        const socioId = Number(u.socioId);
        const aporteSemana = toDecimal(u.aporteSemana);
        const ahorroSemana = toDecimal(u.ahorroSemana);
        const multaSemana = toDecimal(u.multaSemana ?? 0); // ← nuevo

        // Aporte: upsert con multa
        await tx.aporte.upsert({
          where: { rondaId_socioId_semana: { rondaId, socioId, semana } },
          update: {
            monto: aporteSemana,
            multa: multaSemana, // ← actualiza la multa
          },
          create: {
            rondaId, socioId, semana,
            monto: aporteSemana,
            multa: multaSemana,
            observaciones: "",
          },
        });

        // Ahorro: upsert
        await tx.ahorro.upsert({
          where: { rondaId_socioId_semana: { rondaId, socioId, semana } },
          update: { monto: ahorroSemana },
          create: { rondaId, socioId, semana, monto: ahorroSemana, observaciones: "" },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error al actualizar detalle semanal" },
      { status: 500 }
    );
  }
}
