// app/api/reportes/consolidado/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const fmt$ = '"$"#,##0.00';

function styleHeader(row: ExcelJS.Row, cols: number, argb = "FF1e3a5f") {
  for (let c = 1; c <= cols; c++) {
    row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    row.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    row.getCell(c).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  row.height = 22;
}

function styleTotals(row: ExcelJS.Row, cols: number) {
  for (let c = 1; c <= cols; c++) {
    row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
    row.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    if (c > 1) row.getCell(c).numFmt = fmt$;
  }
  row.height = 18;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const socioIds: number[] | null = body?.socioIds ?? null;

    // ── Rondas cerradas ──────────────────────────────────────────────────────
    const rondas = await prisma.ronda.findMany({
      where: { activa: false },
      orderBy: { fechaInicio: "asc" },
      select: { id: true, nombre: true, fechaInicio: true, fechaFin: true, ahorroObjetivoPorSocio: true },
    });

    // ── Socios ───────────────────────────────────────────────────────────────
    const socios = await prisma.socio.findMany({
      where: socioIds ? { id: { in: socioIds } } : undefined,
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, saldoAhorros: true },
    });

    // ── Pre-cargar datos de todas las rondas ─────────────────────────────────
    type DatoRonda = {
      aportes: number; multas: number; ahorros: number; pendienteAhorro: number;
      depositos: number; retiros: number;
      prestamos: number; interesesCobrados: number; express: number;
      invertido: number; interesGanado: number; devuelto: number;
    };

    // Mapa: socioId → rondaId → datos
    const datos = new Map<number, Map<number, DatoRonda>>();
    socios.forEach(s => datos.set(s.id, new Map()));

    for (const ronda of rondas) {
      const objetivo = Number(ronda.ahorroObjetivoPorSocio ?? 0);

      const [aportes, ahorros, prestamos, express, cuentas, retirosQ, depositosQ] = await Promise.all([
        prisma.aporte.groupBy({
          by: ["socioId"], where: { rondaId: ronda.id },
          _sum: { monto: true, multa: true },
        }),
        prisma.ahorro.groupBy({
          by: ["socioId"], where: { rondaId: ronda.id },
          _sum: { monto: true },
        }),
        prisma.prestamo.findMany({
          where: { rondaId: ronda.id },
          select: { socioId: true, monto: true, cuotas: { select: { interes: true, pagada: true } } },
        }),
        prisma.prestamoExpress.groupBy({
          by: ["socioId"], where: { rondaId: ronda.id },
          _sum: { principal: true },
        }),
        prisma.cuentaInversion.findMany({
          where: { rondaId: ronda.id },
          select: { socioId: true, montoInvertido: true, interesesAcumulados: true },
        }),
        // Depósitos libres y retiros dentro del rango de fechas de la ronda
        prisma.movimientoCuenta.groupBy({
          by: ["socioId", "tipo"],
          where: {
            tipo: { in: ["RETIRO"] },
            createdAt: {
              gte: ronda.fechaInicio,
              lte: ronda.fechaFin ?? new Date(),
            },
          },
          _sum: { monto: true },
        }),
        // Depósitos libres (AHORRO sin rondaId o con nota "libre")
        prisma.movimientoCuenta.groupBy({
          by: ["socioId"],
          where: {
            tipo: "AHORRO",
            createdAt: {
              gte: ronda.fechaInicio,
              lte: ronda.fechaFin ?? new Date(),
            },
            OR: [
              { rondaId: null },
              { nota: { contains: "libre" } },
            ],
          },
          _sum: { monto: true },
        }),
      ]);

      const aportesMap  = new Map(aportes.map(a  => [a.socioId, a._sum]));
      const ahorrosMap  = new Map(ahorros.map(a  => [a.socioId, Number(a._sum.monto ?? 0)]));
      const expressMap  = new Map(express.map(e  => [e.socioId, Number(e._sum.principal ?? 0)]));
      const cuentasMap  = new Map(cuentas.map(c  => [c.socioId, c]));
      const retirosMap  = new Map(retirosQ.map(r  => [r.socioId, Number(r._sum.monto ?? 0)]));
      const depositosMap = new Map(depositosQ.map(d => [d.socioId, Number(d._sum.monto ?? 0)]));

      for (const socio of socios) {
        const sid = socio.id;
        const ap  = aportesMap.get(sid);
        const ah  = ahorrosMap.get(sid) ?? 0;
        const pr  = prestamos.filter(p => p.socioId === sid);
        const ci  = cuentasMap.get(sid);

        const datoMap = datos.get(sid)!;
        datoMap.set(ronda.id, {
          aportes:           Number(ap?.monto ?? 0),
          multas:            Number(ap?.multa ?? 0),
          ahorros:           ah,
          depositos:         depositosMap.get(sid) ?? 0,
          retiros:           retirosMap.get(sid) ?? 0,
          pendienteAhorro:   objetivo > 0 ? Math.max(objetivo - ah, 0) : 0,
          prestamos:         pr.reduce((s, p) => s + Number(p.monto), 0),
          interesesCobrados: pr.reduce((s, p) =>
            s + p.cuotas.filter(c => c.pagada).reduce((a, c) => a + Number(c.interes), 0), 0),
          express:           expressMap.get(sid) ?? 0,
          invertido:         ci ? Number(ci.montoInvertido) : 0,
          interesGanado:     ci ? Number(ci.interesesAcumulados) : 0,
          devuelto:          ci ? Number(ci.montoInvertido) + Number(ci.interesesAcumulados) : 0,
        });
      }
    }

    // ── Columnas por ronda ───────────────────────────────────────────────────
    const COLS = [
      { key: "aportes",           label: "Aportes",         argb: "FF2563eb" },
      { key: "multas",            label: "Multas",          argb: "FFDC2626" },
      { key: "ahorros",           label: "Ahorros",         argb: "FF16a34a" },
      { key: "depositos",         label: "Depósitos",       argb: "FF0891b2" },
      { key: "retiros",           label: "Retiros",         argb: "FFbe185d" },
      { key: "pendienteAhorro",   label: "Pend. Ahorro",    argb: "FFd97706" },
      { key: "prestamos",         label: "Préstamos",       argb: "FF7c3aed" },
      { key: "interesesCobrados", label: "Int. Préstamo",   argb: "FFd97706" },
      { key: "express",           label: "Express",         argb: "FFea580c" },
      { key: "invertido",         label: "Invertido",       argb: "FF2563eb" },
      { key: "interesGanado",     label: "Int. Ganado",     argb: "FF16a34a" },
      { key: "devuelto",          label: "Total Recibido",  argb: "FF16a34a" },
    ] as const;

    const NUM_COLS = 1 + COLS.length; // Ronda + campos

    // ── Workbook ─────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = "MiRonda";
    wb.created = new Date();

    // ── Una hoja por socio ───────────────────────────────────────────────────
    for (const socio of socios) {
      const nombreHoja = `${socio.numeroCuenta}-${socio.apellidos.slice(0,12)}`.replace(/[\\/?*[\]:]/g,"").slice(0, 31);
      const ws = wb.addWorksheet(nombreHoja);

      ws.getColumn(1).width = 14; // Ronda
      COLS.forEach((_, i) => { ws.getColumn(i + 2).width = 13; });

      // Título socio
      ws.mergeCells(1, 1, 1, NUM_COLS);
      const title = ws.getCell("A1");
      title.value = `${socio.apellidos}, ${socio.nombres}  ·  ${socio.numeroCuenta}`;
      title.font  = { bold: true, size: 12, color: { argb: "FF1e3a5f" } };
      title.alignment = { horizontal: "left" };
      ws.getRow(1).height = 22;

      ws.mergeCells(2, 1, 2, NUM_COLS);
      ws.getCell("A2").value = `Saldo actual: $${Number(socio.saldoAhorros).toFixed(2)}  ·  Generado: ${new Date().toLocaleDateString("es-EC")}`;
      ws.getCell("A2").font = { size: 9, color: { argb: "FF6b7280" } };
      ws.addRow([]);

      // Header
      const hRow = ws.addRow(["Ronda", ...COLS.map(c => c.label)]);
      hRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
      hRow.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      COLS.forEach((col, i) => {
        const cell = hRow.getCell(i + 2);
        cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: col.argb } };
        cell.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
        cell.alignment = { horizontal: "center", wrapText: true };
      });
      hRow.height = 24;

      // Filas por ronda
      const totales = Object.fromEntries(COLS.map(c => [c.key, 0])) as Record<string, number>;
      rondas.forEach((ronda, ri) => {
        const d = datos.get(socio.id)?.get(ronda.id);
        const valores = COLS.map(c => Number((d as any)?.[c.key] ?? 0));
        const row = ws.addRow([ronda.nombre, ...valores]);

        const bg = ri % 2 === 0 ? "FFF9FAFB" : "FFFFFFFF";
        row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        row.getCell(1).font = { bold: true, size: 9 };
        valores.forEach((val, vi) => {
          const cell = row.getCell(vi + 2);
          cell.value  = val;
          cell.numFmt = fmt$;
          cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
          cell.font   = { size: 9 };
          cell.alignment = { horizontal: "right" };
          totales[COLS[vi].key] += val;
        });
      });

      // Fila totales
      ws.addRow([]);
      const tRow = ws.addRow(["TOTAL", ...COLS.map(c => totales[c.key])]);
      styleTotals(tRow, NUM_COLS);
      tRow.getCell(1).alignment = { horizontal: "left" };
    }

    // ── Hoja resumen consolidado (todos los socios) ──────────────────────────
    const wsRes = wb.addWorksheet("Resumen consolidado");
    wsRes.getColumn(1).width = 30;
    wsRes.getColumn(2).width = 12;
    COLS.forEach((_, i) => { wsRes.getColumn(i + 3).width = 13; });

    wsRes.mergeCells(1, 1, 1, 2 + COLS.length);
    const resTitle = wsRes.getCell("A1");
    resTitle.value = `RESUMEN CONSOLIDADO · ${socios.length} socios · ${rondas.length} rondas · ${new Date().toLocaleDateString("es-EC")}`;
    resTitle.font  = { bold: true, size: 12, color: { argb: "FF1e3a5f" } };
    resTitle.alignment = { horizontal: "center" };
    wsRes.getRow(1).height = 22;
    wsRes.addRow([]);

    // Header resumen
    const resH = wsRes.addRow(["Socio", "Cuenta", ...COLS.map(c => c.label)]);
    resH.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
    resH.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    resH.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
    resH.getCell(2).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    COLS.forEach((col, i) => {
      const cell = resH.getCell(i + 3);
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: col.argb } };
      cell.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      cell.alignment = { horizontal: "center", wrapText: true };
    });
    resH.height = 24;

    const grandTotales = Object.fromEntries(COLS.map(c => [c.key, 0])) as Record<string, number>;

    socios.forEach((socio, si) => {
      const totSocio = Object.fromEntries(COLS.map(c => [c.key, 0])) as Record<string, number>;
      rondas.forEach(ronda => {
        const d = datos.get(socio.id)?.get(ronda.id);
        COLS.forEach(col => {
          totSocio[col.key] += Number((d as any)?.[col.key] ?? 0);
        });
      });
      COLS.forEach(col => { grandTotales[col.key] += totSocio[col.key]; });

      const bg = si % 2 === 0 ? "FFF9FAFB" : "FFFFFFFF";
      const row = wsRes.addRow([
        `${socio.apellidos}, ${socio.nombres}`,
        socio.numeroCuenta,
        ...COLS.map(c => totSocio[c.key]),
      ]);
      for (let c = 1; c <= 2 + COLS.length; c++) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        row.getCell(c).font = { size: 9 };
        if (c > 2) { row.getCell(c).numFmt = fmt$; row.getCell(c).alignment = { horizontal: "right" }; }
      }
    });

    wsRes.addRow([]);
    const grandRow = wsRes.addRow(["TOTAL GENERAL", "", ...COLS.map(c => grandTotales[c.key])]);
    styleTotals(grandRow, 2 + COLS.length);

    // ── Exportar ─────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="consolidado-${new Date().toISOString().slice(0,10)}.xlsx"`,
      },
    });

  } catch (err: any) {
    console.error("Error consolidado:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
