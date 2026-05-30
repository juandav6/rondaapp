// app/api/reportes/consolidado/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const socioIds: number[] | null = body?.socioIds ?? null; // null = todos

    // ── Cargar todas las rondas cerradas ────────────────────────────────────
    const rondas = await prisma.ronda.findMany({
      where: { activa: false },
      orderBy: { fechaInicio: "asc" },
      select: { id: true, nombre: true, fechaInicio: true, fechaFin: true,
                montoAporte: true, semanaActual: true },
    });

    // ── Cargar todos los socios (filtrado si se piden específicos) ───────────
    const socios = await prisma.socio.findMany({
      where: socioIds ? { id: { in: socioIds } } : undefined,
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, saldoAhorros: true },
    });

    // ── Para cada ronda, cargar datos de cada socio ──────────────────────────
    type DatoRonda = {
      aportes: number; multas: number; ahorros: number;
      prestamos: number; interesesPrestamo: number;
      express: number; invertido: number; devuelto: number; interesGanado: number;
      pendienteAhorro: number;
    };
    type FilaSocio = { socio: typeof socios[0]; rondas: Record<number, DatoRonda> };

    const filas: FilaSocio[] = socios.map(s => ({ socio: s, rondas: {} }));
    const filasMap = new Map(filas.map(f => [f.socio.id, f]));

    for (const ronda of rondas) {
      // Aportes y multas
      const aportes = await prisma.aporte.groupBy({
        by: ["socioId"], where: { rondaId: ronda.id },
        _sum: { monto: true, multa: true },
      });
      // Ahorros
      const ahorros = await prisma.ahorro.groupBy({
        by: ["socioId"], where: { rondaId: ronda.id },
        _sum: { monto: true },
      });
      // Préstamos normales
      const prestamos = await prisma.prestamo.findMany({
        where: { rondaId: ronda.id },
        select: { socioId: true, monto: true, cuotas: { select: { interes: true, pagada: true } } },
      });
      // Express (modelo separado)
      const express = await prisma.prestamoExpress.groupBy({
        by: ["socioId"], where: { rondaId: ronda.id },
        _sum: { monto: true },
      });
      // Fondo de inversión
      const cuentas = await prisma.cuentaInversion.findMany({
        where: { rondaId: ronda.id },
        select: { socioId: true, montoInvertido: true, interesesAcumulados: true, devuelto: true },
      });
      // Objetivo ahorro
      const rondaFull = await prisma.ronda.findUnique({
        where: { id: ronda.id }, select: { ahorroObjetivoPorSocio: true },
      });
      const objetivo = Number(rondaFull?.ahorroObjetivoPorSocio ?? 0);

      // Indexar por socioId
      const aportesMap = Object.fromEntries(aportes.map(a => [a.socioId, a._sum]));
      const ahorrosMap = Object.fromEntries(ahorros.map(a => [a.socioId, Number(a._sum.monto ?? 0)]));
      const expressMap = Object.fromEntries(express.map(e => [e.socioId, Number(e._sum.monto ?? 0)]));
      const cuentasMap = Object.fromEntries(cuentas.map(c => [c.socioId, c]));

      for (const fila of filas) {
        const sid = fila.socio.id;
        const ap = aportesMap[sid];
        const ahorro = ahorrosMap[sid] ?? 0;
        const prest = prestamos.filter(p => p.socioId === sid);
        const montoPrest = prest.reduce((s, p) => s + Number(p.monto), 0);
        const interesP = prest.reduce((s, p) =>
          s + p.cuotas.filter(c => c.pagada).reduce((a, c) => a + Number(c.interes), 0), 0);
        const cuenta = cuentasMap[sid];

        fila.rondas[ronda.id] = {
          aportes:          Number(ap?.monto ?? 0),
          multas:           Number(ap?.multa ?? 0),
          ahorros:          ahorro,
          prestamos:        montoPrest,
          interesesPrestamo: interesP,
          express:          expressMap[sid] ?? 0,
          invertido:        cuenta ? Number(cuenta.montoInvertido) : 0,
          devuelto:         cuenta ? Number(cuenta.montoInvertido) + Number(cuenta.interesesAcumulados) : 0,
          interesGanado:    cuenta ? Number(cuenta.interesesAcumulados) : 0,
          pendienteAhorro:  objetivo > 0 ? Math.max(objetivo - ahorro, 0) : 0,
        };
      }
    }

    // ── Generar Excel ────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = "MiRonda";
    wb.created = new Date();

    const VERDE  = "FF16a34a";
    const AZUL   = "FF2563eb";
    const GRIS   = "FF6b7280";
    const NEGRO  = "FF111827";
    const AMBER  = "FFd97706";

    const styleHeader = (row: ExcelJS.Row, cols: number, color = "FF1e3a5f") => {
      for (let c = 1; c <= cols; c++) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
        row.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
        row.getCell(c).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      }
      row.height = 28;
    };

    const fmt$ = '"$"#,##0.00';

    // ── HOJA 1: Detalle por socio / ronda ────────────────────────────────────
    const ws = wb.addWorksheet("Consolidado por ronda");

    // Columnas: Socio | Cuenta | por cada ronda: Aportes Multas Ahorros PrestNormal Interés Express Invertido InterésGanado PendAhorro
    const CAMPOS = [
      { key: "aportes",          label: "Aportes",     color: AZUL },
      { key: "multas",           label: "Multas",      color: "FFDC2626" },
      { key: "ahorros",          label: "Ahorros",     color: VERDE },
      { key: "pendienteAhorro",  label: "Pend.Ahorro", color: AMBER },
      { key: "prestamos",        label: "Préstamos",   color: "FF7c3aed" },
      { key: "interesesPrestamo",label: "Int.Prest.",  color: AMBER },
      { key: "express",          label: "Express",     color: "FFea580c" },
      { key: "invertido",        label: "Invertido",   color: AZUL },
      { key: "interesGanado",    label: "Int.Ganado",  color: VERDE },
    ] as const;

    // Fila 1: título
    ws.mergeCells(1, 1, 1, 2 + rondas.length * CAMPOS.length);
    const titleCell = ws.getCell("A1");
    titleCell.value = `CONSOLIDADO GENERAL · Generado ${new Date().toLocaleDateString("es-EC")}`;
    titleCell.font = { bold: true, size: 13, color: { argb: "FF1e3a5f" } };
    titleCell.alignment = { horizontal: "center" };
    ws.getRow(1).height = 24;
    ws.addRow([]);

    // Fila 3: headers rondas (agrupadas)
    const headerRonda = ws.getRow(3);
    headerRonda.getCell(1).value = "Socio";
    headerRonda.getCell(2).value = "Cuenta";
    rondas.forEach((r, ri) => {
      const startCol = 3 + ri * CAMPOS.length;
      ws.mergeCells(3, startCol, 3, startCol + CAMPOS.length - 1);
      const cell = headerRonda.getCell(startCol);
      cell.value = r.nombre;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    ws.getRow(3).height = 20;

    // Fila 4: headers campos
    const headerCampos = ws.getRow(4);
    headerCampos.getCell(1).value = "Nombre";
    headerCampos.getCell(2).value = "Cuenta";
    [headerCampos.getCell(1), headerCampos.getCell(2)].forEach(c => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    });
    rondas.forEach((_, ri) => {
      CAMPOS.forEach((campo, ci) => {
        const col = 3 + ri * CAMPOS.length + ci;
        const cell = headerCampos.getCell(col);
        cell.value = campo.label;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: campo.color } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 8 };
        cell.alignment = { horizontal: "center", wrapText: true };
      });
    });
    ws.getRow(4).height = 28;

    // Anchos de columna
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 12;
    rondas.forEach((_, ri) => {
      CAMPOS.forEach((_, ci) => {
        ws.getColumn(3 + ri * CAMPOS.length + ci).width = 10;
      });
    });

    // Filas de datos
    const TOTALES: Record<string, number[]> = {};
    CAMPOS.forEach(c => { TOTALES[c.key] = new Array(rondas.length).fill(0); });

    filas.forEach((fila, fi) => {
      const row = ws.addRow([
        `${fila.socio.apellidos}, ${fila.socio.nombres}`,
        fila.socio.numeroCuenta,
        ...rondas.flatMap((r, ri) => {
          const d = fila.rondas[r.id] ?? {} as DatoRonda;
          return CAMPOS.map(c => {
            const val = Number((d as any)[c.key] ?? 0);
            TOTALES[c.key][ri] += val;
            return val;
          });
        }),
      ]);

      const bgColor = fi % 2 === 0 ? "FFF9FAFB" : "FFFFFFFF";
      for (let col = 1; col <= 2 + rondas.length * CAMPOS.length; col++) {
        const cell = row.getCell(col);
        if (col > 2) cell.numFmt = fmt$;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
        cell.font = { size: 8 };
      }
    });

    // Fila totales
    ws.addRow([]);
    const totalRow = ws.addRow([
      "TOTAL", "",
      ...rondas.flatMap((_, ri) => CAMPOS.map(c => TOTALES[c.key][ri])),
    ]);
    for (let col = 1; col <= 2 + rondas.length * CAMPOS.length; col++) {
      const cell = totalRow.getCell(col);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      if (col > 2) cell.numFmt = fmt$;
    }
    totalRow.height = 18;

    // ── HOJA 2: Resumen por socio (suma de todas las rondas) ────────────────
    const ws2 = wb.addWorksheet("Resumen por socio");
    ws2.columns = [
      { header: "Socio",           key: "socio",    width: 30 },
      { header: "Cuenta",          key: "cuenta",   width: 12 },
      { header: "Total aportes",   key: "aportes",  width: 14 },
      { header: "Total multas",    key: "multas",   width: 12 },
      { header: "Total ahorros",   key: "ahorros",  width: 14 },
      { header: "Saldo actual",    key: "saldo",    width: 13 },
      { header: "Total préstamos", key: "prest",    width: 14 },
      { header: "Interés prest.",  key: "intPrest", width: 13 },
      { header: "Express total",   key: "express",  width: 12 },
      { header: "Total invertido", key: "inv",      width: 13 },
      { header: "Interés ganado",  key: "intGan",   width: 13 },
    ];
    styleHeader(ws2.getRow(1), 11);

    let tot = { ap:0, mul:0, ah:0, sal:0, pr:0, ip:0, ex:0, inv:0, ig:0 };
    filas.forEach((fila, fi) => {
      const totR = { ap:0, mul:0, ah:0, pr:0, ip:0, ex:0, inv:0, ig:0 };
      rondas.forEach(r => {
        const d = fila.rondas[r.id] ?? {} as DatoRonda;
        totR.ap  += Number((d as any).aportes ?? 0);
        totR.mul += Number((d as any).multas ?? 0);
        totR.ah  += Number((d as any).ahorros ?? 0);
        totR.pr  += Number((d as any).prestamos ?? 0);
        totR.ip  += Number((d as any).interesesPrestamo ?? 0);
        totR.ex  += Number((d as any).express ?? 0);
        totR.inv += Number((d as any).invertido ?? 0);
        totR.ig  += Number((d as any).interesGanado ?? 0);
      });
      const saldo = Number(fila.socio.saldoAhorros);
      Object.keys(tot).forEach(k => { (tot as any)[k] += (totR as any)[k] ?? saldo * (k === "sal" ? 1 : 0); });
      tot.sal += saldo;

      const row = ws2.addRow([
        `${fila.socio.apellidos}, ${fila.socio.nombres}`,
        fila.socio.numeroCuenta,
        totR.ap, totR.mul, totR.ah, saldo, totR.pr, totR.ip, totR.ex, totR.inv, totR.ig,
      ]);
      const bg = fi % 2 === 0 ? "FFF9FAFB" : "FFFFFFFF";
      for (let c = 1; c <= 11; c++) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        row.getCell(c).font = { size: 9 };
        if (c > 2) row.getCell(c).numFmt = fmt$;
      }
    });

    ws2.addRow([]);
    const tot2 = ws2.addRow(["TOTAL", "", tot.ap, tot.mul, tot.ah, tot.sal, tot.pr, tot.ip, tot.ex, tot.inv, tot.ig]);
    for (let c = 1; c <= 11; c++) {
      tot2.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
      tot2.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      if (c > 2) tot2.getCell(c).numFmt = fmt$;
    }

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
