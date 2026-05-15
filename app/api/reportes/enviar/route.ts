// app/api/reportes/enviar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";
import { generarExcel } from "@/lib/reportes/generarExcel";
import { generarPDF } from "@/lib/reportes/generarPDF";
import { emailHtml } from "@/lib/reportes/emailHtml";

// Transporter Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER!,
    pass: process.env.GMAIL_APP_PASSWORD!,
  },
});

export async function POST(req: NextRequest) {
  // Verificar: admin manual O cron interno
  const cronSecret = req.headers.get("x-cron-secret");
  const esCron = cronSecret === process.env.CRON_SECRET;

  if (!esCron) {
    const session = await getServerSession(authOptions);
    if ((session?.user as any)?.rol !== "ADMIN")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // Obtener ronda activa con todos los datos
  const ronda = await prisma.ronda.findFirst({
    where: { activa: true },
    include: {
      participaciones: {
        include: { socio: true },
        orderBy: { orden: "asc" },
      },
      aportes: { include: { socio: true } },
      ahorros: { include: { socio: true } },
      prestamos: {
        include: {
          socio: true,
          cuotas: { orderBy: { numero: "asc" } },
        },
      },
      cuentasInversion: { include: { socio: true } },
    },
  });

  if (!ronda)
    return NextResponse.json({ error: "No hay ronda activa" }, { status: 404 });

  // Obtener configuración de correos
  const config = await prisma.configReporte.findUnique({ where: { id: 1 } });
  if (!config?.emailAdmin)
    return NextResponse.json({ error: "No hay correo configurado" }, { status: 400 });

  const destinatarios = [
    config.emailAdmin,
    ...config.emailsExtra.split(",").map((e: string) => e.trim()).filter(Boolean),
  ];

  // Generar archivos en paralelo
  const [excelBuffer, pdfBuffer] = await Promise.all([
    generarExcel(ronda),
    generarPDF(ronda),
  ]);

  const mes = new Date().toLocaleDateString("es-EC", { month: "long", year: "numeric" });
  const fecha = new Date().toISOString().slice(0, 10);
  const asunto = `Reporte mensual MiRonda — ${ronda.nombre} — ${mes}`;

  await transporter.sendMail({
    from: `"MiRonda" <${process.env.GMAIL_USER}>`,
    to: destinatarios.join(", "),
    subject: asunto,
    html: emailHtml(ronda, mes),
    attachments: [
      {
        filename: `reporte_${ronda.nombre}_${fecha}.xlsx`,
        content: Buffer.from(excelBuffer),
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      {
        filename: `reporte_${ronda.nombre}_${fecha}.pdf`,
        content: Buffer.from(pdfBuffer),
        contentType: "application/pdf",
      },
    ],
  });

  return NextResponse.json({
    ok: true,
    destinatarios,
    ronda: ronda.nombre,
    archivos: [`reporte_${ronda.nombre}_${fecha}.xlsx`, `reporte_${ronda.nombre}_${fecha}.pdf`],
  });
}
