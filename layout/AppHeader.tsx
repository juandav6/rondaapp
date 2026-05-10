"use client";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import UserDropdown from "@/components/header/UserDropdown";
import { useSidebar } from "@/context/SidebarContext";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";

type SearchResult = {
  socios: { id: number; nombres: string; apellidos: string; numeroCuenta: string; saldoAhorros: number }[];
  rondas: { id: number; nombre: string; activa: boolean; fechaInicio: string; fechaFin: string | null }[];
  prestamos: { id: number; monto: number; saldoActual: number; estado: string; socio: { nombres: string; apellidos: string; numeroCuenta: string }; ronda: { nombre: string } }[];
};

type RondaStatus = { nombre: string; semanaActual: number; totalParticipantes: number } | null;

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return debounced;
}

const IconSearch = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd"/>
  </svg>
);

const IconSpinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2"/>
    <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3"/>
  </svg>
);

export default function AppHeader() {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar, isExpanded, isHovered } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const sidebarWidth = (isExpanded || isHovered) ? 290 : 90;

  const handleToggle = () => {
    if (window.innerWidth >= 1024) toggleSidebar();
    else toggleMobileSidebar();
  };

  const [rondaStatus, setRondaStatus] = useState<RondaStatus>(null);
  useEffect(() => {
    fetch("/api/rondas", { cache: "no-store" })
      .then(r => r.status === 204 ? null : r.json())
      .then(d => { if (d?.id) setRondaStatus({ nombre: d.nombre, semanaActual: d.semanaActual, totalParticipantes: d.participaciones?.length ?? 0 }); else setRondaStatus(null); })
      .catch(() => setRondaStatus(null));
  }, [pathname]);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults(null); setOpen(false); return; }
    setSearching(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json()).then(d => { setResults(d); setOpen(true); }).catch(() => {}).finally(() => setSearching(false));
  }, [debouncedQuery]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inDesktop = (dropdownRef.current?.contains(target) || inputRef.current?.contains(target));
      const inMobile = (mobileDropdownRef.current?.contains(target) || mobileInputRef.current?.contains(target));
      if (!inDesktop && !inMobile) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const onK = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); mobileInputRef.current?.blur(); }
    };
    document.addEventListener("keydown", onK);
    return () => document.removeEventListener("keydown", onK);
  }, []);

  function navigate(href: string) { setOpen(false); setQuery(""); router.push(href); }
  const hasResults = results && (results.socios.length + results.rondas.length + results.prestamos.length) > 0;

  const SearchDropdown = ({ ref: dRef }: { ref: React.RefObject<HTMLDivElement | null> }) => (
    <div ref={dRef}
      className="absolute top-[calc(100%+6px)] left-0 z-[70] w-full min-w-[320px] rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
      {!hasResults && !searching && (
        <div className="px-4 py-6 text-center text-sm text-gray-400">Sin resultados para "<strong className="text-gray-600">{query}</strong>"</div>
      )}
      {results?.socios && results.socios.length > 0 && (
        <div>
          <p className="border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:border-gray-800 dark:bg-gray-800/60">Socios</p>
          {results.socios.map(s => (
            <button key={s.id} onClick={() => navigate(`/socios/detalle?socioId=${s.id}`)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100/60 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-xs font-bold">{s.nombres[0]}{s.apellidos[0]}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate dark:text-white">{s.nombres} {s.apellidos}</p>
                  <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-700 shrink-0">{fmt(s.saldoAhorros)}</span>
            </button>
          ))}
        </div>
      )}
      {results?.rondas && results.rondas.length > 0 && (
        <div>
          <p className="border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:border-gray-800 dark:bg-gray-800/60">Rondas</p>
          {results.rondas.map(r => (
            <button key={r.id} onClick={() => navigate(r.activa ? "/rondas/actual" : `/rondas/${r.id}/resultados`)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100/60 dark:border-gray-800 last:border-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{r.nombre}</p>
              <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${r.activa ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{r.activa ? "Activa" : "Cerrada"}</span>
            </button>
          ))}
        </div>
      )}
      {results?.prestamos && results.prestamos.length > 0 && (
        <div>
          <p className="border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:border-gray-800 dark:bg-gray-800/60">Préstamos</p>
          {results.prestamos.map(p => (
            <button key={p.id} onClick={() => navigate(`/prestamos/${p.id}`)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100/60 dark:border-gray-800 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate dark:text-white">{p.socio.nombres} {p.socio.apellidos}</p>
                <p className="text-xs text-gray-400">{p.ronda.nombre} · {fmt(p.monto)}</p>
              </div>
              <span className={`text-xs font-semibold rounded-full px-2 py-0.5 shrink-0 ${p.estado === "ACTIVO" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{p.estado}</span>
            </button>
          ))}
        </div>
      )}
      <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-2 text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-800/40 flex justify-between">
        <span>Presiona <kbd className="rounded border border-gray-200 px-1 py-0.5 text-[10px]">Esc</kbd> para cerrar</span>
        <span>{(results?.socios.length ?? 0) + (results?.rondas.length ?? 0) + (results?.prestamos.length ?? 0)} resultados</span>
      </div>
    </div>
  );

  return (
    // ⚠️ Sin height fijo — se adapta al contenido (1 fila desktop, 2 filas móvil)
    <header className="sticky top-0 z-[60] w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">

      {/* ── Fila principal (64px en todos los tamaños) ── */}
      <div
        className="flex h-16 w-full items-center transition-[padding] duration-300 lg:pl-[var(--sidebar-w)]"
        style={{ ["--sidebar-w" as any]: `${sidebarWidth}px` }}
      >
        <div className="flex w-full items-center gap-2 px-3 lg:px-5">

          {/* Hamburger */}
          <button onClick={handleToggle}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:border lg:border-gray-200 dark:lg:border-gray-700"
            aria-label="Toggle Sidebar">
            {isMobileOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M6.22 7.28a.75.75 0 1 1 1.06-1.06L12 10.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L13.06 12l4.72 4.72a.75.75 0 0 1-1.06 1.06L12 13.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L10.94 12 6.22 7.28Z" fill="currentColor"/></svg>
            ) : (
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M.583 1A.75.75 0 0 1 1.333.25h13.333a.75.75 0 1 1 0 1.5H1.333A.75.75 0 0 1 .583 1Zm0 10a.75.75 0 0 1 .75-.75h13.333a.75.75 0 1 1 0 1.5H1.333a.75.75 0 0 1-.75-.75ZM1.333 5.25a.75.75 0 0 0 0 1.5H8a.75.75 0 0 0 0-1.5H1.333Z" fill="currentColor"/></svg>
            )}
          </button>

          {/* Buscador desktop */}
          <div className="hidden lg:block relative flex-1 max-w-sm xl:max-w-md">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              {searching ? <IconSpinner /> : <IconSearch />}
            </span>
            <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
              onFocus={() => hasResults && setOpen(true)}
              placeholder="Buscar socios, rondas, préstamos…"
              className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-12 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-700" />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-400 xl:block dark:border-gray-600 dark:bg-gray-700">⌘K</kbd>
            {open && <SearchDropdown ref={dropdownRef} />}
          </div>

          {/* Pill ronda activa */}
          {rondaStatus && (
            <Link href="/rondas/actual"
              className="hidden lg:inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold">{rondaStatus.nombre}</span>
              <span className="text-emerald-400">·</span>
              <span>Sem. {rondaStatus.semanaActual}{rondaStatus.totalParticipantes > 0 && `/${rondaStatus.totalParticipantes}`}</span>
            </Link>
          )}

          <div className="flex-1 lg:flex-none" />

          {/* Acciones rápidas desktop */}
          <div className="hidden lg:flex items-center gap-1">
            {rondaStatus ? (
              <Link href="/rondas/actual" title="Ronda actual"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors dark:text-gray-400 dark:hover:bg-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm0 8.625a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM15.375 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0ZM7.5 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clipRule="evenodd"/></svg>
              </Link>
            ) : (
              <Link href="/rondas/registro_ronda" title="Nueva ronda"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-emerald-600 transition-colors dark:text-gray-400 dark:hover:bg-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd"/></svg>
              </Link>
            )}
            <Link href="/prestamos/solicitud" title="Nuevo préstamo"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-orange-600 transition-colors dark:text-gray-400 dark:hover:bg-gray-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/><path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z" clipRule="evenodd"/></svg>
            </Link>
            <Link href="/rondas/historial" title="Historial"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-violet-600 transition-colors dark:text-gray-400 dark:hover:bg-gray-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM9.75 14.25a.75.75 0 0 0 0 1.5H15a.75.75 0 0 0 0-1.5H9.75Zm0-3a.75.75 0 0 0 0 1.5H15a.75.75 0 0 0 0-1.5H9.75Z" clipRule="evenodd"/><path d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z"/></svg>
            </Link>
            <div className="mx-1.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />
            <ThemeToggleButton />
          </div>

          <UserDropdown />
        </div>
      </div>

      {/* ── Barra búsqueda móvil (fila separada, no se solapa) ── */}
      <div className="lg:hidden px-3 pb-2 relative">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            {searching ? <IconSpinner /> : <IconSearch />}
          </span>
          <input ref={mobileInputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            onFocus={() => hasResults && setOpen(true)}
            placeholder="Buscar socios, rondas, préstamos…"
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
        </div>
        {open && hasResults && (
          <div ref={mobileDropdownRef}
            className="absolute top-[calc(100%+2px)] left-3 right-3 z-[70] rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 overflow-hidden max-h-[60vh] overflow-y-auto">
            {results?.socios && results.socios.length > 0 && (
              <div>
                <p className="border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Socios</p>
                {results.socios.map(s => (
                  <button key={s.id} onClick={() => navigate(`/socios/detalle?socioId=${s.id}`)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100/60 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-xs font-bold">{s.nombres[0]}{s.apellidos[0]}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.nombres} {s.apellidos}</p>
                        <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 shrink-0">{fmt(s.saldoAhorros)}</span>
                  </button>
                ))}
              </div>
            )}
            {results?.rondas && results.rondas.length > 0 && (
              <div>
                <p className="border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Rondas</p>
                {results.rondas.map(r => (
                  <button key={r.id} onClick={() => navigate(r.activa ? "/rondas/actual" : `/rondas/${r.id}/resultados`)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100/60 last:border-0">
                    <p className="text-sm font-medium text-gray-900">{r.nombre}</p>
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${r.activa ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{r.activa ? "Activa" : "Cerrada"}</span>
                  </button>
                ))}
              </div>
            )}
            {results?.prestamos && results.prestamos.length > 0 && (
              <div>
                <p className="border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Préstamos</p>
                {results.prestamos.map(p => (
                  <button key={p.id} onClick={() => navigate(`/prestamos/${p.id}`)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100/60 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.socio.nombres} {p.socio.apellidos}</p>
                      <p className="text-xs text-gray-400">{p.ronda.nombre} · {fmt(p.monto)}</p>
                    </div>
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 shrink-0 ${p.estado === "ACTIVO" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{p.estado}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        @media (min-width: 1024px) {
          header > div:first-child { padding-left: var(--sidebar-w, 90px); }
        }
      `}</style>
    </header>
  );
}
