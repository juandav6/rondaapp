// lib/bitacora.ts
// Helper para registrar cambios en la bitácora del sistema

import prisma from "@/lib/prisma";

export type Accion = "CREAR" | "EDITAR" | "ELIMINAR";

export interface CambiosCadena {
  tabla: string;
  registroId: number;
  descripcion: string;
  camposAfectados?: Record<string, { antes: any; despues: any }>;
}

export async function registrarBitacora(params: {
  tabla: string;
  registroId: number;
  accion: Accion;
  camposCambios: Record<string, { antes: any; despues: any }>;
  efectosCadena?: CambiosCadena[];
  usuario?: string;
  ip?: string;
}) {
  try {
    await (prisma as any).bitacora.create({
      data: {
        tabla: params.tabla,
        registroId: params.registroId,
        accion: params.accion,
        camposCambios: params.camposCambios,
        efectosCadena: params.efectosCadena ?? null,
        usuario: params.usuario ?? "admin",
        ip: params.ip ?? null,
      },
    });
  } catch (e) {
    // No fallar si la bitácora falla — es secundaria
    console.error("[Bitácora] Error registrando cambio:", e);
  }
}

// Compara dos objetos y retorna solo los campos que cambiaron
export function diffObjetos(
  antes: Record<string, any>,
  despues: Record<string, any>
): Record<string, { antes: any; despues: any }> {
  const diff: Record<string, { antes: any; despues: any }> = {};
  const keys = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  keys.forEach(k => {
    const a = antes[k];
    const d = despues[k];
    // Comparación simple con toString para manejar Decimal
    if (String(a) !== String(d)) {
      diff[k] = { antes: a, despues: d };
    }
  });
  return diff;
}
