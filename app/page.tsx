"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import DefaultLayout from "@/layout/DefaultLayout";
import {
  UserCircle2 as UserCircleIcon,
  CalendarDays as CalendarIcon,
  ListChecks as ListIcon,
  Table as TableIcon,
  Boxes as BoxCubeIcon,
  PlugZap as PlugInIcon,
  PieChart as PieChartIcon,
  ArrowRight,
} from "lucide-react";

// ===============================
// Datos del Menú Principal
// ===============================
const MENUS: Array<{
  name: string;
  icon: React.ReactNode;
  basePath: string;
  description: string;
  colorFrom: string; // tailwind from-
  colorTo: string; // tailwind to-
  subItems: Array<{ name: string; path: string }>;
}> = [
  {
    icon: <UserCircleIcon className="h-12 w-12" aria-hidden />,
    name: "Socios",
    basePath: "/socios",
    description: "Gestión de miembros, perfiles y estado de aportes.",
    colorFrom: "from-indigo-500",
    colorTo: "to-sky-500",
    subItems: [
      { name: "Lista de socios", path: "/socios" },
      { name: "Detalle por socio", path: "/socios/detalle" },
    ],
  },
  {
    icon: <CalendarIcon className="h-12 w-12" aria-hidden />,
    name: "Rondas",
    basePath: "/rondas/actual",
    description: "Registro, seguimiento e historial de rondas.",
    colorFrom: "from-emerald-500",
    colorTo: "to-teal-500",
    subItems: [
      { name: "Registrar ronda", path: "/rondas/registro_ronda" },
      { name: "Ronda actual", path: "/rondas/actual" },
      { name: "Historial de rondas", path: "/historial" },
      { name: "Resultados ronda", path: "/rondas/resumen" },
    ],
  },
  {
    icon: <ListIcon className="h-12 w-12" aria-hidden />,
    name: "Aportes / Pagos",
    basePath: "/aportes",
    description: "Registrar aportes, multas y estados pendientes.",
    colorFrom: "from-fuchsia-500",
    colorTo: "to-pink-500",
    subItems: [
      { name: "Registrar aporte", path: "/aportes/registrar" },
      { name: "Registrar multa", path: "/aportes/multa" },
      { name: "Aportes pendientes", path: "/aportes/pendientes" },
    ],
  },
  {
    icon: <TableIcon className="h-12 w-12" aria-hidden />,
    name: "Préstamos",
    basePath: "/prestamos",
    description: "Solicitudes, aprobaciones, pagos e historial.",
    colorFrom: "from-orange-500",
    colorTo: "to-amber-500",
    subItems: [
      { name: "Solicitud de préstamo", path: "/prestamos/solicitud" },
      { name: "Aprobación y pagos", path: "/prestamos/gestion" },
      { name: "Historial por socio", path: "/prestamos/historial" },
    ],
  },
  {
    icon: <BoxCubeIcon className="h-12 w-12" aria-hidden />,
    name: "Ahorros",
    basePath: "/ahorros",
    description: "Registro y reportes de ahorro por socio.",
    colorFrom: "from-cyan-500",
    colorTo: "to-blue-500",
    subItems: [
      { name: "Registro de ahorros", path: "/ahorros/registro" },
      { name: "Resumen por socio", path: "/ahorros/resumen" },
      { name: "Reportes de beneficios", path: "/ahorros/reportes" },
    ],
  },
  {
    icon: <PlugInIcon className="h-12 w-12" aria-hidden />,
    name: "Multas",
    basePath: "/multas",
    description: "Cálculo, reglas y pagos de multas.",
    colorFrom: "from-rose-500",
    colorTo: "to-red-500",
    subItems: [
      { name: "Multas por socio", path: "/configuracion/reglas" },
      { name: "Pago de multas", path: "/configuracion/socios" },
    ],
  },
  {
    icon: <PieChartIcon className="h-12 w-12" aria-hidden />,
    name: "Reportes / Estadísticas",
    basePath: "/reportes",
    description: "Paneles, exportaciones y comparativas.",
    colorFrom: "from-violet-500",
    colorTo: "to-purple-500",
    subItems: [
      { name: "Resumen general", path: "/reportes/resumen" },
      { name: "Exportar PDF / Excel", path: "/reportes/exportar" },
      { name: "Comparativas entre rondas", path: "/reportes/comparativas" },
    ],
  },
];

// ===============================
// Tarjeta de Menú (alto fijo + lista completa de submenús con scroll)
// ===============================
function MenuCard({
  name,
  icon,
  description,
  colorFrom,
  colorTo,
  href,
  subItems,
}: {
  name: string;
  icon: React.ReactNode;
  description: string;
  colorFrom: string;
  colorTo: string;
  href: string;
  subItems: Array<{ name: string; path: string }>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Link
        href={href}
        className="relative block rounded-2xl p-5 sm:p-6 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm ring-1 ring-black/5 dark:ring-white/10 hover:shadow-xl transition-shadow h-56 overflow-hidden"
      >
        {/* Glow */}
        <div
          className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${colorFrom} ${colorTo} opacity-0 group-hover:opacity-10 transition-opacity`}
        />

        <div className="flex h-full items-start gap-3 sm:gap-4">
          <div
            className={`flex h-12 w-12 md:h-16 md:w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFrom} ${colorTo} text-white shadow-md`}
          >
            {icon}
          </div>

          {/* CONTENEDOR DE TEXTO: no dejar que se salga */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {name}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                  {description}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs px-2 py-0.5">
                  {subItems.length}
                </span>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Lista completa de submenús: wrap + scroll si no caben */}
            <div className="mt-3 sm:mt-4 flex-1 overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-2 content-start">
                {subItems.map((s) => (
                  <Link
                    key={s.path}
                    href={s.path}
                    className="max-w-full truncate whitespace-nowrap rounded-full border border-gray-200/70 dark:border-white/10 px-3 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}


// ===============================
// Página Principal (Dashboard)
// ===============================
export default function HomeDashboard() {
  return (
    <>
      {/* Encabezado de la página */}
      <section className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Panel principal
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-300">
              Accede rápidamente a los módulos principales del sistema.
            </p>
          </div>

          {/* Buscador simple (opcional) */}
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Buscar menú o acción…"
              className="w-full rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm px-4 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
              onChange={(e) => {
                const q = e.currentTarget.value.toLowerCase();
                const cards = document.querySelectorAll("[data-card]");
                cards.forEach((el) => {
                  const t =
                    (el.getAttribute("data-name") || "") +
                    (el.getAttribute("data-desc") || "");
                  (el as HTMLElement).style.display = t
                    .toLowerCase()
                    .includes(q)
                    ? "block"
                    : "none";
                });
              }}
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            >
              <path d="M21 21l-4.35-4.35m1.1-4.4a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
            </svg>
          </div>
        </div>
      </section>

      {/* Grid de Módulos */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5"
        aria-label="Menú principal"
      >
        {MENUS.map((m) => (
          <div
            key={m.name}
            data-card
            data-name={m.name}
            data-desc={m.description}
          >
            <MenuCard
              name={m.name}
              icon={m.icon}
              description={m.description}
              colorFrom={m.colorFrom}
              colorTo={m.colorTo}
              href={m.basePath || m.subItems[0]?.path}
              subItems={m.subItems}
            />
          </div>
        ))}
      </section>

      {/* Pie de página con info */}
      <footer className="mt-10 text-xs text-gray-500 dark:text-gray-400">
        Consejo: puedes usar <kbd className="rounded border border-gray-300 px-1">Tab</kbd> y
        <kbd className="rounded border border-gray-300 px-1 ml-1">Enter</kbd> para navegar las tarjetas.
      </footer>
    </>
  );
}