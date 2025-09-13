"use client";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { useSidebar } from "@/context/SidebarContext";
import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";

const HEADER_H = 64; // px

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar, isExpanded, isHovered } = useSidebar();

  // calcula ancho actual del sidebar (para ≥lg)
  const sidebarWidth = (isExpanded || isHovered) ? 290 : 90;

  const handleToggle = () => {
    if (window.innerWidth >= 1024) toggleSidebar();
    else toggleMobileSidebar();
  };

  const toggleApplicationMenu = () => setApplicationMenuOpen((v) => !v);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onK = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onK);
    return () => document.removeEventListener("keydown", onK);
  }, []);

  return (
    <header
      className="sticky top-0 z-[60] w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      style={{ height: HEADER_H }}
    >
      <div
        className="mx-auto flex h-full w-full max-w-7xl items-center lg:px-6 transition-[padding] duration-300"
        // deja espacio del sidebar SOLO en ≥lg
        style={{ ['--sidebar-w' as any]: `${sidebarWidth}px`, paddingLeft: undefined }}
      >
        <div className="flex w-full items-center justify-between gap-2 px-3 lg:px-0">
          {/* Botón hamburger / close */}
          <button
            className="z-[61] flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 lg:h-11 lg:w-11 lg:border lg:border-gray-200 dark:lg:border-gray-800"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M6.22 7.28a.75.75 0 1 1 1.06-1.06L12 10.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L13.06 12l4.72 4.72a.75.75 0 0 1-1.06 1.06L12 13.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L10.94 12 6.22 7.28Z" fill="currentColor"/></svg>
            ) : (
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M.583 1A.75.75 0 0 1 1.333.25h13.333a.75.75 0 1 1 0 1.5H1.333A.75.75 0 0 1 .583 1Zm0 10a.75.75 0 0 1 .75-.75h13.333a.75.75 0 1 1 0 1.5H1.333a.75.75 0 0 1-.75-.75ZM1.333 5.25a.75.75 0 0 0 0 1.5H8a.75.75 0 0 0 0-1.5H1.333Z" fill="currentColor"/></svg>
            )}
          </button>

          {/* Logo (solo mobile) */}
          <Link href="/" className="lg:hidden">
            <Image width={154} height={32} className="dark:hidden" src="/images/logo/logo.svg" alt="Logo" />
            <Image width={154} height={32} className="hidden dark:block" src="/images/logo/logo-dark.svg" alt="Logo" />
          </Link>

          {/* menú apps (solo mobile) */}
          <button
            onClick={toggleApplicationMenu}
            className="z-[61] flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
            aria-label="Open quick menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M6 10.495a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm12 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-5 1.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" fill="currentColor"/></svg>
          </button>

          {/* Search (solo desktop) */}
          <div className="hidden lg:block flex-1">
            <form>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                  <svg className="fill-gray-500 dark:fill-gray-400" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.042 9.374A6.333 6.333 0 1 1 9.375 15.705 6.333 6.333 0 0 1 3.042 9.374Zm6.333-7.832a8.333 8.333 0 1 0 4.982 15.17l2.82 2.821a.75.75 0 1 0 1.06-1.06l-2.82-2.821a8.333 8.333 0 0 0-6.043-14.11Z" fill="currentColor"/>
                  </svg>
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search or type command..."
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 xl:w-[430px]"
                />
                <button className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
                  ⌘ K
                </button>
              </div>
            </form>
          </div>

          {/* acciones derechas */}
          <div className={`${isApplicationMenuOpen ? "flex" : "hidden"} w-full items-center justify-between gap-4 px-2 lg:flex lg:w-auto lg:justify-end lg:px-0`}>
            <div className="flex items-center gap-2 2xsm:gap-3">
              <ThemeToggleButton />
              <NotificationDropdown />
            </div>
            <UserDropdown />
          </div>
        </div>
      </div>

      {/* Padding left dinámico para ≥lg (evita que el header quede debajo del sidebar) */}
      <style jsx global>{`
        @media (min-width: 1024px) {
          header > div { padding-left: var(--sidebar-w, 90px); }
        }
      `}</style>
    </header>
  );
};

export default AppHeader;
