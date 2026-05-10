"use client";
import React, { useMemo } from "react";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import { useSidebar } from "@/context/SidebarContext";
import { usePathname } from "next/navigation";

export default function DefaultLayout({ children }: { children: React.ReactNode }) {
  const { isExpanded, isMobileOpen, isHovered } = useSidebar();
  const pathname = usePathname();

  const sidebarWidth = useMemo(
    () => (isExpanded || isHovered ? 290 : 90),
    [isExpanded, isHovered]
  );

  // Rutas que NO deben mostrar sidebar/header
  const isAuthPage = pathname === "/login" || pathname?.startsWith("/login");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <AppSidebar />
      <div
        className="flex flex-col min-h-screen transition-all duration-300 ease-in-out"
        style={{ paddingLeft: isMobileOpen ? 0 : sidebarWidth }}
      >
        <div className="sticky top-0 z-40">
          <AppHeader />
        </div>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
