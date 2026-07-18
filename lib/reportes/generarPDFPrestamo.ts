// lib/reportes/generarPDFPrestamo.ts
// PDF de tabla de amortización completa — mismo patrón que generarPDF.ts (PDF 1.4, sin deps externas)

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const fmtMoney = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

const fmtDateLong = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

export async function generarPDFPrestamo(prestamo: any): Promise<Buffer> {
  const fechaGen = fmtDate(new Date().toISOString());

  const cuotas: any[] = prestamo.cuotas ?? [];
  const cuotasPagadas = cuotas.filter((c: any) => c.pagada).length;
  const totalPagado = cuotas.filter((c: any) => c.pagada).reduce((s: number, c: any) => s + Number(c.cuota), 0);
  const capitalPagado = cuotas.filter((c: any) => c.pagada).reduce((s: number, c: any) => s + Number(c.capital), 0);
  const interesPagado = cuotas.filter((c: any) => c.pagada).reduce((s: number, c: any) => s + Number(c.interes), 0);
  const capitalPendiente = cuotas.filter((c: any) => !c.pagada).reduce((s: number, c: any) => s + Number(c.capital), 0);
  const interesPendiente = cuotas.filter((c: any) => !c.pagada).reduce((s: number, c: any) => s + Number(c.interes), 0);
  const totalCuota = cuotas.reduce((s: number, c: any) => s + Number(c.cuota), 0);
  const totalCapital = cuotas.reduce((s: number, c: any) => s + Number(c.capital), 0);
  const totalInteres = cuotas.reduce((s: number, c: any) => s + Number(c.interes), 0);

  // Anchos de columna (caracteres Courier). SP = separador entre bloques.
  // Total: 4+2+13+12+12+11+12+2+4+2+13 = 87 chars — cabe holgado en ~107 disponibles
  const SP = "  ";
  const C = { num: 4, fecha: 13, cuota: 12, capital: 12, interes: 11, saldo: 12, pago: 4, fechaPago: 13 };

  const colHeader =
    "Nro".padStart(C.num) + SP +
    "Vencimiento".padEnd(C.fecha) +
    "Cuota".padStart(C.cuota) +
    "Capital".padStart(C.capital) +
    "Interes".padStart(C.interes) +
    "Saldo".padStart(C.saldo) + SP +
    "Pago".padStart(C.pago) + SP +
    "Fecha Pago";

  const colRow = (c: any) =>
    String(c.numero).padStart(C.num) + SP +
    fmtDate(c.fechaVenc).padEnd(C.fecha) +
    fmtMoney(Number(c.cuota)).padStart(C.cuota) +
    fmtMoney(Number(c.capital)).padStart(C.capital) +
    fmtMoney(Number(c.interes)).padStart(C.interes) +
    fmtMoney(Number(c.saldo)).padStart(C.saldo) + SP +
    (c.pagada ? "Si" : "No").padStart(C.pago) + SP +
    (c.fechaPago ? fmtDate(c.fechaPago) : "—");

  // Totales: solo cuota, capital e interés (saldo final = 0 por definición)
  const prefixW = C.num + SP.length + C.fecha;
  const colTotal =
    "TOTALES".padStart(prefixW) +
    fmtMoney(totalCuota).padStart(C.cuota) +
    fmtMoney(totalCapital).padStart(C.capital) +
    fmtMoney(totalInteres).padStart(C.interes);

  // ── Construir líneas del documento ────────────────────────────────────────
  type Line = { text: string; bold?: boolean; separator?: boolean; blank?: boolean };
  const lines: Line[] = [];

  const sep  = ()             => lines.push({ text: "", separator: true });
  const blank = ()            => lines.push({ text: "", blank: true });
  const bold  = (t: string)   => lines.push({ text: t, bold: true });
  const norm  = (t: string)   => lines.push({ text: t });
  const row2  = (l: string, v: string, l2: string, v2: string) =>
    norm(`${l.padEnd(22)}${v.padEnd(22)}  ${l2.padEnd(22)}${v2}`);

  // Encabezado
  bold("MIRONDA - TABLA DE AMORTIZACION DE PRESTAMO");
  sep();
  blank();
  bold(`Prestamo #${prestamo.id}`);
  blank();
  row2("Socio:", `${prestamo.socio?.nombres} ${prestamo.socio?.apellidos}`,
       "Cuenta:", prestamo.socio?.numeroCuenta ?? "—");
  row2("Ronda:", prestamo.ronda?.nombre ?? "—",
       "Estado:", prestamo.estado);
  blank();
  sep();
  row2("Monto original:", fmtMoney(Number(prestamo.monto)),
       "Tasa anual:", `${Number(prestamo.tasaAnual).toFixed(2)}%`);
  row2("Plazo:", `${prestamo.plazoMeses} meses`,
       "Fecha inicio:", fmtDateLong(prestamo.fechaInicio));
  row2("Saldo actual:", fmtMoney(Number(prestamo.saldoActual)),
       "Cuotas pagadas:", `${cuotasPagadas} de ${cuotas.length}`);
  norm(`Generado:             ${fechaGen}`);
  sep();
  blank();

  // Tabla de amortización
  bold("TABLA DE AMORTIZACION COMPLETA");
  sep();
  lines.push({ text: colHeader, bold: true });
  sep();

  for (const c of cuotas) {
    lines.push({ text: colRow(c) });
  }

  sep();
  lines.push({ text: colTotal, bold: true });
  sep();
  blank();

  // Resumen
  bold("RESUMEN DEL PRESTAMO");
  sep();
  const r = (label: string, value: string) =>
    norm(`${label.padEnd(35)}${value}`);

  r("Capital total prestado:",          fmtMoney(Number(prestamo.monto)));
  r("Capital pagado:",                  `${fmtMoney(capitalPagado)}  (${cuotasPagadas} cuotas)`);
  r("Capital pendiente:",               `${fmtMoney(capitalPendiente)}  (${cuotas.length - cuotasPagadas} cuotas)`);
  blank();
  r("Interes total del prestamo:",      fmtMoney(totalInteres));
  r("Interes pagado:",                  fmtMoney(interesPagado));
  r("Interes pendiente:",               fmtMoney(interesPendiente));
  blank();
  r("Total de cuotas (capital+interes):", fmtMoney(totalCuota));
  r("Total pagado:",                    fmtMoney(totalPagado));
  r("Total pendiente:",                 fmtMoney(totalCuota - totalPagado));

  if (prestamo.estado === "CANCELADO" && prestamo.notaCancelacion) {
    blank();
    sep();
    bold(`CANCELADO: ${prestamo.notaCancelacion}`);
  }

  // Firmas — espacio para escribir + etiquetas con nombres
  blank();
  blank();
  blank();
  blank();
  blank();
  const GAP    = 14;
  const FIRMA_W = 34;
  const linea   = "_".repeat(FIRMA_W);
  const socioNombre = `${prestamo.socio?.nombres ?? ""} ${prestamo.socio?.apellidos ?? ""}`.trim();

  norm(`${linea}${" ".repeat(GAP)}${linea}`);
  blank();
  norm(`${"Responsable de la ronda".padEnd(FIRMA_W + GAP)}${socioNombre}`);
  norm(`${"".padEnd(FIRMA_W + GAP)}Elaborado por`);
  blank();
  sep();
  norm("MiRonda - Sistema de gestion de rondas de ahorro");

  // ── Construir PDF 1.4 (mismo mecanismo que generarPDF.ts) ─────────────────
  const FONT_SIZE_TITLE  = 10;
  const FONT_SIZE_NORMAL =  8;
  const LINE_HEIGHT      = 12;
  const MARGIN_LEFT      = 40;
  const MARGIN_TOP       = 780;
  const PAGE_MIN_Y       = 50;
  const PAGE_WIDTH       = 595;
  const PAGE_HEIGHT      = 842;

  const escapePDF = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const pageStreams: string[] = [];
  let currentStream = "";
  let currentY = MARGIN_TOP;

  const newPage = () => {
    if (currentStream) pageStreams.push(currentStream);
    currentStream = "";
    currentY = MARGIN_TOP;
  };

  const addLine = (line: Line) => {
    if (currentY < PAGE_MIN_Y + 30) newPage();

    if (line.blank) {
      currentY -= LINE_HEIGHT * 0.5;
      return;
    }
    if (line.separator) {
      currentStream += `0.85 g\n${MARGIN_LEFT} ${currentY - 1} ${PAGE_WIDTH - 80} 0.5 re f\n0 g\n`;
      currentY -= LINE_HEIGHT * 0.55;
      return;
    }

    const fontSize = line.bold ? FONT_SIZE_TITLE : FONT_SIZE_NORMAL;
    const font     = line.bold ? "F2" : "F1";
    const text     = escapePDF(line.text ?? "");
    currentStream += `BT\n/${font} ${fontSize} Tf\n${MARGIN_LEFT} ${currentY} Td\n(${text}) Tj\nET\n`;
    currentY -= LINE_HEIGHT;
  };

  for (const line of lines) {
    addLine(line);
  }
  if (currentStream) pageStreams.push(currentStream);

  // Ensamblar PDF
  const header = "%PDF-1.4\n";
  const pdfParts: Buffer[] = [Buffer.from(header, "latin1")];
  const xrefOffsets: number[] = [];

  const writeObj = (id: number, content: string) => {
    xrefOffsets[id] = pdfParts.reduce((s, b) => s + b.length, 0);
    pdfParts.push(Buffer.from(`${id} 0 obj\n${content}\nendobj\n`, "latin1"));
  };

  const CATALOG_ID    = 1;
  const PAGES_ID      = 2;
  const FONT1_ID      = 3;
  const FONT2_ID      = 4;
  const FIRST_PAGE_ID = 5;

  writeObj(FONT1_ID, `<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Courier\n/Encoding /WinAnsiEncoding\n>>`);
  writeObj(FONT2_ID, `<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Courier-Bold\n/Encoding /WinAnsiEncoding\n>>`);

  const pageIds: number[] = [];
  pageStreams.forEach((stream, i) => {
    const streamBytes = Buffer.from(stream, "latin1");
    const contentId   = FIRST_PAGE_ID + i * 2;
    const pageId      = FIRST_PAGE_ID + i * 2 + 1;
    writeObj(contentId, `<<\n/Length ${streamBytes.length}\n>>\nstream\n${stream}\nendstream`);
    writeObj(pageId, `<<\n/Type /Page\n/Parent ${PAGES_ID} 0 R\n/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]\n/Contents ${contentId} 0 R\n/Resources <<\n/Font <<\n/F1 ${FONT1_ID} 0 R\n/F2 ${FONT2_ID} 0 R\n>>\n>>\n>>`);
    pageIds.push(pageId);
  });

  const kidsStr = pageIds.map(id => `${id} 0 R`).join(" ");
  writeObj(PAGES_ID, `<<\n/Type /Pages\n/Kids [${kidsStr}]\n/Count ${pageIds.length}\n>>`);
  writeObj(CATALOG_ID, `<<\n/Type /Catalog\n/Pages ${PAGES_ID} 0 R\n>>`);

  const xrefOffset = pdfParts.reduce((s, b) => s + b.length, 0);
  const maxId = Math.max(...Object.keys(xrefOffsets).map(Number));
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxId; i++) {
    const off = xrefOffsets[i] ?? 0;
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<<\n/Size ${maxId + 1}\n/Root ${CATALOG_ID} 0 R\n>>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  pdfParts.push(Buffer.from(xref, "latin1"));

  return Buffer.concat(pdfParts);
}
