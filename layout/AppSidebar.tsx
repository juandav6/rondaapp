"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  BoxCubeIcon,
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  TableIcon,
  UserCircleIcon,
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
    icon: <UserCircleIcon />,
    name: "Socios",
    subItems: [
      { name: "Lista de socios", path: "/socios" },
      { name: "Detalle por socio", path: "/socios/detalle" },
    ],
  },
  {
    icon: <CalenderIcon />,
    name: "Rondas",
    subItems: [
      { name: "Registrar ronda", path: "/rondas/registro_ronda" },
      { name: "Ronda actual", path: "/rondas/actual" },
      { name: "Historial de rondas", path: "/historial" },
    ],
  },
  {
    icon: <ListIcon />,
    name: "Aportes / Pagos",
    subItems: [
      { name: "Registrar aporte", path: "/aportes/registrar" },
      { name: "Aportes pendientes", path: "/aportes/pendientes" },
    ],
  },
  {
    icon: <TableIcon />,
    name: "Préstamos",
    subItems: [
      { name: "Solicitud de préstamo", path: "/prestamos/solicitud" },
      { name: "Aprobación y pagos", path: "/prestamos/gestion" },
      { name: "Historial por socio", path: "/prestamos/historial" },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Ahorros",
    subItems: [
      { name: "Registro de ahorros", path: "/ahorros/registro" },
      { name: "Retiro de ahorros", path: "/ahorros/resumen" },
      { name: "Reportes de beneficios", path: "/ahorros/reportes" },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Multas",
    subItems: [
      { name: "Multas por socio", path: "/configuracion/reglas" },
      { name: "Pago de multas", path: "/configuracion/socios" },
    ],
  },
  {
    icon: <PieChartIcon />,
    name: "Reportes / Estadísticas",
    subItems: [
      { name: "Resumen general", path: "/reportes/resumen" },
      { name: "Exportar PDF / Excel", path: "/reportes/exportar" },
      { name: "Comparativas entre rondas", path: "/reportes/comparativas" },
    ],
  },
];

const HEADER_H = 64; // altura del header en px (top-16)

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();

  const [openSubmenu, setOpenSubmenu] = useState<{ type: "main" | "others"; index: number } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      const el = subMenuRefs.current[key];
      if (el) {
        setSubMenuHeight((prev) => ({ ...prev, [key]: el.scrollHeight || 0 }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prev) =>
      prev && prev.type === menuType && prev.index === index ? null : { type: menuType, index }
    );
  };

  const sidebarWidth = isExpanded || isHovered || isMobileOpen ? 290 : 90;

  const renderMenuItems = (items: NavItem[], menuType: "main" | "others") => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
            >
              <span
                className={`${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && <span className="menu-item-text">{nav.name}</span>}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto h-5 w-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType && openSubmenu?.index === index ? "rotate-180 text-brand-500" : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"}`}
              >
                <span className={`${isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && <span className="menu-item-text">{nav.name}</span>}
              </Link>
            )
          )}

          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="ml-9 mt-2 space-y-1">
                {nav.subItems.map((sub) => (
                  <li key={sub.name}>
                    <Link
                      href={sub.path}
                      className={`menu-dropdown-item ${
                        isActive(sub.path) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {sub.name}
                      <span className="ml-auto flex items-center gap-1">
                        {sub.new && (
                          <span
                            className={`menu-dropdown-badge ${
                              isActive(sub.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            }`}
                          >
                            new
                          </span>
                        )}
                        {sub.pro && (
                          <span
                            className={`menu-dropdown-badge ${
                              isActive(sub.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            }`}
                          >
                            pro
                          </span>
                        )}
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
    <aside
      className={`fixed left-0 z-50 border-r border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white
        transition-all duration-300 ease-in-out
        top-16 h-[calc(100vh-64px)] lg:top-0 lg:h-screen
        ${isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
        px-5`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ ["--sidebar-w" as any]: `${sidebarWidth}px` }}
    >
      <div className={`py-6 ${!isExpanded && !isHovered ? "lg:flex lg:justify-center" : ""}`}>
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image className="dark:hidden" src="/images/logo/logoappweb.jpeg" alt="Logo" width={150} height={40} />
              <Image
                className="hidden dark:block"
                src="/images/logo/logoappweb.jpeg"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <Image src="/images/logo/logoappweb.jpeg" alt="Logo" width={32} height={32} />
          )}
        </Link>
      </div>

      <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 flex text-xs uppercase leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Menu" : <HorizontaLDots />}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
