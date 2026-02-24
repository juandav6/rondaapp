// app/api/rondas/[id]/semanas/[semana]/detalle/route.ts
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type Params = { params: { id: string; semana: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const rondaId = Number(params.id);
    const semana = Number(params.semana);
    if (!Number.isFinite(rondaId) || !Number.isFinite(semana) || semana <= 0) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    // Traemos participantes para listar todos los socios de la ronda
    const participaciones = await prisma.participacion.findMany({
      where: { rondaId, activo: true },
      include: { socio: true },
      orderBy: { orden: "asc" },
    });

    // Traemos aportes/ahorros de esa semana
    const [aportes, ahorros] = await Promise.all([
      prisma.aporte.findMany({
        where: { rondaId, semana },
        select: { socioId: true, monto: true },
      }),
      prisma.ahorro.findMany({
        where: { rondaId, semana },
        select: { socioId: true, monto: true },
      }),
    ]);

    const mapAporte = new Map(aportes.map((a) => [a.socioId, Number(a.monto)]));
    const mapAhorro = new Map(ahorros.map((a) => [a.socioId, Number(a.monto)]));

    const items = participaciones.map((p) => ({
      socioId: p.socioId,
      nombres: p.socio.nombres,
      apellidos: p.socio.apellidos,
      numeroCuenta: p.socio.numeroCuenta,
      aporte: mapAporte.get(p.socioId) ?? 0,
      ahorro: mapAhorro.get(p.socioId) ?? 0,
    }));

    return NextResponse.json({ rondaId, semana, items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const rondaId = Number(params.id);
    const semana = Number(params.semana);
    if (!Number.isFinite(rondaId) || !Number.isFinite(semana) || semana <= 0) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const items: Array<{ socioId: number; aporte: number; ahorro: number }> = Array.isArray(body?.items)
      ? body.items
      : [];

    if (!items.length) {
      return NextResponse.json({ error: "No hay cambios para guardar" }, { status: 400 });
    }

    // Validar que el socio pertenezca a la ronda
    const sociosIds = items.map((x) => Number(x.socioId)).filter((x) => Number.isFinite(x));
    const participaciones = await prisma.participacion.findMany({
      where: { rondaId, socioId: { in: sociosIds }, activo: true },
      select: { socioId: true },
    });
    const allowed = new Set(participaciones.map((p) => p.socioId));

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const socioId = Number(it.socioId);
        if (!allowed.has(socioId)) continue;

        const aporte = Number(it.aporte);
        const ahorro = Number(it.ahorro);

        // Aporte (upsert por unique: [rondaId, socioId, semana])
        await tx.aporte.upsert({
          where: { rondaId_socioId_semana: { rondaId, socioId, semana } },
          create: {
            rondaId,
            socioId,
            semana,
            monto: new Prisma.Decimal(Number.isFinite(aporte) ? aporte : 0),
            multa: new Prisma.Decimal(0),
            observaciones: "Editado desde detalle semanal",
            fecha: now,
          },
          update: {
            monto: new Prisma.Decimal(Number.isFinite(aporte) ? aporte : 0),
            fecha: now,
          },
        });

        // Ahorro (upsert por unique: [rondaId, socioId, semana])
        await tx.ahorro.upsert({
          where: { rondaId_socioId_semana: { rondaId, socioId, semana } },
          create: {
            rondaId,
            socioId,
            semana,
            monto: new Prisma.Decimal(Number.isFinite(ahorro) ? ahorro : 0),
            observaciones: "Editado desde detalle semanal",
            fecha: now,
          },
          update: {
            monto: new Prisma.Decimal(Number.isFinite(ahorro) ? ahorro : 0),
            fecha: now,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

