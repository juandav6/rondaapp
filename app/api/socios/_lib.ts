// app/api/socios/_lib.ts
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Devuelve el id de la ronda técnica de saldos iniciales.
 * Si no existe, la crea automáticamente (código RD0000 si tu schema lo tiene).
 */
export async function getOrCreateRondaInicial(): Promise<number> {
  // busca por nombre (o codigo si lo tienes)
  const existente = await prisma.ronda.findFirst({
    where: { activa: false, nombre: "Saldo inicial" },
    select: { id: true },
  });

  if (existente && existente.id) {
    return existente.id;
  }

  // crearla si no existe
  const creada = await prisma.ronda.create({
    data: {
      nombre: "Saldo inicial",
      activa: false,
      montoAporte: new Prisma.Decimal(0),
      fechaInicio: new Date("2000-01-01"),
      fechaFin: new Date("2000-01-01"),
      semanaActual: 0,
      ahorroObjetivoPorSocio: new Prisma.Decimal(0),
    },
    select: { id: true },
  });

  return creada.id;
}
