// app/api/rondas/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function toRD(n: number) {
  return `RD${String(n).padStart(4, "0")}`;
}

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, context: Context) {
  const { params } = await context;
  const rondaId = Number((await params).id);

  if (!Number.isFinite(rondaId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const ronda = await prisma.ronda.findUnique({ where: { id: rondaId } });
  if (!ronda) {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {

      // ── 1. Devolver inversiones no devueltas → saldoAhorros ──────────────
      const cuentas = await tx.cuentaInversion.findMany({
        where: { rondaId, devuelto: false },
        select: { socioId: true, montoInvertido: true },
      });
      for (const c of cuentas) {
        if (Number(c.montoInvertido) > 0) {
          await tx.socio.update({
            where: { id: c.socioId },
            data: { saldoAhorros: { increment: c.montoInvertido } },
          });
        }
      }

      // ── 2. Revertir ahorros semanales de esta ronda → descontar saldoAhorros ──
      // (solo los que se sumaron via la nueva API que hace increment)
      // Agrupamos por socio para hacer un solo update por socio
      const ahorrosPorSocio = await tx.ahorro.groupBy({
        by: ["socioId"],
        where: { rondaId },
        _sum: { monto: true },
      });
      for (const a of ahorrosPorSocio) {
        const totalAhorro = Number(a._sum.monto ?? 0);
        if (totalAhorro > 0) {
          // Descontar — aseguramos que no quede negativo
          await tx.socio.update({
            where: { id: a.socioId },
            data: {
              saldoAhorros: {
                decrement: totalAhorro,
              },
            },
          });
        }
      }

      // ── 3. Eliminar movimientos de cuenta ─────────────────────────────────
      await tx.movimientoCuenta.deleteMany({ where: { rondaId } });

      // ── 4. Eliminar cuentas de inversión ──────────────────────────────────
      await tx.cuentaInversion.deleteMany({ where: { rondaId } });

      // ── 5. Eliminar cuotas de préstamos ───────────────────────────────────
      await tx.prestamoCuota.deleteMany({
        where: { prestamo: { rondaId } },
      });

      // ── 6. Eliminar préstamos ─────────────────────────────────────────────
      await tx.prestamo.deleteMany({ where: { rondaId } });

      // ── 7. Eliminar préstamos express ─────────────────────────────────────
      await tx.prestamoExpress.deleteMany({ where: { rondaId } }).catch(() => {});

      // ── 8. Eliminar aportes ───────────────────────────────────────────────
      await tx.aporte.deleteMany({ where: { rondaId } });

      // ── 9. Eliminar ahorros ───────────────────────────────────────────────
      await tx.ahorro.deleteMany({ where: { rondaId } });

      // ── 10. Eliminar responsables de cobro ────────────────────────────────
      await tx.responsableCobroSemana.deleteMany({ where: { rondaId } });

      // ── 11. Eliminar participaciones ──────────────────────────────────────
      await tx.participacion.deleteMany({ where: { rondaId } });

      // ── 12. Eliminar la ronda ─────────────────────────────────────────────
      await tx.ronda.delete({ where: { id: rondaId } });

      // ── 13. Re-secuenciar RD0001… ─────────────────────────────────────────
      const restantes = await tx.ronda.findMany({
        orderBy: { id: "asc" },
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
    console.error("[DELETE ronda]", e);
    return NextResponse.json(
      { error: e?.message ?? "No se pudo eliminar la ronda" },
      { status: 500 }
    );
  }
}
