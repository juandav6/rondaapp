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

    const [aportes, ahorros, responsable, ahorrosParciales] = await Promise.all([
      prisma.aporte.findMany({ where: { rondaId, semana, socioId: { in: socioIds } } }),
      prisma.ahorro.findMany({ where: { rondaId, semana, socioId: { in: socioIds } } }),
      prisma.responsableCobroSemana.findFirst({
        where: { rondaId, semana },
        include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
      }),
      // Socios parciales: tienen ahorro en esta ronda pero NO son participantes
      prisma.socio.findMany({
        where: {
          // activo filter pending prisma generate
          id: { notIn: socioIds.length > 0 ? socioIds : [-1] },
        },
        select: {
          id: true, nombres: true, apellidos: true, numeroCuenta: true,
          ahorros: { where: { rondaId, semana }, select: { monto: true } },
        },
        orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      }),
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

    return NextResponse.json({
      rondaId, semana, rows,
      rowsParciales: ahorrosParciales.map(s => ({
        socioId: s.id,
        numeroCuenta: s.numeroCuenta,
        nombres: s.nombres,
        apellidos: s.apellidos,
        ahorroSemana: Number(s.ahorros[0]?.monto ?? 0),
      })),
      responsableId: responsable?.socioId ?? null,
      responsableNombre: responsable ? `${responsable.socio.nombres} ${responsable.socio.apellidos}` : null,
      socios: participaciones.map(p => ({
        id: p.socioId, nombres: p.socio.nombres, apellidos: p.socio.apellidos,
        numeroCuenta: p.socio.numeroCuenta, orden: p.orden,
      })),
    });
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
    const updatesParciales = Array.isArray(body?.updatesParciales) ? body.updatesParciales : [];
    const responsableId = body?.responsableId ?? null;
    if (!updates)
      return NextResponse.json({ error: "updates requerido" }, { status: 400 });

    for (const u of updates) {
      if (!u || !Number.isFinite(Number(u.socioId)))
        return NextResponse.json({ error: "socioId inválido en updates" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Participantes: aporte + ahorro
      for (const u of updates) {
        const socioId = Number(u.socioId);
        const aporteSemana = toDecimal(u.aporteSemana);
        const ahorroNuevo = toDecimal(u.ahorroSemana);
        const multaSemana = toDecimal(u.multaSemana ?? 0);
        const montoNuevo = Number(ahorroNuevo);

        await tx.aporte.upsert({
          where: { rondaId_socioId_semana: { rondaId, socioId, semana } },
          update: { monto: aporteSemana, multa: multaSemana },
          create: { rondaId, socioId, semana, monto: aporteSemana, multa: multaSemana, observaciones: "" },
        });

        // Solo hacer upsert de ahorro si el monto es mayor a 0
        const ahorroAnterior = await tx.ahorro.findUnique({
          where: { rondaId_socioId_semana: { rondaId, socioId, semana } },
          select: { monto: true },
        });
        const montoAnterior = Number(ahorroAnterior?.monto ?? 0);
        const delta = montoNuevo - montoAnterior;

        if (montoNuevo > 0) {
          await tx.ahorro.upsert({
            where: { rondaId_socioId_semana: { rondaId, socioId, semana } },
            update: { monto: ahorroNuevo },
            create: { rondaId, socioId, semana, monto: ahorroNuevo, observaciones: "" },
          });
        } else if (montoAnterior > 0 && ahorroAnterior) {
          // Si el nuevo es 0 y antes había valor, eliminar el registro
          await tx.ahorro.delete({
            where: { rondaId_socioId_semana: { rondaId, socioId, semana } },
          });
        }

        // Sincronizar MovimientoCuenta tipo AHORRO de esta semana/ronda
        if (Math.abs(delta) > 0.001) {
          const movExistente = await tx.movimientoCuenta.findFirst({
            where: { socioId, rondaId, tipo: "AHORRO",
              OR: [
                { nota: { contains: `semana ${semana} ·` } },
                { nota: { endsWith: `semana ${semana}` } },
              ],
            },
          });
          if (montoNuevo <= 0) {
            // Si el nuevo monto es 0, eliminar el movimiento
            if (movExistente) {
              await tx.movimientoCuenta.delete({ where: { id: movExistente.id } });
            }
          } else if (movExistente) {
            await tx.movimientoCuenta.update({
              where: { id: movExistente.id },
              data: { monto: new Prisma.Decimal(montoNuevo) },
            });
          } else {
            await tx.movimientoCuenta.create({
              data: { socioId, rondaId, tipo: "AHORRO", monto: new Prisma.Decimal(montoNuevo),
                nota: `Ahorro semana ${semana} · ronda ${rondaId}` },
            });
          }
          // Ajustar saldoAhorros por el delta
          await tx.socio.update({
            where: { id: socioId },
            data: { saldoAhorros: { increment: new Prisma.Decimal(delta.toFixed(2)) } },
          });
        }
      }

      // Socios parciales: solo ahorro
      for (const u of updatesParciales) {
        const socioId = Number(u.socioId);
        if (!Number.isFinite(socioId)) continue;
        const ahorroNuevo = toDecimal(u.ahorroSemana);
        const montoNuevo = Number(ahorroNuevo);

        const ahorroAnterior = await tx.ahorro.findUnique({
          where: { rondaId_socioId_semana: { rondaId, socioId, semana } },
          select: { monto: true },
        });
        const montoAnterior = Number(ahorroAnterior?.monto ?? 0);
        const delta = montoNuevo - montoAnterior;

        await tx.ahorro.upsert({
          where: { rondaId_socioId_semana: { rondaId, socioId, semana } },
          update: { monto: ahorroNuevo },
          create: { rondaId, socioId, semana, monto: ahorroNuevo, observaciones: "" },
        });

        if (Math.abs(delta) > 0.001) {
          const movExistente = await tx.movimientoCuenta.findFirst({
            where: { socioId, rondaId, tipo: "AHORRO",
              OR: [
                { nota: { contains: `semana ${semana} ·` } },
                { nota: { endsWith: `semana ${semana}` } },
              ],
            },
          });
          if (montoNuevo <= 0) {
            if (movExistente) {
              await tx.movimientoCuenta.delete({ where: { id: movExistente.id } });
            }
          } else if (movExistente) {
            await tx.movimientoCuenta.update({
              where: { id: movExistente.id },
              data: { monto: new Prisma.Decimal(montoNuevo) },
            });
          } else {
            await tx.movimientoCuenta.create({
              data: { socioId, rondaId, tipo: "AHORRO", monto: new Prisma.Decimal(montoNuevo),
                nota: `Ahorro semana ${semana} · ronda ${rondaId}` },
            });
          }
          await tx.socio.update({
            where: { id: socioId },
            data: { saldoAhorros: { increment: new Prisma.Decimal(delta.toFixed(2)) } },
          });
        }
      }

      // Actualizar responsable de la semana si se proporcionó
      if (responsableId !== null) {
        await tx.responsableCobroSemana.upsert({
          where: { rondaId_semana: { rondaId, semana } },
          update: { socioId: Number(responsableId) },
          create: { rondaId, semana, socioId: Number(responsableId) },
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
