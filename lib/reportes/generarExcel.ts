// lib/reportes/generarExcel.ts
import ExcelJS from "exceljs";

const VERDE = "FF1a3a2a";
const VERDE_CLARO = "FFe8f5e9";
const AZUL = "FF1d4ed8";
const AZUL_CLARO = "FFdbeafe";
const AMBER = "FFd97706";
const AMBER_CLARO = "FFfef9c3";
const GRIS = "FFf3f4f6";
const ROJO = "FFdc2626";
const ROJO_CLARO = "FFfee2e2";
const BLANCO = "FFFFFFFF";

function styleHeader(row: ExcelJS.Row, cols: number, fillColor = VERDE) {
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
    cell.font = {
      bold: true,
      color: { argb: fillColor === VERDE ? BLANCO : "FF1f2937" },
      size: 10,
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFd1d5db" } },
    };
  }
  row.height = 22;
}

function styleAlternate(row: ExcelJS.Row, cols: number, even: boolean) {
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    if (even) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS } };
    cell.alignment = { vertical: "middle" };
    cell.border = {
      bottom: { style: "hair", color: { argb: "FFe5e7eb" } },
    };
  }
  row.height = 16;
}

function styleTotalRow(row: ExcelJS.Row, cols: number, fillColor = VERDE_CLARO) {
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
    cell.font = { bold: true, size: 10 };
    cell.border = {
      top: { style: "thin", color: { argb: VERDE } },
      bottom: { style: "thin", color: { argb: VERDE } },
    };
  }
  row.height = 18;
}

export async function generarExcel(ronda: any): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MiRonda";
  wb.created = new Date();
  wb.modified = new Date();

  const mes = new Date().toLocaleDateString("es-EC", { month: "long", year: "numeric" });
  const semanas = ronda.semanaActual;
  const intervalo = ronda.intervaloDiasCobro ?? 7;
  const fechaInicio = new Date(ronda.fechaInicio);

  // Calcular fecha de cada semana
  const fechaSemana = (s: number): Date => {
    const d = new Date(Date.UTC(fechaInicio.getUTCFullYear(), fechaInicio.getUTCMonth(), fechaInicio.getUTCDate(), 12));
    d.setUTCDate(d.getUTCDate() + (s - 1) * intervalo);
    return d;
  };
  const fmtDate = (d: Date) => new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

  // ── HOJA 1: Resumen General ─────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Resumen General");

  // Título
  ws1.mergeCells("A1:G1");
  const titleCell = ws1.getCell("A1");
  titleCell.value = `MiRonda · Reporte Mensual · ${ronda.nombre} · ${mes}`;
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  titleCell.font = { bold: true, size: 14, color: { argb: BLANCO } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 28;

  ws1.mergeCells("A2:G2");
  const subtitleCell = ws1.getCell("A2");
  subtitleCell.value = `Ronda: ${ronda.nombre} · Semana ${ronda.semanaActual} de ${ronda.participaciones.length} · Inicio: ${fmtDate(fechaInicio)}`;
  subtitleCell.font = { size: 10, color: { argb: "FF6b7280" } };
  subtitleCell.alignment = { horizontal: "center" };
  ws1.getRow(2).height = 16;

  ws1.addRow([]);

  // KPIs
  const totalAportes = ronda.aportes.reduce((a: number, x: any) => a + Number(x.monto), 0);
  const totalAhorros = ronda.ahorros.reduce((a: number, x: any) => a + Number(x.monto), 0);
  const totalFondo = ronda.cuentasInversion.reduce((a: number, x: any) => a + Number(x.montoInvertido), 0);
  const totalIntereses = ronda.cuentasInversion.reduce((a: number, x: any) => a + Number(x.interesesAcumulados), 0);
  const prestamosActivos = ronda.prestamos.filter((p: any) => p.estado === "ACTIVO");
  const totalSaldo = prestamosActivos.reduce((a: number, p: any) => a + Number(p.saldoActual), 0);

  const kpiHeader = ws1.addRow(["Indicador", "Valor"]);
  styleHeader(kpiHeader, 2);
  ws1.getColumn(1).width = 30;
  ws1.getColumn(2).width = 18;

  const kpis = [
    ["Total aportes recaudados", totalAportes],
    ["Total ahorros acumulados", totalAhorros],
    ["Fondo de inversión", totalFondo],
    ["Intereses acumulados", totalIntereses],
    ["Saldo préstamos activos", totalSaldo],
    ["Participantes en la ronda", ronda.participaciones.length],
    ["Semana actual", ronda.semanaActual],
    ["Total semanas", ronda.participaciones.length],
  ];

  kpis.forEach(([label, value], i) => {
    const row = ws1.addRow([label, typeof value === "number" && label.toString().includes("Semana") ? value : value]);
    styleAlternate(row, 2, i % 2 === 0);
    if (typeof value === "number" && !label.toString().includes("Semana") && !label.toString().includes("Part")) {
      row.getCell(2).numFmt = '"$"#,##0.00';
    }
  });

  // ── HOJA 2: Participantes ───────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Participantes");

  ws2.columns = [
    { header: "Orden", key: "orden", width: 8 },
    { header: "Cuenta", key: "cuenta", width: 12 },
    { header: "Nombres", key: "nombres", width: 22 },
    { header: "Apellidos", key: "apellidos", width: 22 },
    { header: "Total aportes ($)", key: "aportes", width: 18 },
    { header: "Multas ($)", key: "multas", width: 14 },
    { header: "Total ahorros ($)", key: "ahorros", width: 18 },
    { header: "Semana que cobra", key: "semana", width: 18 },
    { header: "Fecha de cobro", key: "fechaCobro", width: 16 },
  ];
  styleHeader(ws2.getRow(1), 9);

  let totAp = 0, totMult = 0, totAh = 0;
  ronda.participaciones.forEach((p: any, i: number) => {
    const aportes = ronda.aportes.filter((a: any) => a.socioId === p.socioId);
    const ahorros = ronda.ahorros.filter((a: any) => a.socioId === p.socioId);
    const totalA = aportes.reduce((s: number, x: any) => s + Number(x.monto), 0);
    const totalMult = aportes.reduce((s: number, x: any) => s + Number(x.multa ?? 0), 0);
    const totalAh = ahorros.reduce((s: number, x: any) => s + Number(x.monto), 0);
    const fechaCobro = fmtDate(fechaSemana(p.orden));
    totAp += totalA; totMult += totalMult; totAh += totalAh;

    const row = ws2.addRow({
      orden: p.orden,
      cuenta: p.socio.numeroCuenta,
      nombres: p.socio.nombres,
      apellidos: p.socio.apellidos,
      aportes: totalA,
      multas: totalMult,
      ahorros: totalAh,
      semana: p.orden,
      fechaCobro,
    });
    styleAlternate(row, 9, i % 2 === 0);
    row.getCell(5).numFmt = '"$"#,##0.00';
    row.getCell(6).numFmt = '"$"#,##0.00';
    row.getCell(7).numFmt = '"$"#,##0.00';
  });

  ws2.addRow([]);
  const totalRow2 = ws2.addRow({ orden: "", cuenta: "", nombres: "TOTAL", apellidos: "", aportes: totAp, multas: totMult, ahorros: totAh });
  styleTotalRow(totalRow2, 9);
  totalRow2.getCell(5).numFmt = '"$"#,##0.00';
  totalRow2.getCell(6).numFmt = '"$"#,##0.00';
  totalRow2.getCell(7).numFmt = '"$"#,##0.00';

  // ── HOJA 3: Detalle Semanal ─────────────────────────────────────────────────
  const ws3 = wb.addWorksheet("Detalle Semanal");

  // Título hoja
  ws3.mergeCells("A1:J1");
  const titleSem = ws3.getCell("A1");
  titleSem.value = "Detalle semanal — Aportes, Ahorros y Responsables";
  titleSem.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  titleSem.font = { bold: true, size: 12, color: { argb: BLANCO } };
  titleSem.alignment = { horizontal: "center", vertical: "middle" };
  ws3.getRow(1).height = 24;

  ws3.columns = [
    { key: "semana", width: 10 },
    { key: "fecha", width: 14 },
    { key: "responsable", width: 26 },
    { key: "receptorSemana", width: 26 },
    { key: "cuenta", width: 12 },
    { key: "socio", width: 28 },
    { key: "aporte", width: 14 },
    { key: "multa", width: 12 },
    { key: "ahorro", width: 14 },
    { key: "pagado", width: 10 },
  ];

  // Cabecera de columnas
  const headerRow3 = ws3.getRow(2);
  headerRow3.values = ["Semana", "Fecha", "Responsable cobro", "Quien cobra", "Cuenta", "Socio", "Aporte ($)", "Multa ($)", "Ahorro ($)", "Pagado"];
  styleHeader(headerRow3, 10);

  // Construir mapa de responsables por semana
  const responsablesMap = new Map<number, string>();
  if (ronda.responsablesSemana) {
    for (const rs of ronda.responsablesSemana) {
      const soc = ronda.participaciones.find((p: any) => p.socioId === rs.socioId);
      if (soc) responsablesMap.set(rs.semana, `${soc.socio.nombres} ${soc.socio.apellidos}`);
    }
  }

  // Quién cobra en cada semana (el socio cuyo orden = semana)
  const receptorMap = new Map<number, string>();
  ronda.participaciones.forEach((p: any) => {
    receptorMap.set(p.orden, `${p.socio.nombres} ${p.socio.apellidos}`);
  });

  // Mapa de aportes por socio y semana
  type AporteKey = string;
  const aportesMap = new Map<AporteKey, { monto: number; multa: number }>();
  ronda.aportes.forEach((a: any) => {
    aportesMap.set(`${a.socioId}_${a.semana}`, { monto: Number(a.monto), multa: Number(a.multa ?? 0) });
  });

  // Mapa de ahorros por socio y semana
  const ahorrosMap = new Map<AporteKey, number>();
  ronda.ahorros.forEach((a: any) => {
    const key = `${a.socioId}_${a.semana}`;
    ahorrosMap.set(key, (ahorrosMap.get(key) ?? 0) + Number(a.monto));
  });

  let rowNum = 3;
  let globalRowIndex = 0;

  for (let sem = 1; sem <= semanas; sem++) {
    const fecha = fmtDate(fechaSemana(sem));
    const responsable = responsablesMap.get(sem) ?? "—";
    const receptor = receptorMap.get(sem) ?? "—";

    // Subtítulo de semana
    ws3.mergeCells(`A${rowNum}:J${rowNum}`);
    const semTitleCell = ws3.getCell(`A${rowNum}`);
    semTitleCell.value = `SEMANA ${sem} · ${fecha} · Cobra: ${receptor}`;
    semTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CLARO } };
    semTitleCell.font = { bold: true, size: 9, color: { argb: AZUL } };
    semTitleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    ws3.getRow(rowNum).height = 18;
    rowNum++;

    let semTotalAporte = 0, semTotalMulta = 0, semTotalAhorro = 0;
    let pagadosCount = 0;

    ronda.participaciones.forEach((p: any, pi: number) => {
      const key = `${p.socioId}_${sem}`;
      const aporte = aportesMap.get(key);
      const ahorro = ahorrosMap.get(key) ?? 0;
      const pagado = !!aporte;
      const montoAporte = aporte?.monto ?? 0;
      const montoMulta = aporte?.multa ?? 0;

      semTotalAporte += montoAporte;
      semTotalMulta += montoMulta;
      semTotalAhorro += ahorro;
      if (pagado) pagadosCount++;

      const row = ws3.getRow(rowNum);
      row.values = [
        sem,
        fecha,
        responsable,
        receptor,
        p.socio.numeroCuenta,
        `${p.socio.nombres} ${p.socio.apellidos}`,
        montoAporte,
        montoMulta,
        ahorro,
        pagado ? "✓" : "✗",
      ];

      // Estilo alterno
      const isEven = pi % 2 === 0;
      for (let c = 1; c <= 10; c++) {
        const cell = row.getCell(c);
        if (isEven) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFf9fafb" } };
        cell.border = { bottom: { style: "hair", color: { argb: "FFe5e7eb" } } };
        cell.alignment = { vertical: "middle" };
      }
      row.height = 15;

      // Formato moneda
      row.getCell(7).numFmt = '"$"#,##0.00';
      row.getCell(8).numFmt = '"$"#,##0.00';
      row.getCell(9).numFmt = '"$"#,##0.00';

      // Color si no pagó
      if (!pagado) {
        row.getCell(10).font = { color: { argb: ROJO }, bold: true };
        row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROJO_CLARO } };
      } else {
        row.getCell(10).font = { color: { argb: "FF15803d" }, bold: true };
      }

      rowNum++;
    });

    // Total de la semana
    const totalSemRow = ws3.getRow(rowNum);
    totalSemRow.values = [
      "", "", "", "",
      `${pagadosCount}/${ronda.participaciones.length} pagaron`,
      "TOTAL SEMANA",
      semTotalAporte,
      semTotalMulta,
      semTotalAhorro,
      "",
    ];
    for (let c = 1; c <= 10; c++) {
      const cell = totalSemRow.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE_CLARO } };
      cell.font = { bold: true, size: 9 };
      cell.border = {
        top: { style: "thin", color: { argb: VERDE } },
        bottom: { style: "thin", color: { argb: VERDE } },
      };
    }
    totalSemRow.getCell(7).numFmt = '"$"#,##0.00';
    totalSemRow.getCell(8).numFmt = '"$"#,##0.00';
    totalSemRow.getCell(9).numFmt = '"$"#,##0.00';
    totalSemRow.height = 17;
    rowNum++;

    // Espacio entre semanas
    rowNum++;
    globalRowIndex++;
  }

  // ── HOJA 4: Préstamos ───────────────────────────────────────────────────────
  const ws4 = wb.addWorksheet("Préstamos");
  ws4.columns = [
    { header: "Socio", key: "socio", width: 28 },
    { header: "Cuenta", key: "cuenta", width: 12 },
    { header: "Monto ($)", key: "monto", width: 14 },
    { header: "Tasa (%)", key: "tasa", width: 12 },
    { header: "Plazo (meses)", key: "plazo", width: 15 },
    { header: "Estado", key: "estado", width: 13 },
    { header: "Saldo ($)", key: "saldo", width: 14 },
    { header: "Cuotas pagadas", key: "pagadas", width: 16 },
    { header: "Total cuotas", key: "total", width: 14 },
    { header: "Fecha inicio", key: "fechaInicio", width: 14 },
  ];
  styleHeader(ws4.getRow(1), 10);

  ronda.prestamos.forEach((p: any, i: number) => {
    const pagadas = p.cuotas.filter((c: any) => c.pagada).length;
    const row = ws4.addRow({
      socio: `${p.socio.nombres} ${p.socio.apellidos}`,
      cuenta: p.socio.numeroCuenta,
      monto: Number(p.monto),
      tasa: Number(p.tasaAnual),
      plazo: p.plazoMeses,
      estado: p.estado,
      saldo: Number(p.saldoActual),
      pagadas,
      total: p.cuotas.length,
      fechaInicio: fmtDate(new Date(p.fechaInicio)),
    });
    styleAlternate(row, 10, i % 2 === 0);
    row.getCell(3).numFmt = '"$"#,##0.00';
    row.getCell(4).numFmt = '0.00"%"';
    row.getCell(7).numFmt = '"$"#,##0.00';

    // Color estado
    const estadoCell = row.getCell(6);
    if (p.estado === "ACTIVO") {
      estadoCell.font = { color: { argb: "FF15803d" }, bold: true };
      estadoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFdcfce7" } };
    } else if (p.estado === "CANCELADO") {
      estadoCell.font = { color: { argb: AZUL }, bold: true };
      estadoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CLARO } };
    }
  });

  // ── HOJA 5: Fondo de Inversión ──────────────────────────────────────────────
  const ws5 = wb.addWorksheet("Fondo Inversión");
  ws5.columns = [
    { header: "Socio", key: "socio", width: 28 },
    { header: "Cuenta", key: "cuenta", width: 12 },
    { header: "Monto invertido ($)", key: "invertido", width: 20 },
    { header: "% Participación", key: "pct", width: 17 },
    { header: "Intereses acum. ($)", key: "intereses", width: 20 },
    { header: "Total a recibir ($)", key: "total", width: 20 },
    { header: "Devuelto", key: "devuelto", width: 12 },
  ];
  styleHeader(ws5.getRow(1), 7);

  let totInv = 0, totInt = 0;
  ronda.cuentasInversion.forEach((ci: any, i: number) => {
    const invertido = Number(ci.montoInvertido);
    const intereses = Number(ci.interesesAcumulados);
    totInv += invertido; totInt += intereses;
    const row = ws5.addRow({
      socio: `${ci.socio.nombres} ${ci.socio.apellidos}`,
      cuenta: ci.socio.numeroCuenta,
      invertido,
      pct: Number(ci.porcentajeParticipacion),
      intereses,
      total: invertido + intereses,
      devuelto: ci.devuelto ? "Sí" : "No",
    });
    styleAlternate(row, 7, i % 2 === 0);
    row.getCell(3).numFmt = '"$"#,##0.00';
    row.getCell(4).numFmt = '0.00"%"';
    row.getCell(5).numFmt = '"$"#,##0.00';
    row.getCell(6).numFmt = '"$"#,##0.00';
  });

  ws5.addRow([]);
  const totalRow5 = ws5.addRow({ socio: "TOTAL", cuenta: "", invertido: totInv, pct: 100, intereses: totInt, total: totInv + totInt });
  styleTotalRow(totalRow5, 7, AZUL_CLARO);
  totalRow5.getCell(3).numFmt = '"$"#,##0.00';
  totalRow5.getCell(4).numFmt = '0.00"%"';
  totalRow5.getCell(5).numFmt = '"$"#,##0.00';
  totalRow5.getCell(6).numFmt = '"$"#,##0.00';

  const buf = await wb.xlsx.writeBuffer();
  return buf as Buffer;
}
