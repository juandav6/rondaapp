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

  // ── Calcular socios parciales (tienen ahorros pero no son participantes) ────
  const idsParticipantes = new Set(ronda.participaciones.map((p: any) => p.socioId));
  const ahorrosPorSocioParcial = new Map<number, { socio: any; total: number; ahorros: any[] }>();
  ronda.ahorros.forEach((a: any) => {
    if (!idsParticipantes.has(a.socioId)) {
      if (!ahorrosPorSocioParcial.has(a.socioId)) {
        ahorrosPorSocioParcial.set(a.socioId, { socio: a.socio, total: 0, ahorros: [] });
      }
      const entry = ahorrosPorSocioParcial.get(a.socioId)!;
      entry.total += Number(a.monto);
      entry.ahorros.push(a);
    }
  });
  const sociosParciales = Array.from(ahorrosPorSocioParcial.values())
    .sort((a, b) => a.socio.apellidos.localeCompare(b.socio.apellidos));
  const objetivoAhorro = Number(ronda.ahorroObjetivoPorSocio ?? 0);

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

    const row = ws2.addRow([
      p.orden,
      p.socio.numeroCuenta,
      p.socio.nombres,
      p.socio.apellidos,
      totalA,
      totalMult,
      totalAh,
      p.orden,
      fechaCobro,
    ]);
    styleAlternate(row, 9, i % 2 === 0);
    row.getCell(5).numFmt = '"$"#,##0.00';
    row.getCell(6).numFmt = '"$"#,##0.00';
    row.getCell(7).numFmt = '"$"#,##0.00';
  });

  ws2.addRow([]);
  const totalRow2 = ws2.addRow(["", "", "TOTAL", "", totAp, totMult, totAh, "", ""]);
  styleTotalRow(totalRow2, 9);
  totalRow2.getCell(5).numFmt = '"$"#,##0.00';
  totalRow2.getCell(6).numFmt = '"$"#,##0.00';
  totalRow2.getCell(7).numFmt = '"$"#,##0.00';

  // ── Sección socios de ahorro parcial en Participantes ───────────────────────
  if (sociosParciales.length > 0) {
    ws2.addRow([]);
    const parcTitleRow = ws2.addRow(["", "", `SOCIOS DE AHORRO PARCIAL (${sociosParciales.length})`, "", "", "", "", "", ""]);
    ws2.mergeCells(`C${parcTitleRow.number}:I${parcTitleRow.number}`);
    parcTitleRow.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFede9fe" } };
    parcTitleRow.getCell(3).font = { bold: true, color: { argb: "FF5b21b6" }, size: 10 };
    parcTitleRow.getCell(3).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    parcTitleRow.height = 18;

    const parcHeader = ws2.addRow(["", "Cuenta", "Nombres", "Apellidos", "Ahorrado ($)", "Objetivo ($)", "Restante ($)", "% Completado", "Tipo"]);
    for (let c = 2; c <= 9; c++) {
      parcHeader.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFede9fe" } };
      parcHeader.getCell(c).font = { bold: true, color: { argb: "FF5b21b6" }, size: 9 };
    }

    let totParcAh = 0;
    sociosParciales.forEach((sp, i) => {
      totParcAh += sp.total;
      const restante = Math.max(objetivoAhorro - sp.total, 0);
      const pct = objetivoAhorro > 0 ? `${((sp.total / objetivoAhorro) * 100).toFixed(1)}%` : "—";
      const row = ws2.addRow([
        "",
        sp.socio.numeroCuenta,
        sp.socio.nombres,
        sp.socio.apellidos,
        sp.total,
        objetivoAhorro > 0 ? objetivoAhorro : "—",
        objetivoAhorro > 0 ? restante : "—",
        pct,
        "Ahorro parcial",
      ]);
      styleAlternate(row, 9, i % 2 === 0);
      row.getCell(5).numFmt = '"$"#,##0.00';
      if (objetivoAhorro > 0) {
        row.getCell(6).numFmt = '"$"#,##0.00';
        row.getCell(7).numFmt = '"$"#,##0.00';
        if (restante === 0) {
          row.getCell(9).font = { color: { argb: "FF15803d" }, bold: true };
        }
      }
      row.getCell(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFf5f3ff" } };
      row.getCell(9).font = { color: { argb: "FF5b21b6" }, italic: true };
    });

    const parcTotRow = ws2.addRow(["", "", "SUBTOTAL PARCIALES", "", totParcAh, "", "", "", ""]);
    styleTotalRow(parcTotRow, 9, "FFede9fe");
    parcTotRow.getCell(5).numFmt = '"$"#,##0.00';
    parcTotRow.getCell(3).font = { bold: true, color: { argb: "FF5b21b6" } };
  }

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
    { header: "Socio",           key: "socio",       width: 28 },
    { header: "Cuenta",          key: "cuenta",      width: 12 },
    { header: "Monto ($)",       key: "monto",       width: 14 },
    { header: "Tasa (%)",        key: "tasa",        width: 12 },
    { header: "Plazo (meses)",   key: "plazo",       width: 15 },
    { header: "Interés ($)",     key: "interes",     width: 14 },
    { header: "Total a pagar ($)", key: "totalPagar", width: 18 },
    { header: "Estado",          key: "estado",      width: 13 },
    { header: "Saldo ($)",       key: "saldo",       width: 14 },
    { header: "Cuotas pagadas",  key: "pagadas",     width: 16 },
    { header: "Total cuotas",    key: "total",       width: 14 },
    { header: "Fecha inicio",    key: "fechaInicio", width: 14 },
  ];
  styleHeader(ws4.getRow(1), 12);

  let totMontoPrest = 0, totInteresPrest = 0, totTotalPrest = 0;
  ronda.prestamos.forEach((p: any, i: number) => {
    const pagadas = p.cuotas.filter((c: any) => c.pagada).length;
    // Calcular interés total = suma de intereses de todas las cuotas
    const totalInteres = p.cuotas.reduce((s: number, c: any) => s + Number(c.interes), 0);
    const totalAPagar = Number(p.monto) + totalInteres;
    totMontoPrest  += Number(p.monto);
    totInteresPrest += totalInteres;
    totTotalPrest  += totalAPagar;

    const row = ws4.addRow({
      socio:      `${p.socio.nombres} ${p.socio.apellidos}`,
      cuenta:     p.socio.numeroCuenta,
      monto:      Number(p.monto),
      tasa:       Number(p.tasaAnual),
      plazo:      p.plazoMeses,
      interes:    totalInteres,
      totalPagar: totalAPagar,
      estado:     p.estado,
      saldo:      Number(p.saldoActual),
      pagadas,
      total:      p.cuotas.length,
      fechaInicio: fmtDate(new Date(p.fechaInicio)),
    });
    styleAlternate(row, 12, i % 2 === 0);
    row.getCell(3).numFmt = '"$"#,##0.00';   // Monto
    row.getCell(4).numFmt = '0.00"%"';       // Tasa
    row.getCell(6).numFmt = '"$"#,##0.00';   // Interés
    row.getCell(6).font   = { color: { argb: "FF15803d" }, bold: true };
    row.getCell(7).numFmt = '"$"#,##0.00';   // Total a pagar
    row.getCell(9).numFmt = '"$"#,##0.00';   // Saldo

    // Color estado
    const estadoCell = row.getCell(8);
    if (p.estado === "ACTIVO") {
      estadoCell.font = { color: { argb: "FF15803d" }, bold: true };
      estadoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFdcfce7" } };
    } else if (p.estado === "CANCELADO") {
      estadoCell.font = { color: { argb: AZUL }, bold: true };
      estadoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CLARO } };
    }
  });

  // Fila total préstamos
  ws4.addRow([]);
  const totalRow4 = ws4.addRow([
    "TOTAL", "", totMontoPrest, "", "", totInteresPrest, totTotalPrest, "", "", "", "", "",
  ]);
  styleTotalRow(totalRow4, 12, AZUL_CLARO);
  totalRow4.getCell(3).numFmt = '"$"#,##0.00';
  totalRow4.getCell(3).font   = { bold: true };
  totalRow4.getCell(6).numFmt = '"$"#,##0.00';
  totalRow4.getCell(6).font   = { bold: true, color: { argb: "FF15803d" } };
  totalRow4.getCell(7).numFmt = '"$"#,##0.00';
  totalRow4.getCell(7).font   = { bold: true };

  // ── HOJA 5: Fondo de Inversión ──────────────────────────────────────────────
  const ws5 = wb.addWorksheet("Fondo Inversión");
  ws5.columns = [
    { header: "Socio",               key: "socio",     width: 28 },
    { header: "Cuenta",              key: "cuenta",    width: 12 },
    { header: "Monto invertido ($)", key: "invertido", width: 20 },
    { header: "% Participación",     key: "pct",       width: 17 },
    { header: "Intereses acum. ($)", key: "intereses", width: 20 },
    { header: "Total a recibir ($)", key: "total",     width: 20 },
    { header: "Devuelto",            key: "devuelto",  width: 12 },
  ];
  styleHeader(ws5.getRow(1), 7);

  // Calcular intereses reales desde movimientos de cuenta tipo=INTERES incluidos en ronda
  // Los movimientos llegan en ronda.participaciones[].socio o en ronda.movimientos si se incluyen
  // Estrategia: calcular desde cuotas de préstamos pagadas (interés cobrado a socios)
  // y distribuir proporcionalmente según % de cada inversor
  const interesesPorSocio = new Map<number, number>();

  // Si la ronda incluye movimientos de cuenta (tipo INTERES), usarlos directamente
  const movsRonda: any[] = ronda.movimientos ?? ronda.movimientosCuenta ?? [];
  movsRonda
    .filter((m: any) => m.tipo === "INTERES")
    .forEach((m: any) => {
      interesesPorSocio.set(m.socioId, (interesesPorSocio.get(m.socioId) ?? 0) + Number(m.monto));
    });

  // Si no hay movimientos, calcular desde préstamos: total interés cobrado × % participación
  if (interesesPorSocio.size === 0 && ronda.cuentasInversion?.length > 0) {
    const totalInteresCobrado = (ronda.prestamos ?? []).reduce((s: number, p: any) => {
      return s + p.cuotas
        .filter((c: any) => c.pagada)
        .reduce((si: number, c: any) => si + Number(c.interes), 0);
    }, 0);

    if (totalInteresCobrado > 0) {
      ronda.cuentasInversion.forEach((ci: any) => {
        const pct = Number(ci.porcentajeParticipacion) / 100;
        interesesPorSocio.set(ci.socioId, Number((totalInteresCobrado * pct).toFixed(2)));
      });
    }
  }

  let totInv = 0, totInt = 0;
  ronda.cuentasInversion.forEach((ci: any, i: number) => {
    const invertido = Number(ci.montoInvertido);
    // Usar el mayor entre interesesAcumulados del modelo y los calculados
    const interesesModelo  = Number(ci.interesesAcumulados ?? 0);
    const interesesCalc    = interesesPorSocio.get(ci.socioId) ?? 0;
    const intereses        = Math.max(interesesModelo, interesesCalc);

    totInv += invertido;
    totInt += intereses;

    const row = ws5.addRow({
      socio:    `${ci.socio.nombres} ${ci.socio.apellidos}`,
      cuenta:   ci.socio.numeroCuenta,
      invertido,
      pct:      Number(ci.porcentajeParticipacion),
      intereses,
      total:    invertido + intereses,
      devuelto: ci.devuelto ? "Sí" : "No",
    });
    styleAlternate(row, 7, i % 2 === 0);
    row.getCell(3).numFmt = '"$"#,##0.00';
    row.getCell(4).numFmt = '0.00"%"';
    row.getCell(5).numFmt = '"$"#,##0.00';
    row.getCell(6).numFmt = '"$"#,##0.00';
    if (intereses > 0) row.getCell(5).font = { color: { argb: "FF15803d" }, bold: true };
    if (ci.devuelto)   row.getCell(7).font = { color: { argb: AZUL }, bold: true };
  });

  // Nota si ronda activa
  if (ronda.activa) {
    ws5.addRow([]);
    const notaRow = ws5.addRow(["⚠ Ronda activa — intereses proyectados hasta la semana " + ronda.semanaActual + " (basado en cuotas cobradas)"]);
    notaRow.getCell(1).font = { italic: true, color: { argb: "FFb45309" } };
  }

  ws5.addRow([]);
  const totalRow5 = ws5.addRow({ socio: "TOTAL", cuenta: "", invertido: totInv, pct: 100, intereses: totInt, total: totInv + totInt });
  styleTotalRow(totalRow5, 7, AZUL_CLARO);
  totalRow5.getCell(3).numFmt = '"$"#,##0.00';
  totalRow5.getCell(4).numFmt = '0.00"%"';
  totalRow5.getCell(5).numFmt = '"$"#,##0.00';
  totalRow5.getCell(5).font   = { bold: true, color: { argb: "FF15803d" } };
  totalRow5.getCell(6).numFmt = '"$"#,##0.00';
  totalRow5.getCell(6).font   = { bold: true };

  // ── HOJA 6: Cuentas por cobrar ──────────────────────────────────────────────
  const ws6 = wb.addWorksheet("Cuentas por Cobrar");

  // Título
  ws6.mergeCells("A1:H1");
  const titleCxC = ws6.getCell("A1");
  titleCxC.value = `Cuentas por Cobrar · ${ronda.nombre} · Semana ${ronda.semanaActual}`;
  titleCxC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROJO } };
  titleCxC.font = { bold: true, size: 13, color: { argb: BLANCO } };
  titleCxC.alignment = { horizontal: "center", vertical: "middle" };
  ws6.getRow(1).height = 26;

  ws6.addRow([]);

  // ── Sección 1: Aportes pendientes (socios que no pagaron alguna semana) ───
  // Construir mapa de quién pagó cada semana
  const pagadosMap = new Map<string, boolean>(); // key: `${socioId}_${semana}`
  ronda.aportes.forEach((a: any) => pagadosMap.set(`${a.socioId}_${a.semana}`, true));

  type PendienteAporte = { socio: string; cuenta: string; semana: number; fecha: string; monto: number };
  const pendientesAporte: PendienteAporte[] = [];

  for (let sem = 1; sem <= ronda.semanaActual; sem++) {
    const fecha = fmtDate(fechaSemana(sem));
    for (const p of ronda.participaciones) {
      if (!pagadosMap.has(`${p.socioId}_${sem}`)) {
        pendientesAporte.push({
          socio: `${p.socio.nombres} ${p.socio.apellidos}`,
          cuenta: p.socio.numeroCuenta,
          semana: sem,
          fecha,
          monto: Number(ronda.montoAporte),
        });
      }
    }
  }

  // Header sección aportes
  ws6.mergeCells(`A3:H3`);
  const secAp = ws6.getCell("A3");
  secAp.value = `APORTES PENDIENTES (${pendientesAporte.length} registro${pendientesAporte.length !== 1 ? "s" : ""})`;
  secAp.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROJO_CLARO } };
  secAp.font = { bold: true, size: 10, color: { argb: ROJO } };
  secAp.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws6.getRow(3).height = 18;

  ws6.columns = [
    { key: "socio", width: 28 },
    { key: "cuenta", width: 12 },
    { key: "tipo", width: 20 },
    { key: "semana", width: 10 },
    { key: "fecha", width: 14 },
    { key: "monto", width: 14 },
    { key: "estado", width: 14 },
    { key: "obs", width: 22 },
  ];

  const apHeader = ws6.addRow(["Socio", "Cuenta", "Tipo", "Semana", "Fecha", "Monto ($)", "Estado", "Observaciones"]);
  styleHeader(apHeader, 8, ROJO);

  if (pendientesAporte.length === 0) {
    const emptyRow = ws6.addRow(["✓ Todos los aportes al día", "", "", "", "", "", "", ""]);
    for (let c = 1; c <= 8; c++) {
      emptyRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFdcfce7" } };
      emptyRow.getCell(c).font = { color: { argb: "FF15803d" }, italic: true };
    }
    emptyRow.height = 16;
  } else {
    let totalPendAporte = 0;
    pendientesAporte.forEach((p, i) => {
      totalPendAporte += p.monto;
      const row = ws6.addRow([
        p.socio, p.cuenta, "Aporte semanal",
        p.semana, p.fecha, p.monto,
        "PENDIENTE", "",
      ]);
      styleAlternate(row, 8, i % 2 === 0);
      row.getCell(6).numFmt = '"$"#,##0.00';
      row.getCell(7).font = { color: { argb: ROJO }, bold: true };
      row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROJO_CLARO } };
    });
    const totApRow = ws6.addRow(["SUBTOTAL APORTES", "", "", "", "", totalPendAporte, "", ""]);
    styleTotalRow(totApRow, 8, ROJO_CLARO);
    totApRow.getCell(6).numFmt = '"$"#,##0.00';
    totApRow.getCell(6).font = { bold: true, color: { argb: ROJO } };
  }

  ws6.addRow([]);

  // ── Sección 2: Ahorros pendientes (objetivo no alcanzado) ─────────────────
  type PendienteAhorro = { socio: string; cuenta: string; objetivo: number; acumulado: number; pendiente: number; tipo: string };
  const pendientesAhorro: PendienteAhorro[] = [];

  if (objetivoAhorro > 0) {
    // Ahorros acumulados por socio participante
    const ahorrosPorSocio = new Map<number, number>();
    ronda.ahorros.forEach((a: any) => {
      ahorrosPorSocio.set(a.socioId, (ahorrosPorSocio.get(a.socioId) ?? 0) + Number(a.monto));
    });

    // Participantes bajo objetivo
    for (const p of ronda.participaciones) {
      const acum = ahorrosPorSocio.get(p.socioId) ?? 0;
      if (acum < objetivoAhorro) {
        pendientesAhorro.push({
          socio: `${p.socio.nombres} ${p.socio.apellidos}`,
          cuenta: p.socio.numeroCuenta,
          objetivo: objetivoAhorro,
          acumulado: acum,
          pendiente: objetivoAhorro - acum,
          tipo: "Participante",
        });
      }
    }

    // Socios parciales bajo objetivo
    for (const sp of sociosParciales) {
      if (sp.total < objetivoAhorro) {
        pendientesAhorro.push({
          socio: `${sp.socio.nombres} ${sp.socio.apellidos}`,
          cuenta: sp.socio.numeroCuenta,
          objetivo: objetivoAhorro,
          acumulado: sp.total,
          pendiente: objetivoAhorro - sp.total,
          tipo: "Ahorro parcial ⭑",
        });
      }
    }
  }

  const rowNumAh = ws6.rowCount + 1;
  ws6.mergeCells(`A${rowNumAh}:H${rowNumAh}`);
  const secAh = ws6.getCell(`A${rowNumAh}`);
  secAh.value = `AHORROS PENDIENTES (${pendientesAhorro.length} socio${pendientesAhorro.length !== 1 ? "s" : ""} bajo objetivo)`;
  secAh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_CLARO } };
  secAh.font = { bold: true, size: 10, color: { argb: AMBER } };
  secAh.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws6.getRow(rowNumAh).height = 18;

  const ahHeader = ws6.addRow(["Socio", "Cuenta", "Objetivo ($)", "Ahorrado ($)", "Pendiente ($)", "% Completado", "Estado", "Tipo"]);
  styleHeader(ahHeader, 8, AMBER);
  for (let c = 1; c <= 8; c++) {
    ahHeader.getCell(c).font = { bold: true, color: { argb: "FF78350f" }, size: 10 };
  }

  if (pendientesAhorro.length === 0) {
    const emptyRow2 = ws6.addRow([objetivoAhorro === 0 ? "Sin objetivo de ahorro configurado" : "✓ Todos los socios alcanzaron su objetivo", "", "", "", "", "", "", ""]);
    for (let c = 1; c <= 8; c++) {
      emptyRow2.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFdcfce7" } };
      emptyRow2.getCell(c).font = { color: { argb: "FF15803d" }, italic: true };
    }
    emptyRow2.height = 16;
  } else {
    let totPendAh = 0;
    pendientesAhorro.forEach((p, i) => {
      totPendAh += p.pendiente;
      const pct = p.objetivo > 0 ? (p.acumulado / p.objetivo) * 100 : 0;
      const esParcial = p.tipo === "Ahorro parcial ⭑";
      const row = ws6.addRow([
        p.socio, p.cuenta,
        p.objetivo, p.acumulado, p.pendiente,
        `${pct.toFixed(1)}%`, "INCOMPLETO", p.tipo,
      ]);
      styleAlternate(row, 8, i % 2 === 0);
      row.getCell(3).numFmt = '"$"#,##0.00';
      row.getCell(4).numFmt = '"$"#,##0.00';
      row.getCell(5).numFmt = '"$"#,##0.00';
      row.getCell(5).font = { color: { argb: ROJO }, bold: true };
      row.getCell(7).font = { color: { argb: AMBER }, bold: true };
      if (esParcial) {
        row.getCell(8).font = { color: { argb: "FF5b21b6" }, bold: true, italic: true };
        row.getCell(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFf5f3ff" } };
      }
    });
    const totAhRow = ws6.addRow(["SUBTOTAL AHORROS PENDIENTES", "", "", "", totPendAh, "", "", ""]);
    styleTotalRow(totAhRow, 8, AMBER_CLARO);
    totAhRow.getCell(5).numFmt = '"$"#,##0.00';
    totAhRow.getCell(5).font = { bold: true, color: { argb: AMBER } };
  }

  ws6.addRow([]);

  // ── Sección 3: Socios de ahorro parcial ───────────────────────────────────
  if (sociosParciales.length > 0) {
    const rowNumParc = ws6.rowCount + 1;
    ws6.mergeCells(`A${rowNumParc}:H${rowNumParc}`);
    const secParc = ws6.getCell(`A${rowNumParc}`);
    secParc.value = `SOCIOS DE AHORRO PARCIAL (${sociosParciales.length} — no participan en aportes de ronda)`;
    secParc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFede9fe" } };
    secParc.font = { bold: true, size: 10, color: { argb: "FF5b21b6" } };
    secParc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    ws6.getRow(rowNumParc).height = 18;

    const parcHeader2 = ws6.addRow(["Socio", "Cuenta", "Ahorrado ($)", "Objetivo ($)", "Restante ($)", "% Completado", "Estado", "Tipo"]);
    styleHeader(parcHeader2, 8);
    for (let c = 1; c <= 8; c++) {
      parcHeader2.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFede9fe" } };
      parcHeader2.getCell(c).font = { bold: true, color: { argb: "FF5b21b6" }, size: 9 };
    }

    let totParcCxC = 0;
    sociosParciales.forEach((sp, i) => {
      const restante = objetivoAhorro > 0 ? Math.max(objetivoAhorro - sp.total, 0) : 0;
      const pct = objetivoAhorro > 0 ? (sp.total / objetivoAhorro) * 100 : 0;
      const cumplido = objetivoAhorro > 0 && restante === 0;
      totParcCxC += sp.total;
      const row = ws6.addRow([
        `${sp.socio.nombres} ${sp.socio.apellidos}`,
        sp.socio.numeroCuenta,
        sp.total,
        objetivoAhorro > 0 ? objetivoAhorro : "—",
        objetivoAhorro > 0 ? restante : "—",
        objetivoAhorro > 0 ? `${pct.toFixed(1)}%` : "—",
        cumplido ? "COMPLETO" : (objetivoAhorro > 0 ? "INCOMPLETO" : "SIN OBJETIVO"),
        "Ahorro parcial ⭑",
      ]);
      styleAlternate(row, 8, i % 2 === 0);
      row.getCell(3).numFmt = '"$"#,##0.00';
      if (objetivoAhorro > 0) {
        row.getCell(4).numFmt = '"$"#,##0.00';
        row.getCell(5).numFmt = '"$"#,##0.00';
        if (!cumplido) row.getCell(5).font = { color: { argb: ROJO }, bold: true };
        row.getCell(7).font = { bold: true, color: { argb: cumplido ? "FF15803d" : AMBER } };
      }
      row.getCell(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFf5f3ff" } };
      row.getCell(8).font = { color: { argb: "FF5b21b6" }, italic: true, bold: true };
    });

    const parcTotRow2 = ws6.addRow(["SUBTOTAL AHORRO PARCIAL", "", totParcCxC, "", "", "", "", ""]);
    styleTotalRow(parcTotRow2, 8, "FFede9fe");
    parcTotRow2.getCell(3).numFmt = '"$"#,##0.00';
    parcTotRow2.getCell(3).font = { bold: true, color: { argb: "FF5b21b6" } };

    ws6.addRow([]);
  }

  // ── Sección 4: Préstamos activos (saldo pendiente) ────────────────────────
  const prestamosConSaldo = ronda.prestamos.filter((p: any) => p.estado === "ACTIVO" && Number(p.saldoActual) > 0);

  const rowNumPr = ws6.rowCount + 1;
  ws6.mergeCells(`A${rowNumPr}:H${rowNumPr}`);
  const secPr = ws6.getCell(`A${rowNumPr}`);
  secPr.value = `PRÉSTAMOS ACTIVOS (${prestamosConSaldo.length} préstamo${prestamosConSaldo.length !== 1 ? "s" : ""} con saldo)`;
  secPr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CLARO } };
  secPr.font = { bold: true, size: 10, color: { argb: AZUL } };
  secPr.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws6.getRow(rowNumPr).height = 18;

  const prHeader = ws6.addRow(["Socio", "Cuenta", "Monto original ($)", "Saldo pendiente ($)", "Tasa (%)", "Cuotas pend.", "Estado", "Fecha inicio"]);
  styleHeader(prHeader, 8, AZUL);
  for (let c = 1; c <= 8; c++) {
    prHeader.getCell(c).font = { bold: true, color: { argb: BLANCO }, size: 10 };
  }

  if (prestamosConSaldo.length === 0) {
    const emptyRow3 = ws6.addRow(["✓ Sin préstamos activos con saldo pendiente", "", "", "", "", "", "", ""]);
    for (let c = 1; c <= 8; c++) {
      emptyRow3.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFdcfce7" } };
      emptyRow3.getCell(c).font = { color: { argb: "FF15803d" }, italic: true };
    }
    emptyRow3.height = 16;
  } else {
    let totSaldoPr = 0;
    prestamosConSaldo.forEach((p: any, i: number) => {
      const cuotasPend = p.cuotas.filter((c: any) => !c.pagada).length;
      totSaldoPr += Number(p.saldoActual);
      const row = ws6.addRow([
        `${p.socio.nombres} ${p.socio.apellidos}`,
        p.socio.numeroCuenta,
        Number(p.monto),
        Number(p.saldoActual),
        Number(p.tasaAnual),
        cuotasPend,
        p.estado,
        new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(p.fechaInicio)),
      ]);
      styleAlternate(row, 8, i % 2 === 0);
      row.getCell(3).numFmt = '"$"#,##0.00';
      row.getCell(4).numFmt = '"$"#,##0.00';
      row.getCell(5).numFmt = '0.00"%"';
      row.getCell(4).font = { color: { argb: AZUL }, bold: true };
      row.getCell(7).font = { color: { argb: AZUL }, bold: true };
    });
    const totPrRow = ws6.addRow(["SUBTOTAL SALDO PRÉSTAMOS", "", "", totSaldoPr, "", "", "", ""]);
    styleTotalRow(totPrRow, 8, AZUL_CLARO);
    totPrRow.getCell(4).numFmt = '"$"#,##0.00';
    totPrRow.getCell(4).font = { bold: true, color: { argb: AZUL } };
  }

  ws6.addRow([]);

  // ── Sección 4: Multas pendientes de cobro ─────────────────────────────────
  const multasPendientes = (ronda.movimientosCaja ?? []).filter((m: any) => m.tipo === "MULTA" && m.estado === "PENDIENTE");

  const rowNumMul = ws6.rowCount + 1;
  ws6.mergeCells(`A${rowNumMul}:H${rowNumMul}`);
  const secMul = ws6.getCell(`A${rowNumMul}`);
  secMul.value = `MULTAS PENDIENTES DE COBRO (${multasPendientes.length} registro${multasPendientes.length !== 1 ? "s" : ""})`;
  secMul.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFfef9c3" } };
  secMul.font = { bold: true, size: 10, color: { argb: "FFa16207" } };
  secMul.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws6.getRow(rowNumMul).height = 18;

  const mulHeader = ws6.addRow(["Socio", "Cuenta", "Semana", "Monto ($)", "Observación", "", "", ""]);
  styleHeader(mulHeader, 8, "FFd97706");
  for (let c = 1; c <= 8; c++) mulHeader.getCell(c).font = { bold: true, color: { argb: BLANCO }, size: 10 };

  if (multasPendientes.length === 0) {
    const emptyMul = ws6.addRow(["✓ Sin multas pendientes", "", "", "", "", "", "", ""]);
    for (let c = 1; c <= 8; c++) {
      emptyMul.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFdcfce7" } };
      emptyMul.getCell(c).font = { color: { argb: "FF15803d" }, italic: true };
    }
    emptyMul.height = 16;
  } else {
    let totMul = 0;
    multasPendientes.forEach((m: any, i: number) => {
      totMul += Number(m.monto);
      const row = ws6.addRow([
        `${m.socio?.nombres ?? ""} ${m.socio?.apellidos ?? ""}`,
        m.socio?.numeroCuenta ?? "",
        m.semana ?? "",
        Number(m.monto),
        m.descripcion ?? "",
        "", "", "",
      ]);
      styleAlternate(row, 8, i % 2 === 0);
      row.getCell(4).numFmt = '"$"#,##0.00';
      row.getCell(4).font = { color: { argb: "FFa16207" }, bold: true };
    });
    const totMulRow = ws6.addRow(["SUBTOTAL MULTAS PENDIENTES", "", "", totMul, "", "", "", ""]);
    styleTotalRow(totMulRow, 8, "FFfef9c3");
    totMulRow.getCell(4).numFmt = '"$"#,##0.00';
    totMulRow.getCell(4).font = { bold: true, color: { argb: "FFa16207" } };
  }

  ws6.addRow([]);

  // ── Sección 5: Préstamos Express pendientes ───────────────────────────────
  const expressActivos = (ronda.prestamosExpress ?? []).filter((pe: any) => pe.estado === "PENDIENTE");

  const rowNumEx = ws6.rowCount + 1;
  ws6.mergeCells(`A${rowNumEx}:H${rowNumEx}`);
  const secEx = ws6.getCell(`A${rowNumEx}`);
  secEx.value = `PRÉSTAMOS EXPRESS PENDIENTES (${expressActivos.length} pendiente${expressActivos.length !== 1 ? "s" : ""})`;
  secEx.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFf3e8ff" } };
  secEx.font = { bold: true, size: 10, color: { argb: "FF7c3aed" } };
  secEx.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws6.getRow(rowNumEx).height = 18;

  const exHeader = ws6.addRow(["Socio", "Cuenta", "Sem. origen", "Principal ($)", "Interés ($)", "Total ($)", "Vence sem.", "Observaciones"]);
  styleHeader(exHeader, 8, "FF7c3aed");
  for (let c = 1; c <= 8; c++) exHeader.getCell(c).font = { bold: true, color: { argb: BLANCO }, size: 10 };

  if (expressActivos.length === 0) {
    const emptyRow4 = ws6.addRow(["✓ Sin préstamos express pendientes", "", "", "", "", "", "", ""]);
    for (let c = 1; c <= 8; c++) {
      emptyRow4.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFdcfce7" } };
      emptyRow4.getCell(c).font = { color: { argb: "FF15803d" }, italic: true };
    }
    emptyRow4.height = 16;
  } else {
    let totEx = 0;
    expressActivos.forEach((pe: any, i: number) => {
      // interesAcumulado es el campo nuevo, interes es el viejo — soporte ambos
      const interes = Number(pe.interesAcumulado ?? pe.interes ?? 0);
      const total = Number(pe.total ?? (Number(pe.principal) + interes));
      totEx += total;
      const row = ws6.addRow([
        `${pe.socio.nombres} ${pe.socio.apellidos}`,
        pe.socio.numeroCuenta,
        pe.semana,
        Number(pe.principal),
        interes,
        total,
        pe.semanaVencimiento ?? (pe.semana + 1),
        pe.observaciones ?? "",
      ]);
      styleAlternate(row, 8, i % 2 === 0);
      row.getCell(4).numFmt = '"$"#,##0.00';
      row.getCell(5).numFmt = '"$"#,##0.00';
      row.getCell(6).numFmt = '"$"#,##0.00';
      row.getCell(5).font = { color: { argb: "FF7c3aed" }, bold: true };
      row.getCell(6).font = { bold: true };
    });
    const totExRow = ws6.addRow(["SUBTOTAL EXPRESS", "", "", "", "", totEx, "", ""]);
    styleTotalRow(totExRow, 8, "FFf3e8ff");
    totExRow.getCell(6).numFmt = '"$"#,##0.00';
  }

  ws6.addRow([]);

  // ── Resumen total CxC ─────────────────────────────────────────────────────
  const totalAportesPend = pendientesAporte.reduce((a, p) => a + p.monto, 0);
  const totalAhorrosPend = pendientesAhorro.reduce((a, p) => a + p.pendiente, 0);
  const totalPrestPend = prestamosConSaldo.reduce((a: number, p: any) => a + Number(p.saldoActual), 0);
  const totalExpressPend = expressActivos.reduce((a: number, pe: any) => a + Number(pe.total ?? (Number(pe.principal) + Number(pe.interesAcumulado ?? pe.interes ?? 0))), 0);
  const totalMultasPend = multasPendientes.reduce((a: number, m: any) => a + Number(m.monto), 0);
  const grandTotal = totalAportesPend + totalAhorrosPend + totalPrestPend + totalExpressPend + totalMultasPend;

  const rowNumRes = ws6.rowCount + 1;
  ws6.mergeCells(`A${rowNumRes}:H${rowNumRes}`);
  const secRes = ws6.getCell(`A${rowNumRes}`);
  secRes.value = "RESUMEN TOTAL CUENTAS POR COBRAR";
  secRes.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  secRes.font = { bold: true, size: 11, color: { argb: BLANCO } };
  secRes.alignment = { horizontal: "center", vertical: "middle" };
  ws6.getRow(rowNumRes).height = 22;

  const resRows: [string, number][] = [
    ["Aportes pendientes", totalAportesPend],
    ["Ahorros pendientes (bajo objetivo)", totalAhorrosPend],
    ["Saldo préstamos activos", totalPrestPend],
    ["Multas pendientes de cobro", totalMultasPend],
    ["Préstamos express pendientes", totalExpressPend],
  ];
  resRows.forEach(([label, val], i) => {
    const row = ws6.addRow([label, "", "", val, "", "", "", ""]);
    styleAlternate(row, 8, i % 2 === 0);
    row.getCell(1).font = { bold: false, size: 10 };
    row.getCell(4).numFmt = '"$"#,##0.00';
    row.getCell(4).font = { bold: true };
    if (label.includes("Multas")) row.getCell(4).font = { bold: true, color: { argb: "FFa16207" } };
    if (label.includes("express")) row.getCell(4).font = { bold: true, color: { argb: "FF7c3aed" } };
  });

  const grandTotRow = ws6.addRow(["TOTAL GENERAL POR COBRAR", "", "", grandTotal, "", "", "", ""]);
  styleTotalRow(grandTotRow, 8, VERDE_CLARO);
  grandTotRow.getCell(1).font = { bold: true, size: 11 };
  grandTotRow.getCell(4).numFmt = '"$"#,##0.00';
  grandTotRow.getCell(4).value = grandTotal;
  grandTotRow.getCell(4).font = { bold: true, size: 11, color: { argb: VERDE } };
  grandTotRow.height = 22;

  const buf = await wb.xlsx.writeBuffer();
  return buf as Buffer;
}
