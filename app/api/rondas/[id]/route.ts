// app/api/rondas/[id]/semana/[semana]/aportes/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // ajusta si tu prisma client está en otra ruta

function toRD(n: number) {
  return `RD${String(n).padStart(4, "0")}`;
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const rondaId = Number(params.id);
  if (!Number.isFinite(rondaId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1) Eliminar cuotas de préstamos de esta ronda
      // (porque PrestamoCuota depende de Prestamo)
      await tx.prestamoCuota.deleteMany({
        where: { prestamo: { rondaId } },
      });

      // 2) Eliminar préstamos (amortización)
      await tx.prestamo.deleteMany({ where: { rondaId } });

      // 3) Eliminar préstamos express (si los usas)
      await tx.prestamoExpress.deleteMany({ where: { rondaId } });

      // 4) Eliminar aportes / ahorros
      await tx.aporte.deleteMany({ where: { rondaId } });
      await tx.ahorro.deleteMany({ where: { rondaId } });

      // 5) Eliminar responsables por semana
      await tx.responsableCobroSemana.deleteMany({ where: { rondaId } });

      // 6) Eliminar participaciones
      await tx.participacion.deleteMany({ where: { rondaId } });

      // 7) Eliminar ronda
      await tx.ronda.delete({ where: { id: rondaId } });

      // 8) Re-secuenciar RD0001.. en el campo "nombre"
      // Si tú tienes un campo distinto (ej: codigo), aquí lo cambias.
      const restantes = await tx.ronda.findMany({
        orderBy: [{ id: "asc" }], // o fechaInicio asc si prefieres
        select: { id: true },
      });

      for (let i = 0; i < restantes.length; i++) {
        await tx.ronda.update({
          where: { id: restantes[i].id },
          data: { nombre: toRD(i + 1) },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "No se pudo eliminar la ronda" },
      { status: 500 }
    );
  }
}

