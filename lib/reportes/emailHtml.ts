// lib/reportes/emailHtml.ts
export function emailHtml(ronda: any, mes: string): string {
  const totalAportes = ronda.aportes.reduce((a: number, x: any) => a + Number(x.monto), 0);
  const totalAhorros = ronda.ahorros.reduce((a: number, x: any) => a + Number(x.monto), 0);
  const totalFondo = ronda.cuentasInversion.reduce((a: number, x: any) => a + Number(x.montoInvertido), 0);
  const totalIntereses = ronda.cuentasInversion.reduce((a: number, x: any) => a + Number(x.interesesAcumulados), 0);
  const prestamosActivos = ronda.prestamos.filter((p: any) => p.estado === "ACTIVO");
  const totalSaldoPrestamos = prestamosActivos.reduce((a: number, p: any) => a + Number(p.saldoActual), 0);
  const fecha = new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" });

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

  const kpis = [
    { label: "Total aportes", value: fmt(totalAportes), color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
    { label: "Total ahorros", value: fmt(totalAhorros), color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
    { label: "Fondo inversión", value: fmt(totalFondo), color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
    { label: "Intereses acum.", value: fmt(totalIntereses), color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    { label: "Saldo préstamos", value: fmt(totalSaldoPrestamos), color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    { label: "Participantes", value: String(ronda.participaciones.length), color: "#1a3a2a", bg: "#f0f7f4", border: "#bbf7d0" },
  ];

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte MiRonda</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="background:#1a3a2a;border-radius:16px;padding:28px 32px;text-align:center;margin-bottom:20px">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 20px;margin-bottom:12px">
        <span style="color:#f6c94e;font-size:22px;font-weight:bold;letter-spacing:1px">MiRonda</span>
      </div>
      <h1 style="color:#ffffff;margin:0 0 6px;font-size:20px;font-weight:bold">Reporte Mensual</h1>
      <p style="color:#86efac;margin:0;font-size:14px">${ronda.nombre} &nbsp;·&nbsp; ${mes}</p>
      <p style="color:#6ee7b7;margin:6px 0 0;font-size:12px">Generado el ${fecha}</p>
    </div>

    <!-- Info ronda -->
    <div style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:16px 20px;margin-bottom:16px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 8px;text-align:center">
            <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Ronda</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:bold;color:#1a3a2a">${ronda.nombre}</p>
          </td>
          <td style="padding:4px 8px;text-align:center;border-left:1px solid #e5e7eb">
            <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Semana</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:bold;color:#1a3a2a">${ronda.semanaActual} / ${ronda.participaciones.length}</p>
          </td>
          <td style="padding:4px 8px;text-align:center;border-left:1px solid #e5e7eb">
            <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Progreso</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:bold;color:#1a3a2a">${Math.round((ronda.semanaActual / ronda.participaciones.length) * 100)}%</p>
          </td>
          <td style="padding:4px 8px;text-align:center;border-left:1px solid #e5e7eb">
            <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Inicio</p>
            <p style="margin:4px 0 0;font-size:13px;font-weight:bold;color:#1a3a2a">${new Date(ronda.fechaInicio).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- KPIs grid -->
    <table width="100%" cellpadding="6" cellspacing="0" style="margin-bottom:16px">
      <tr>
        ${kpis.slice(0, 3).map(k => `
        <td width="33%" style="padding:6px">
          <div style="background:${k.bg};border:1px solid ${k.border};border-radius:10px;padding:14px 12px;text-align:center">
            <p style="margin:0 0 4px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">${k.label}</p>
            <p style="margin:0;font-size:16px;font-weight:bold;color:${k.color}">${k.value}</p>
          </div>
        </td>`).join("")}
      </tr>
      <tr>
        ${kpis.slice(3).map(k => `
        <td width="33%" style="padding:6px">
          <div style="background:${k.bg};border:1px solid ${k.border};border-radius:10px;padding:14px 12px;text-align:center">
            <p style="margin:0 0 4px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">${k.label}</p>
            <p style="margin:0;font-size:16px;font-weight:bold;color:${k.color}">${k.value}</p>
          </div>
        </td>`).join("")}
      </tr>
    </table>

    <!-- Préstamos activos -->
    ${prestamosActivos.length > 0 ? `
    <div style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:16px">
      <div style="background:#fef9f0;padding:12px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13px;font-weight:bold;color:#1f2937">Préstamos activos</span>
        <span style="background:#fed7aa;color:#c2410c;font-size:11px;font-weight:bold;padding:2px 10px;border-radius:20px">${prestamosActivos.length}</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr style="background:#f9fafb">
          <th style="padding:8px 16px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:600">Socio</th>
          <th style="padding:8px 16px;text-align:right;font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:600">Monto</th>
          <th style="padding:8px 16px;text-align:right;font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:600">Saldo</th>
          <th style="padding:8px 16px;text-align:center;font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:600">Cuotas</th>
        </tr>
        ${prestamosActivos.map((p: any, i: number) => {
          const pagadas = p.cuotas.filter((c: any) => c.pagada).length;
          return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'};border-top:1px solid #f3f4f6">
            <td style="padding:10px 16px">
              <p style="margin:0;font-size:12px;font-weight:bold;color:#1f2937">${p.socio.nombres} ${p.socio.apellidos}</p>
              <p style="margin:2px 0 0;font-size:10px;color:#9ca3af;font-family:monospace">${p.socio.numeroCuenta}</p>
            </td>
            <td style="padding:10px 16px;text-align:right;font-size:12px;color:#374151">${fmt(Number(p.monto))}</td>
            <td style="padding:10px 16px;text-align:right;font-size:12px;font-weight:bold;color:#dc2626">${fmt(Number(p.saldoActual))}</td>
            <td style="padding:10px 16px;text-align:center;font-size:11px;color:#6b7280">${pagadas}/${p.cuotas.length}</td>
          </tr>`;
        }).join("")}
        <tr style="background:#fef2f2;border-top:2px solid #fecaca">
          <td colspan="2" style="padding:10px 16px;font-size:12px;font-weight:bold;color:#dc2626">Total saldo pendiente</td>
          <td style="padding:10px 16px;text-align:right;font-size:13px;font-weight:bold;color:#dc2626">${fmt(totalSaldoPrestamos)}</td>
          <td></td>
        </tr>
      </table>
    </div>` : `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:16px 20px;margin-bottom:16px;text-align:center">
      <p style="margin:0;color:#15803d;font-size:13px;font-weight:bold">✓ Sin préstamos activos pendientes</p>
    </div>`}

    <!-- Adjuntos info -->
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 20px;margin-bottom:20px">
      <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#1e40af">📎 Archivos adjuntos</p>
      <p style="margin:0 0 4px;font-size:12px;color:#3b82f6">📊 <strong>Excel</strong> — Participantes, Préstamos y Fondo de Inversión (3 hojas)</p>
      <p style="margin:0;font-size:12px;color:#3b82f6">📄 <strong>PDF</strong> — Resumen ejecutivo con KPIs y tablas detalladas (3 páginas)</p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0">
      <p style="color:#9ca3af;font-size:11px;margin:0">Este reporte fue generado automáticamente por MiRonda</p>
      <p style="color:#9ca3af;font-size:11px;margin:4px 0 0">Sistema de gestión de rondas de ahorro</p>
    </div>
  </div>
</body>
</html>`;
}
