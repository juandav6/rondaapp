"use client";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { useSidebar } from "@/context/SidebarContext";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef, useCallback } from "react";

const HEADER_H = 64;

type SearchResult = {
  socios: { id: number; nombres: string; apellidos: string; numeroCuenta: string; saldoAhorros: number }[];
  rondas: { id: number; nombre: string; activa: boolean; fechaInicio: string; fechaFin: string | null }[];
  prestamos: { id: number; monto: number; saldoActual: number; estado: string; socio: { nombres: string; apellidos: string; numeroCuenta: string }; ronda: { nombre: string } }[];
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar, isExpanded, isHovered } = useSidebar();
  const router = useRouter();

  const sidebarWidth = (isExpanded || isHovered) ? 290 : 90;

  const handleToggle = () => {
    if (window.innerWidth >= 1024) toggleSidebar();
    else toggleMobileSidebar();
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults(null); setOpen(false); return; }
    setSearching(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json())
      .then(d => { setResults(d); setOpen(true); })
      .catch(() => {})
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // ⌘K shortcut
  useEffect(() => {
    const onK = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    };
    document.addEventListener("keydown", onK);
    return () => document.removeEventListener("keydown", onK);
  }, []);

  function navigate(href: string) {
    setOpen(false); setQuery(""); router.push(href);
  }

  const hasResults = results && (results.socios.length + results.rondas.length + results.prestamos.length) > 0;

  return (
    <header
      className="sticky top-0 z-[60] w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      style={{ height: HEADER_H }}
    >
      <div
        className="mx-auto flex h-full w-full max-w-7xl items-center lg:px-6 transition-[padding] duration-300"
        style={{ ["--sidebar-w" as any]: `${sidebarWidth}px` }}
      >
        <div className="flex w-full items-center justify-between gap-2 px-3 lg:px-0">
          {/* Hamburger */}
          <button
            className="z-[61] flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 lg:h-11 lg:w-11 lg:border lg:border-gray-200 dark:lg:border-gray-800"
            onClick={handleToggle} aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M6.22 7.28a.75.75 0 1 1 1.06-1.06L12 10.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L13.06 12l4.72 4.72a.75.75 0 0 1-1.06 1.06L12 13.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L10.94 12 6.22 7.28Z" fill="currentColor"/></svg>
            ) : (
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M.583 1A.75.75 0 0 1 1.333.25h13.333a.75.75 0 1 1 0 1.5H1.333A.75.75 0 0 1 .583 1Zm0 10a.75.75 0 0 1 .75-.75h13.333a.75.75 0 1 1 0 1.5H1.333a.75.75 0 0 1-.75-.75ZM1.333 5.25a.75.75 0 0 0 0 1.5H8a.75.75 0 0 0 0-1.5H1.333Z" fill="currentColor"/></svg>
            )}
          </button>

          {/* Menú apps mobile */}
          <button onClick={() => setApplicationMenuOpen(v => !v)}
            className="z-[61] flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M6 10.495a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm12 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-5 1.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" fill="currentColor"/></svg>
          </button>

          {/* ── Search bar (desktop) ── */}
          <div className="hidden lg:block flex-1 relative">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                {searching ? (
                  <svg className="animate-spin text-gray-400" width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
                    <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3"/>
                  </svg>
                ) : (
                  <svg className="fill-gray-500 dark:fill-gray-400" width="20" height="20" viewBox="0 0 20 20">
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.042 9.374A6.333 6.333 0 1 1 9.375 15.705 6.333 6.333 0 0 1 3.042 9.374Zm6.333-7.832a8.333 8.333 0 1 0 4.982 15.17l2.82 2.821a.75.75 0 1 0 1.06-1.06l-2.82-2.821a8.333 8.333 0 0 0-6.043-14.11Z"/>
                  </svg>
                )}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => hasResults && setOpen(true)}
                placeholder="Buscar socios, rondas, préstamos…"
                className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 xl:w-[430px]"
              />
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
                ⌘ K
              </button>
            </div>

            {/* ── Dropdown resultados ── */}
            {open && (
              <div ref={dropdownRef}
                className="absolute top-[calc(100%+8px)] left-0 z-[70] w-full xl:w-[430px] rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 overflow-hidden">

                {!hasResults && !searching && (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    Sin resultados para "<strong>{query}</strong>"
                  </div>
                )}

                {/* Socios */}
                {results && results.socios.length > 0 && (
                  <div>
                    <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:bg-gray-800/50">
                      Socios
                    </div>
                    {results.socios.map(s => (
                      <button key={s.id} onClick={() => navigate(`/socios/detalle?socioId=${s.id}`)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                            {s.nombres[0]}{s.apellidos[0]}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate dark:text-white">{s.nombres} {s.apellidos}</p>
                            <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-emerald-700 shrink-0">{fmtMoney(s.saldoAhorros)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Rondas */}
                {results && results.rondas.length > 0 && (
                  <div>
                    <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:bg-gray-800/50">
                      Rondas
                    </div>
                    {results.rondas.map(r => (
                      <button key={r.id} onClick={() => navigate(r.activa ? "/rondas/actual" : `/rondas/${r.id}/resultados`)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                              <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"/>
                            </svg>
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{r.nombre}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(r.fechaInicio).toLocaleDateString("es-EC")}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${r.activa ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {r.activa ? "Activa" : "Cerrada"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Préstamos */}
                {results && results.prestamos.length > 0 && (
                  <div>
                    <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:bg-gray-800/50">
                      Préstamos
                    </div>
                    {results.prestamos.map(p => (
                      <button key={p.id} onClick={() => navigate(`/prestamos/${p.id}`)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                              <path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/>
                              <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z" clipRule="evenodd"/>
                            </svg>
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate dark:text-white">
                              {p.socio.nombres} {p.socio.apellidos}
                            </p>
                            <p className="text-xs text-gray-400">{p.ronda.nombre} · {fmtMoney(p.monto)}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 shrink-0 ${
                          p.estado === "ACTIVO" ? "bg-blue-100 text-blue-700" :
                          p.estado === "CANCELADO" ? "bg-emerald-100 text-emerald-700" :
                          "bg-rose-100 text-rose-700"
                        }`}>
                          {p.estado}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-800/50">
                  Presiona <kbd className="rounded border px-1 py-0.5 text-xs">Esc</kbd> para cerrar
                </div>
              </div>
            )}
          </div>

          {/* Acciones derecha */}
          <div className={`${isApplicationMenuOpen ? "flex" : "hidden"} w-full items-center justify-between gap-4 px-2 lg:flex lg:w-auto lg:justify-end lg:px-0`}>
            <div className="flex items-center gap-2 2xsm:gap-3">
              <ThemeToggleButton />
              <NotificationDropdown />
            </div>
            <UserDropdown />
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media (min-width: 1024px) {
          header > div { padding-left: var(--sidebar-w, 90px); }
        }
      `}</style>
    </header>
  );
};

export default AppHeader;
