// lib/movimiento-fondo.ts
import { Prisma } from "@prisma/client";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dec = (n: number) => new Prisma.Decimal(r2(n));

type TipoMovFondo =
  | "APORTE_INICIAL"
  | "PRESTAMO_OTORGADO"
  | "CUOTA_CAPITAL"
  | "CUOTA_INTERES"
  | "DEVOLUCION_CIERRE";

interface CrearMovFondoParams {
  rondaId: number;
  tipo: TipoMovFondo;
  monto: number;
  prestamoId?: number | null;
  cuotaId?: number | null;
  nota?: string | null;
}

export async function crearMovimientoFondo(
  tx: Prisma.TransactionClient,
  params: CrearMovFondoParams
) {
  const ultimo = await tx.movimientoFondo.findFirst({
    where: { rondaId: params.rondaId },
    orderBy: { id: "desc" },
    select: { saldoDespues: true },
  });

  const saldoAntes = r2(Number(ultimo?.saldoDespues ?? 0));

  const esIngreso = ["APORTE_INICIAL", "CUOTA_CAPITAL", "CUOTA_INTERES"].includes(params.tipo);
  const saldoDespues = esIngreso
    ? r2(saldoAntes + params.monto)
    : r2(saldoAntes - params.monto);

  const mov = await tx.movimientoFondo.create({
    data: {
      rondaId: params.rondaId,
      tipo: params.tipo,
      monto: dec(params.monto),
      saldoAntes: dec(saldoAntes),
      saldoDespues: dec(saldoDespues),
      prestamoId: params.prestamoId ?? null,
      cuotaId: params.cuotaId ?? null,
      nota: params.nota ?? null,
    },
  });

  return mov;
}
