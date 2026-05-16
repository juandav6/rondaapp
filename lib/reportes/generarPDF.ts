// lib/reportes/generarPDF.ts
// Genera un PDF simple sin dependencias externas de fuentes
// Compatible 100% con Vercel serverless

const fmt = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Genera un PDF mínimo válido con texto plano usando solo especificación PDF 1.4
export async function generarPDF(ronda: any): Promise<Buffer> {
  const mes = new Date().toLocaleDateString("es-EC", { month: "long", year: "numeric" });
  const fechaGen = new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });

  const totalAportes = ronda.aportes.reduce((a: number, x: any) => a + Number(x.monto), 0);
  const totalAhorros = ronda.ahorros.reduce((a: number, x: any) => a + Number(x.monto), 0);
  const totalFondo = ronda.cuentasInversion.reduce((a: number, x: any) => a + Number(x.montoInvertido), 0);
  const totalIntereses = ronda.cuentasInversion.reduce((a: number, x: any) => a + Number(x.interesesAcumulados), 0);
  const prestamosActivos = ronda.prestamos.filter((p: any) => p.estado === "ACTIVO");
  const totalSaldo = prestamosActivos.reduce((a: number, p: any) => a + Number(p.saldoActual), 0);

  // Construir líneas de texto del reporte
  const lines: { text: string; bold?: boolean; indent?: number; separator?: boolean; blank?: boolean }[] = [];

  const sep = () => lines.push({ text: "─".repeat(80), separator: true });
  const blank = () => lines.push({ text: "", blank: true });
  const title = (t: string) => lines.push({ text: t, bold: true });
  const row = (label: string, value: string, indent = 0) =>
    lines.push({ text: `${" ".repeat(indent)}${label.padEnd(40 - indent, ".")}${value}`, indent });

  // Encabezado
  lines.push({ text: "MIRONDA - SISTEMA DE GESTION DE RONDAS DE AHORRO", bold: true });
  lines.push({ text: `Reporte Mensual - ${ronda.nombre} - ${mes}` });
  lines.push({ text: `Generado: ${fechaGen}` });
  sep();

  // Resumen general
  blank();
  title("RESUMEN GENERAL");
  sep();
  row("Total aportes", fmt(totalAportes));
  row("Total ahorros", fmt(totalAhorros));
  row("Fondo de inversion", fmt(totalFondo));
  row("Intereses acumulados", fmt(totalIntereses));
  row("Saldo prestamos activos", fmt(totalSaldo));
  row("Participantes", String(ronda.participaciones.length));
  row("Semana actual", `${ronda.semanaActual} / ${ronda.participaciones.length}`);

  // Participantes
  blank();
  title(`PARTICIPANTES (${ronda.participaciones.length})`);
  sep();
  lines.push({ text: `${"#".padEnd(4)}${"Cuenta".padEnd(12)}${"Nombre".padEnd(35)}${"Aportes".padStart(12)}${"Ahorros".padStart(12)}`, bold: true });
  sep();
  ronda.participaciones.forEach((p: any) => {
    const tA = ronda.aportes.filter((a: any) => a.socioId === p.socioId).reduce((s: number, x: any) => s + Number(x.monto), 0);
    const tAh = ronda.ahorros.filter((a: any) => a.socioId === p.socioId).reduce((s: number, x: any) => s + Number(x.monto), 0);
    const nombre = `${p.socio.nombres} ${p.socio.apellidos}`.substring(0, 33);
    lines.push({ text: `${String(p.orden).padEnd(4)}${p.socio.numeroCuenta.padEnd(12)}${nombre.padEnd(35)}${fmt(tA).padStart(12)}${fmt(tAh).padStart(12)}` });
  });

  // Prestamos
  if (ronda.prestamos.length > 0) {
    blank();
    title(`PRESTAMOS (${ronda.prestamos.length})`);
    sep();
    lines.push({ text: `${"Socio".padEnd(30)}${"Monto".padStart(12)}${"Saldo".padStart(12)}${"Estado".padEnd(12)}${"Cuotas".padStart(10)}`, bold: true });
    sep();
    ronda.prestamos.forEach((p: any) => {
      const pag = p.cuotas.filter((c: any) => c.pagada).length;
      const nombre = `${p.socio.nombres} ${p.socio.apellidos}`.substring(0, 28);
      lines.push({ text: `${nombre.padEnd(30)}${fmt(Number(p.monto)).padStart(12)}${fmt(Number(p.saldoActual)).padStart(12)}${p.estado.padEnd(12)}${`${pag}/${p.cuotas.length}`.padStart(10)}` });
    });
  }

  // Fondo inversión
  if (ronda.cuentasInversion.length > 0) {
    blank();
    title(`FONDO DE INVERSION`);
    sep();
    lines.push({ text: `${"Socio".padEnd(30)}${"Invertido".padStart(12)}${"% Part.".padStart(10)}${"Intereses".padStart(12)}${"Total".padStart(12)}`, bold: true });
    sep();
    ronda.cuentasInversion.forEach((ci: any) => {
      const nombre = `${ci.socio.nombres} ${ci.socio.apellidos}`.substring(0, 28);
      lines.push({ text: `${nombre.padEnd(30)}${fmt(Number(ci.montoInvertido)).padStart(12)}${`${Number(ci.porcentajeParticipacion).toFixed(2)}%`.padStart(10)}${fmt(Number(ci.interesesAcumulados)).padStart(12)}${fmt(Number(ci.montoInvertido) + Number(ci.interesesAcumulados)).padStart(12)}` });
    });
  }

  blank();
  sep();
  lines.push({ text: "MiRonda - Sistema de gestion de rondas de ahorro" });

  // ── Construir PDF manualmente (PDF 1.4 estándar) ──────────────────────────
  const objects: string[] = [];
  const offsets: number[] = [];
  let pos = 0;

  const addObj = (content: string): number => {
    const id = objects.length + 1;
    offsets.push(pos);
    const obj = `${id} 0 obj\n${content}\nendobj\n`;
    objects.push(obj);
    pos += Buffer.byteLength(obj, "latin1");
    return id;
  };

  // Objeto 1: Catálogo (se llenará después)
  // Objeto 2: Páginas (se llenará después)
  // Primero construimos el stream de contenido

  const FONT_SIZE_TITLE = 11;
  const FONT_SIZE_NORMAL = 8;
  const LINE_HEIGHT = 12;
  const MARGIN_LEFT = 40;
  const MARGIN_TOP = 780;
  const PAGE_MIN_Y = 40;
  const PAGE_WIDTH = 595;
  const PAGE_HEIGHT = 842;

  // Escapar texto para PDF
  const escapePDF = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  // Generar streams de páginas
  const pageStreams: string[] = [];
  let currentStream = "";
  let currentY = MARGIN_TOP;

  const newPage = () => {
    if (currentStream) pageStreams.push(currentStream);
    currentStream = "";
    currentY = MARGIN_TOP;
  };

  const addLine = (line: typeof lines[0]) => {
    if (currentY < PAGE_MIN_Y + 30) newPage();

    const fontSize = line.bold ? FONT_SIZE_TITLE : FONT_SIZE_NORMAL;
    const font = line.bold ? "F2" : "F1";

    if (line.blank) {
      currentY -= LINE_HEIGHT * 0.5;
      return;
    }

    if (line.separator) {
      currentStream += `0.8 g\n${MARGIN_LEFT} ${currentY - 1} ${PAGE_WIDTH - 80} 0.5 re f\n0 g\n`;
      currentY -= LINE_HEIGHT * 0.6;
      return;
    }

    const text = escapePDF(line.text || "");
    currentStream += `BT\n/${font} ${fontSize} Tf\n${MARGIN_LEFT} ${currentY} Td\n(${text}) Tj\nET\n`;
    currentY -= LINE_HEIGHT;
  };

  // Iniciar primer stream
  currentStream = "";

  for (const line of lines) {
    addLine(line);
  }
  if (currentStream) pageStreams.push(currentStream);

  // Ahora construir el PDF
  const header = "%PDF-1.4\n";
  pos = Buffer.byteLength(header, "latin1");

  // Reset objetos
  const pdfParts: Buffer[] = [Buffer.from(header, "latin1")];
  const xrefOffsets: number[] = [];
  let objCount = 0;

  const writeObj = (id: number, content: string) => {
    xrefOffsets[id] = pdfParts.reduce((s, b) => s + b.length, 0);
    const obj = `${id} 0 obj\n${content}\nendobj\n`;
    pdfParts.push(Buffer.from(obj, "latin1"));
  };

  const totalObjs = 4 + pageStreams.length * 2; // catalog, pages, font1, font2, + pages
  objCount = totalObjs;

  // IDs fijos
  const CATALOG_ID = 1;
  const PAGES_ID = 2;
  const FONT1_ID = 3;
  const FONT2_ID = 4;
  const FIRST_PAGE_ID = 5;

  // Font Courier
  writeObj(FONT1_ID, `<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Courier\n/Encoding /WinAnsiEncoding\n>>`);
  writeObj(FONT2_ID, `<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Courier-Bold\n/Encoding /WinAnsiEncoding\n>>`);

  // Páginas
  const pageIds: number[] = [];
  pageStreams.forEach((stream, i) => {
    const streamBytes = Buffer.from(stream, "latin1");
    const contentId = FIRST_PAGE_ID + i * 2;
    const pageId = FIRST_PAGE_ID + i * 2 + 1;

    writeObj(contentId, `<<\n/Length ${streamBytes.length}\n>>\nstream\n${stream}\nendstream`);
    writeObj(pageId, `<<\n/Type /Page\n/Parent ${PAGES_ID} 0 R\n/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]\n/Contents ${contentId} 0 R\n/Resources <<\n/Font <<\n/F1 ${FONT1_ID} 0 R\n/F2 ${FONT2_ID} 0 R\n>>\n>>\n>>`);
    pageIds.push(pageId);
  });

  const kidsStr = pageIds.map(id => `${id} 0 R`).join(" ");
  writeObj(PAGES_ID, `<<\n/Type /Pages\n/Kids [${kidsStr}]\n/Count ${pageIds.length}\n>>`);
  writeObj(CATALOG_ID, `<<\n/Type /Catalog\n/Pages ${PAGES_ID} 0 R\n>>`);

  // xref
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
