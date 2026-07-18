"use client";
import React, { Suspense, useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { ChevronDownIcon, HorizontaLDots } from "../icons";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const Icon = {
  dashboard: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z"/><path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z"/></svg>,
  socios: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd"/></svg>,
  rondas: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd"/></svg>,
  prestamos: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM18.75 9a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM4.5 9.75A.75.75 0 0 1 5.25 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75V9.75Z" clipRule="evenodd"/><path d="M2.25 18a.75.75 0 0 0 0 1.5c5.4 0 10.63.722 15.6 2.075 1.19.324 2.4-.558 2.4-1.82V18.75a.75.75 0 0 0-.75-.75H2.25Z"/></svg>,
  // Caja Común: ícono de caja registradora / monedas
  caja: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 0 1-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004ZM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 0 1-.921.42Z"/><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v.816a3.836 3.836 0 0 0-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.399 1.106.647 1.719.756v2.978a2.536 2.536 0 0 1-.921-.421l-.879-.66a.75.75 0 0 0-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 0 0 1.5 0v-.81a4.124 4.124 0 0 0 1.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 0 0-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 0 0 .933-1.175l-.415-.33a3.836 3.836 0 0 0-1.719-.755V6Z" clipRule="evenodd"/></svg>,
  // Depósitos: flecha hacia abajo con bandeja (inbox / depósito)
  depositos: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd"/></svg>,
  retiros: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-.53 14.03a.75.75 0 0 0 1.06 0l3-3a.75.75 0 1 0-1.06-1.06l-1.72 1.72V8.25a.75.75 0 0 0-1.5 0v5.69l-1.72-1.72a.75.75 0 0 0-1.06 1.06l3 3Z" clipRule="evenodd"/></svg>,
  reportes: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm4.5 7.5a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0v-2.25a.75.75 0 0 1 .75-.75Zm3.75-1.5a.75.75 0 0 0-1.5 0v3.75a.75.75 0 0 0 1.5 0V12Zm2.25-3a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75Zm3.75-1.5a.75.75 0 0 0-1.5 0v7.5a.75.75 0 0 0 1.5 0V7.5Z" clipRule="evenodd"/></svg>,
  admin: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.986.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd"/></svg>,
};

const navItems: NavItem[] = [
  { icon: Icon.dashboard, name: "Dashboard", subItems: [{ name: "Inicio", path: "/" }] },
  {
    icon: Icon.socios, name: "Socios",
    subItems: [
      { name: "Lista de socios", path: "/socios" },
      { name: "Detalle por socio", path: "/socios/detalle" },
      { name: "Kardex del socio", path: "/socios/kardex" },
    ],
  },
  {
    icon: Icon.rondas, name: "Rondas",
    subItems: [
      { name: "Registrar ronda", path: "/rondas/registro_ronda" },
      { name: "Ronda actual", path: "/rondas/actual" },
      { name: "Historial de rondas", path: "/rondas/historial" },
      { name: "Transferencia al fondo", path: "/rondas/fondo/transferir" },
    ],
  },
  {
    icon: Icon.prestamos, name: "Préstamos",
    subItems: [
      { name: "Solicitar préstamo", path: "/prestamos/solicitud" },
      { name: "Préstamos", path: "/prestamos/pendientes" },
    ],
  },
  {
    icon: Icon.caja, name: "Caja Común",
    subItems: [
      { name: "Registro de multas", path: "/caja/multas" },
      { name: "Valores pendientes", path: "/caja/pendientes" },
      { name: "Registro de gastos", path: "/caja/gastos" },
      { name: "Gasto compartido", path: "/caja/gasto-compartido" },
      { name: "Historial", path: "/caja/historial" },
    ],
  },
  {
    icon: Icon.depositos, name: "Depósitos",
    subItems: [
      { name: "Registrar depósito", path: "/ahorros/registro" },
      { name: "Listado de depósitos", path: "/ahorros/registro?tab=listado" },
    ],
  },
  {
    icon: Icon.retiros, name: "Retiros",
    subItems: [
      { name: "Registrar retiro", path: "/socios/retiros" },
      { name: "Listado de retiros", path: "/socios/retiros?tab=listado" },
    ],
  },
  {
    icon: Icon.reportes, name: "Reportes",
    subItems: [{ name: "Configurar reportes", path: "/reportes/config" }],
  },
  {
    icon: Icon.admin, name: "Administración",
    subItems: [
      { name: "Panel admin", path: "/admin" },
      { name: "Socios", path: "/admin/socios" },
      { name: "Rondas", path: "/admin/rondas" },
      { name: "Aportes y ahorros", path: "/admin/aportes" },
      { name: "Depósitos y retiros", path: "/admin/depositos" },
      { name: "Préstamos", path: "/admin/prestamos" },
      { name: "Fondo de inversión", path: "/admin/fondo" },
      { name: "Transferencias de fondo", path: "/admin/fondo/movimientos" },
      { name: "Express y caja", path: "/admin/express" },
      { name: "Multas", path: "/admin/multas" },
      { name: "Secuencias", path: "/admin/secuencias" },
      { name: "Bitácora de cambios", path: "/admin/bitacora" },
      { name: "Sincronizar movimientos", path: "/admin/sincronizar" },
    ],
  },
];

// ─── Logo ─────────────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getBasePath(path: string) { return path.split("?")[0]; }
function getTabParam(path: string) {
  const q = path.split("?")[1];
  if (!q) return null;
  return new URLSearchParams(q).get("tab");
}
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ─── Search result type ───────────────────────────────────────────────────────
type SearchResult = { label: string; path: string; parent: string };

// ─── Inner component ──────────────────────────────────────────────────────────
const AppSidebarInner: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleMobileSidebar } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  const [openSubmenu, setOpenSubmenu] = useState<{ type: "main"; index: number } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Búsqueda
  const [query, setQuery] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const isActive = useCallback((path: string) => {
    const basePath = getBasePath(path);
    const tabParam = getTabParam(path);
    if (basePath !== pathname) return false;
    if (tabParam === null && !currentTab) return true;
    if (tabParam !== null && currentTab === tabParam) return true;
    return false;
  }, [pathname, currentTab]);

  const isWide = isExpanded || isHovered || isMobileOpen;

  // Auto-abrir submenu activo
  useEffect(() => {
    navItems.forEach((nav, index) => {
      if (nav.subItems?.some(sub => isActive(sub.path))) {
        setOpenSubmenu({ type: "main", index });
      }
    });
  }, [pathname, currentTab, isActive]);

  // Cerrar sidebar móvil al navegar
  useEffect(() => {
    if (isMobileOpen) toggleMobileSidebar();
    setQuery("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, currentTab]);

  // Altura submenús
  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `main-${openSubmenu.index}`;
      const el = subMenuRefs.current[key];
      if (el) setSubMenuHeight(prev => ({ ...prev, [key]: el.scrollHeight || 0 }));
    }
  }, [openSubmenu]);

  const handleToggle = (index: number) => {
    setOpenSubmenu(prev => prev?.index === index ? null : { type: "main", index });
  };

  // Construir índice de búsqueda aplanado
  const allItems: SearchResult[] = navItems.flatMap(nav =>
    nav.subItems
      ? nav.subItems.map(sub => ({ label: sub.name, path: sub.path, parent: nav.name }))
      : nav.path
        ? [{ label: nav.name, path: nav.path, parent: "" }]
        : []
  );

  const results = query.trim().length > 0
    ? allItems.filter(item =>
        `${item.label} ${item.parent}`.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  const showSearch = isWide;

  return (
    <>
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={toggleMobileSidebar}/>}
      <aside
        className={[
          "fixed left-0 top-0 z-50 h-screen flex flex-col",
          "border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
          "transition-all duration-300 ease-in-out",
          isWide ? "w-[272px]" : "w-[72px]",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        ].join(" ")}
        onMouseEnter={() => !isExpanded && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Logo */}
        <div className={`h-16 shrink-0 flex items-center px-4 border-b border-gray-100 dark:border-gray-800 ${!isWide ? "lg:justify-center" : "justify-between"}`}>
          <Link href="/" onClick={() => isMobileOpen && toggleMobileSidebar()}>
            {isWide ? <LogoFull /> : <LogoIcon />}
          </Link>
          {isMobileOpen && (
            <button onClick={toggleMobileSidebar} className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M6.22 7.28a.75.75 0 1 1 1.06-1.06L12 10.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L13.06 12l4.72 4.72a.75.75 0 0 1-1.06 1.06L12 13.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L10.94 12 6.22 7.28Z" fill="currentColor"/>
              </svg>
            </button>
          )}
        </div>

        {/* Barra de búsqueda — solo visible cuando está expandido */}
        {showSearch && (
          <div className="shrink-0 px-3 py-2 border-b border-gray-100 relative">
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none">
                <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd"/>
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setTimeout(() => setSearchFocus(false), 150)}
                placeholder="Buscar en el menú…"
                className="w-full rounded-lg bg-gray-100 pl-8 pr-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:bg-white transition-colors"
              />
              {query && (
                <button onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Resultados de búsqueda */}
            {searchFocus && results.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-xl border bg-white shadow-lg overflow-hidden">
                {results.map((r, i) => (
                  <Link key={i} href={r.path}
                    onClick={() => setQuery("")}
                    className={cn(
                      "flex items-start gap-2 px-3 py-2 text-xs hover:bg-emerald-50 transition-colors",
                      isActive(r.path) && "bg-emerald-50"
                    )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full mt-1 shrink-0", isActive(r.path) ? "bg-emerald-500" : "bg-gray-300")}/>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{r.label}</p>
                      {r.parent && <p className="text-gray-400 truncate">{r.parent}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {searchFocus && query.trim().length > 0 && results.length === 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-xl border bg-white shadow-lg px-3 py-3 text-xs text-gray-400">
                Sin resultados para "{query}"
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <div className="flex-1 min-h-0 overflow-y-auto py-4 px-3">
          {isWide && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Menú</p>}
          {!isWide && <div className="mb-3 flex justify-center"><HorizontaLDots /></div>}
          <ul className="flex flex-col gap-1">
            {navItems.map((nav, index) => {
              const isOpen = openSubmenu?.index === index;
              const hasActiveChild = nav.subItems?.some(sub => isActive(sub.path));
              return (
                <li key={nav.name}>
                  {nav.subItems ? (
                    <button onClick={() => handleToggle(index)}
                      className={[
                        "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        isOpen || hasActiveChild ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-100",
                        !isWide ? "lg:justify-center lg:px-2" : "",
                      ].join(" ")}>
                      <span className={cn("shrink-0", isOpen || hasActiveChild ? "text-emerald-600" : "text-gray-400")}>
                        {nav.icon}
                      </span>
                      {isWide && <span className="flex-1 text-left truncate">{nav.name}</span>}
                      {isWide && <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-emerald-500" : "text-gray-300"}`}/>}
                    </button>
                  ) : nav.path ? (
                    <Link href={nav.path}
                      className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        isActive(nav.path) ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-100")}>
                      <span className={isActive(nav.path) ? "text-emerald-600" : "text-gray-400"}>{nav.icon}</span>
                      {isWide && <span className="truncate">{nav.name}</span>}
                    </Link>
                  ) : null}

                  {nav.subItems && isWide && (
                    <div
                      ref={el => { subMenuRefs.current[`main-${index}`] = el; }}
                      className="overflow-hidden transition-all duration-300"
                      style={{ height: isOpen ? `${subMenuHeight[`main-${index}`]}px` : "0px" }}>
                      <ul className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-3">
                        {nav.subItems.map(sub => {
                          const active = isActive(sub.path);
                          return (
                            <li key={sub.name}>
                              <Link href={sub.path}
                                className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                                  active ? "bg-emerald-50 text-emerald-700 font-medium" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700")}>
                                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", active ? "bg-emerald-500" : "bg-gray-300")}/>
                                {sub.name}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {isWide && (
          <div className="shrink-0 border-t border-gray-100 px-4 py-3">
            <p className="text-[10px] text-gray-400 text-center">MiRonda v2.0</p>
          </div>
        )}
      </aside>
    </>
  );
};

const AppSidebar: React.FC = () => (
  <Suspense fallback={null}>
    <AppSidebarInner />
  </Suspense>
);

export default AppSidebar;
