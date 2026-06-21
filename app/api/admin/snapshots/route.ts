// app/api/admin/snapshots/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { crearSnapshot } from "@/lib/snapshots";
import { registrarBitacora } from "@/lib/bitacora";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rondaId = searchParams.get("rondaId");

  try {
    const where: any = {};
    if (rondaId) where.rondaId = Number(rondaId);

    const snapshots = await (prisma as any).snapshotRonda.findMany({
      where,
      select: {
        id: true, rondaId: true, semana: true, nombre: true,
        tipo: true, createdAt: true,
        ronda: { select: { nombre: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      snapshots: snapshots.map((s: any) => ({
        ...s,
        tamanoEstimado: null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { rondaId, nombre } = await req.json();
    if (!rondaId) return NextResponse.json({ error: "rondaId requerido" }, { status: 400 });

    const ronda = await prisma.ronda.findUnique({ where: { id: Number(rondaId) } });
    if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

    const nombreFinal = nombre?.trim() || `Backup manual · semana ${ronda.semanaActual}`;

    const snapshot = await prisma.$transaction(async (tx) => {
      return crearSnapshot(tx, Number(rondaId), nombreFinal, "MANUAL");
    }, { timeout: 30000 });

    await registrarBitacora({
      tabla: "snapshots_ronda", registroId: snapshot.id, accion: "CREAR",
      camposCambios: { nombre: { antes: null, despues: nombreFinal }, semana: { antes: null, despues: ronda.semanaActual } },
    });

    return NextResponse.json({ ok: true, snapshot: { id: snapshot.id, nombre: nombreFinal, semana: ronda.semanaActual } }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
