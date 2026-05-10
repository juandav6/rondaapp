"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  BoxCubeIcon, CalenderIcon, ChevronDownIcon, GridIcon,
  HorizontaLDots, PieChartIcon, PlugInIcon, TableIcon, UserCircleIcon,
} from "../icons";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  { icon: <GridIcon />, name: "Dashboard", subItems: [{ name: "Inicio", path: "/" }] },
  {
    icon: <UserCircleIcon />, name: "Socios",
    subItems: [
      { name: "Lista de socios", path: "/socios" },
      { name: "Detalle por socio", path: "/socios/detalle" },
      { name: "Retiro de ahorros", path: "/socios/retiros" },
    ],
  },
  {
    icon: <CalenderIcon />, name: "Rondas",
    subItems: [
      { name: "Registrar ronda", path: "/rondas/registro_ronda" },
      { name: "Ronda actual", path: "/rondas/actual" },
      { name: "Historial de rondas", path: "/rondas/historial" },
    ],
  },
  {
    icon: <TableIcon />, name: "Préstamos",
    subItems: [
      { name: "Solicitud de préstamo", path: "/prestamos/solicitud" },
      { name: "Préstamos pendientes", path: "/prestamos/pendientes" },
      { name: "Historial por socio", path: "/prestamos/historial" },
      { name: "Reportes préstamos", path: "/prestamos/resumen" },
    ],
  },
  {
    icon: <BoxCubeIcon />, name: "Ahorros",
    subItems: [
      { name: "Registro de ahorros", path: "/ahorros/registro" },
      { name: "Resumen por socio", path: "/ahorros/resumen" },
      { name: "Reportes de beneficios", path: "/ahorros/reportes" },
    ],
  },
  {
    icon: <PlugInIcon />, name: "Multas",
    subItems: [
      { name: "Multas por socio", path: "/configuracion/reglas" },
      { name: "Pago de multas", path: "/configuracion/socios" },
    ],
  },
  {
    icon: <PieChartIcon />, name: "Reportes / Estadísticas",
    subItems: [
      { name: "Resumen general", path: "/reportes/resumen" },
      { name: "Exportar PDF / Excel", path: "/reportes/exportar" },
      { name: "Comparativas entre rondas", path: "/reportes/comparativas" },
    ],
  },
];

// ── Logo ──────────────────────────────────────────────────────────────────────
function LogoFull() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1a3a2a]">
        <svg viewBox="0 0 32 32" width="28" height="28">
          <circle cx="16" cy="16" r="14" fill="#22543d"/>
          <circle cx="16" cy="14" r="7" fill="#f6c94e" stroke="#d4a72c" strokeWidth="1"/>
          <text x="16" y="18" textAnchor="middle" fontFamily="Georgia,serif" fontSize="9" fontWeight="700" fill="#8a6200">$</text>
          <circle cx="9" cy="21" r="4" fill="#f6c94e" stroke="#d4a72c" strokeWidth="0.8"/>
          <text x="9" y="23.5" textAnchor="middle" fontFamily="Georgia,serif" fontSize="5" fontWeight="700" fill="#8a6200">$</text>
          <circle cx="23" cy="21" r="4" fill="#f6c94e" stroke="#d4a72c" strokeWidth="0.8"/>
          <text x="23" y="23.5" textAnchor="middle" fontFamily="Georgia,serif" fontSize="5" fontWeight="700" fill="#8a6200">$</text>
        </svg>
      </div>
      <span className="text-base font-bold tracking-tight text-gray-900 dark:text-white" style={{ fontFamily: "Georgia, serif" }}>
        Mi<span className="text-emerald-600">Ronda</span>
      </span>
    </div>
  );
}

function LogoIcon() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a3a2a]">
      <svg viewBox="0 0 32 32" width="28" height="28">
        <circle cx="16" cy="16" r="14" fill="#22543d"/>
        <circle cx="16" cy="14" r="7" fill="#f6c94e" stroke="#d4a72c" strokeWidth="1"/>
        <text x="16" y="18" textAnchor="middle" fontFamily="Georgia,serif" fontSize="9" fontWeight="700" fill="#8a6200">$</text>
        <circle cx="9" cy="21" r="4" fill="#f6c94e" stroke="#d4a72c" strokeWidth="0.8"/>
        <circle cx="23" cy="21" r="4" fill="#f6c94e" stroke="#d4a72c" strokeWidth="0.8"/>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleMobileSidebar } = useSidebar();
  const pathname = usePathname();

  const [openSubmenu, setOpenSubmenu] = useState<{ type: "main" | "others"; index: number } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => path === pathname, [pathname]);
  const isWide = isExpanded || isHovered || isMobileOpen;

  // Auto-abrir submenu activo
  useEffect(() => {
    navItems.forEach((nav, index) => {
      if (nav.subItems?.some((sub) => sub.path === pathname)) {
        setOpenSubmenu({ type: "main", index });
      }
    });
  }, [pathname]);

  // Cerrar sidebar móvil al cambiar de ruta
  useEffect(() => {
    if (isMobileOpen) toggleMobileSidebar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      const el = subMenuRefs.current[key];
      if (el) setSubMenuHeight((prev) => ({ ...prev, [key]: el.scrollHeight || 0 }));
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prev) =>
      prev && prev.type === menuType && prev.index === index ? null : { type: menuType, index }
    );
  };

  const renderMenuItems = (items: NavItem[], menuType: "main" | "others") => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active" : "menu-item-inactive"
              } cursor-pointer ${!isWide ? "lg:justify-center" : "lg:justify-start"}`}
            >
              <span className={openSubmenu?.type === menuType && openSubmenu?.index === index
                ? "menu-item-icon-active" : "menu-item-icon-inactive"}>
                {nav.icon}
              </span>
              {isWide && <span className="menu-item-text">{nav.name}</span>}
              {isWide && (
                <ChevronDownIcon className={`ml-auto h-5 w-5 transition-transform duration-200 ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index ? "rotate-180 text-brand-500" : ""
                }`}/>
              )}
            </button>
          ) : (
            nav.path && (
              <Link href={nav.path}
                className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"}`}>
                <span className={isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}>{nav.icon}</span>
                {isWide && <span className="menu-item-text">{nav.name}</span>}
              </Link>
            )
          )}

          {nav.subItems && isWide && (
            <div
              ref={(el) => { subMenuRefs.current[`${menuType}-${index}`] = el; }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height: openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? `${subMenuHeight[`${menuType}-${index}`]}px` : "0px",
              }}
            >
              <ul className="ml-9 mt-2 space-y-1">
                {nav.subItems.map((sub) => (
                  <li key={sub.name}>
                    <Link href={sub.path}
                      className={`menu-dropdown-item ${isActive(sub.path) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"}`}>
                      {sub.name}
                      <span className="ml-auto flex items-center gap-1">
                        {sub.new && <span className={`menu-dropdown-badge ${isActive(sub.path) ? "menu-dropdown-badge-active" : "menu-dropdown-badge-inactive"}`}>new</span>}
                        {sub.pro && <span className={`menu-dropdown-badge ${isActive(sub.path) ? "menu-dropdown-badge-active" : "menu-dropdown-badge-inactive"}`}>pro</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* ── Overlay móvil — toca afuera para cerrar ── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={toggleMobileSidebar}
          aria-label="Cerrar menú"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={[
          "fixed left-0 top-0 z-50 h-screen",
          "border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
          "transition-all duration-300 ease-in-out",
          "flex flex-col px-5",
          isWide ? "w-[290px]" : "w-[90px]",
          // Móvil: oculto por defecto, desliza cuando isMobileOpen
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: siempre visible
          "lg:translate-x-0",
        ].join(" ")}
        onMouseEnter={() => !isExpanded && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Logo + botón cerrar en móvil */}
        <div className={`py-5 shrink-0 flex items-center ${!isWide ? "lg:justify-center" : "justify-between"}`}>
          <Link href="/" onClick={() => isMobileOpen && toggleMobileSidebar()}>
            {isWide ? <LogoFull /> : <LogoIcon />}
          </Link>

          {/* Botón X solo visible en móvil cuando está abierto */}
          {isMobileOpen && (
            <button
              onClick={toggleMobileSidebar}
              className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="Cerrar menú"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path fillRule="evenodd" clipRule="evenodd"
                  d="M6.22 7.28a.75.75 0 1 1 1.06-1.06L12 10.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L13.06 12l4.72 4.72a.75.75 0 0 1-1.06 1.06L12 13.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L10.94 12 6.22 7.28Z"
                  fill="currentColor"/>
              </svg>
            </button>
          )}
        </div>

        {/* Nav */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <nav className="mb-6">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className={`mb-4 flex text-xs uppercase leading-[20px] text-gray-400 ${!isWide ? "lg:justify-center" : "justify-start"}`}>
                  {isWide ? "Menu" : <HorizontaLDots />}
                </h2>
                {renderMenuItems(navItems, "main")}
              </div>
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
