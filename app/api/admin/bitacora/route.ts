// app/api/admin/bitacora/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tabla   = searchParams.get("tabla");
    const accion  = searchParams.get("accion");
    const desde   = searchParams.get("desde");
    const hasta   = searchParams.get("hasta");
    const page    = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit   = Math.min(50, Math.max(10, Number(searchParams.get("limit") ?? 20)));

    const where: any = {};
    if (tabla)  where.tabla  = tabla;
    if (accion) where.accion = accion;
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(`${desde}T00:00:00Z`);
      if (hasta) where.createdAt.lte = new Date(`${hasta}T23:59:59Z`);
    }

    const [total, registros] = await Promise.all([
      (prisma as any).bitacora.count({ where }),
      (prisma as any).bitacora.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Enriquecer con info del registro modificado
    const enriched = await Promise.all(registros.map(async (b: any) => {
      let descripcionRegistro = "";
      try {
        if (b.tabla === "socios") {
          const s = await prisma.socio.findUnique({ where: { id: b.registroId }, select: { nombres: true, apellidos: true, numeroCuenta: true } });
          if (s) descripcionRegistro = `${s.nombres} ${s.apellidos} (${s.numeroCuenta})`;
        } else if (b.tabla === "rondas") {
          const r = await prisma.ronda.findUnique({ where: { id: b.registroId }, select: { nombre: true } });
          if (r) descripcionRegistro = r.nombre;
        } else if (b.tabla === "aportes") {
          const a = await prisma.aporte.findUnique({ where: { id: b.registroId }, include: { socio: { select: { nombres: true, apellidos: true } }, ronda: { select: { nombre: true } } } });
          if (a) descripcionRegistro = `Aporte sem.${a.semana} · ${a.socio.nombres} ${a.socio.apellidos} · ${a.ronda.nombre}`;
        } else if (b.tabla === "ahorros") {
          const a = await prisma.ahorro.findUnique({ where: { id: b.registroId }, include: { socio: { select: { nombres: true, apellidos: true } }, ronda: { select: { nombre: true } } } });
          if (a) descripcionRegistro = `Ahorro sem.${a.semana} · ${a.socio.nombres} ${a.socio.apellidos} · ${a.ronda.nombre}`;
        } else if (b.tabla === "prestamos") {
          const p = await prisma.prestamo.findUnique({ where: { id: b.registroId }, include: { socio: { select: { nombres: true, apellidos: true } }, ronda: { select: { nombre: true } } } });
          if (p) descripcionRegistro = `Préstamo $${Number(p.monto).toFixed(2)} · ${p.socio.nombres} ${p.socio.apellidos} · ${p.ronda.nombre}`;
        } else if (b.tabla === "prestamos_express") {
          const e = await (prisma as any).prestamoExpress.findUnique({ where: { id: b.registroId }, include: { socio: { select: { nombres: true, apellidos: true } }, ronda: { select: { nombre: true } } } });
          if (e) descripcionRegistro = `Express sem.${e.semana} · ${e.socio.nombres} ${e.socio.apellidos} · ${e.ronda.nombre} · ${e.estado}`;
        } else if (b.tabla === "movimientos_caja") {
          // Para registros eliminados, usar los campos_cambios guardados
          const cambios = b.camposCambios as any;
          // Intentar encontrar el registro aún vivo
          try {
            const m = await (prisma as any).movimientoCaja.findUnique({
              where: { id: b.registroId },
              include: { socio: { select: { nombres: true, apellidos: true } }, ronda: { select: { nombre: true } } },
            });
            if (m) {
              const tipoLabel = m.tipo === "MULTA" ? "Multa" : m.tipo === "INTERES_EXPRESS" ? "Interés express" : "Gasto";
              const socioNombre = m.socio ? `${m.socio.nombres} ${m.socio.apellidos}` : "";
              descripcionRegistro = `${tipoLabel} $${Number(m.monto).toFixed(2)} · ${socioNombre}${m.semana ? ` · Sem.${m.semana}` : ""} · ${m.ronda.nombre} · ${m.estado}`;
            } else {
              // Registro eliminado — usar datos de los cambios
              const montoAntes = cambios?.monto?.antes ?? cambios?.id?.antes ?? "?";
              descripcionRegistro = `Movimiento eliminado · ID #${b.registroId} · valor anterior: ${montoAntes}`;
            }
          } catch {
            descripcionRegistro = `Movimiento de caja #${b.registroId} (eliminado)`;
          }
        } else if (b.tabla === "movimientos_cuenta") {
          const m = await prisma.movimientoCuenta.findUnique({ where: { id: b.registroId }, include: { socio: { select: { nombres: true, apellidos: true } } } });
          if (m) descripcionRegistro = `${m.tipo} $${Number(m.monto).toFixed(2)} · ${m.socio.nombres} ${m.socio.apellidos}`;
        }
      } catch { descripcionRegistro = `ID #${b.registroId}`; }

      return { ...b, descripcionRegistro };
    }));

    return NextResponse.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      registros: enriched,
    });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
