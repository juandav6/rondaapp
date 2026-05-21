// app/admin/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const [sociosR, rondasR] = await Promise.all([
          fetch("/api/admin/socios"), fetch("/api/rondas/historial"),
        ]);
        const socios = await sociosR.json();
        const rondas = await rondasR.json();
        setStats({ totalSocios: socios.length, totalRondas: rondas.length ?? 0 });
      } catch {}
    }
    load();
  }, []);

  const modulos = [
    { href: "/admin/socios",    icon: "👥", label: "Socios",              desc: "Editar datos, ver historial completo, eliminar socios sin dependencias",                    color: "bg-violet-50 border-violet-200 text-violet-700" },
    { href: "/admin/rondas",    icon: "📅", label: "Rondas",              desc: "Editar nombre, montos, semana actual. Eliminar respetando orden cronológico",               color: "bg-blue-50 border-blue-200 text-blue-700" },
    { href: "/admin/aportes",   icon: "💵", label: "Aportes y ahorros",   desc: "Editar y eliminar aportes/ahorros por semana. Ahorros recalculan saldo del socio",          color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { href: "/admin/prestamos", icon: "💳", label: "Préstamos",           desc: "Editar monto, tasa, plazo. Recalcula tabla de amortización automáticamente",               color: "bg-indigo-50 border-indigo-200 text-indigo-700" },
    { href: "/admin/express",   icon: "⚡", label: "Express y caja",      desc: "Editar préstamos express y movimientos de caja. Cambiar estados pendiente/cobrado",         color: "bg-amber-50 border-amber-200 text-amber-700" },
    { href: "/admin/multas",    icon: "⚠️", label: "Multas",              desc: "Ver, editar, cobrar y eliminar multas. Cambiar estado pendiente/cobrado",                   color: "bg-orange-50 border-orange-200 text-orange-700" },
    { href: "/admin/bitacora",  icon: "📋", label: "Bitácora",            desc: "Historial de todos los cambios con fecha, hora, valores anteriores y efectos en cascada",   color: "bg-gray-50 border-gray-200 text-gray-700" },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white text-lg">⚙</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Panel de Administración</h1>
            <p className="text-sm text-gray-500">Gestión completa de datos · todos los cambios quedan en bitácora</p>
          </div>
        </div>
        <div className="mt-4 flex gap-3 text-xs">
          <div className="rounded-lg bg-gray-100 px-3 py-2"><span className="text-gray-500">Socios: </span><strong>{stats?.totalSocios ?? "…"}</strong></div>
          <div className="rounded-lg bg-gray-100 px-3 py-2"><span className="text-gray-500">Rondas: </span><strong>{stats?.totalRondas ?? "…"}</strong></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {modulos.map(m => (
          <Link key={m.href} href={m.href}
            className={`rounded-xl border p-4 hover:shadow-md transition-shadow ${m.color}`}>
            <div className="text-2xl mb-2">{m.icon}</div>
            <p className="font-semibold text-sm">{m.label}</p>
            <p className="text-xs mt-1 opacity-75">{m.desc}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 text-sm text-amber-800">
        <strong>⚠️ Zona de administración.</strong> Todos los cambios son auditados. Los procesos vinculados se recalculan automáticamente. Lea el mensaje de confirmación antes de confirmar cualquier cambio.
      </div>
    </div>
  );
}
