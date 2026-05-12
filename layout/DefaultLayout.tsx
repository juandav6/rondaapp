// layout/DefaultLayout.tsx
"use client";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import React from "react";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";

const DefaultLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isLogin = pathname === "/login";
  const isPortal = pathname.startsWith("/portal");

  if (isLogin || isPortal) return <>{children}</>;

  if (status === "authenticated") {
    const rol = (session?.user as any)?.rol;
    if (rol === "SOCIO") return <>{children}</>;
  }

  return <AdminLayout>{children}</AdminLayout>;
};

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered } = useSidebar();
  const sidebarW = isExpanded || isHovered ? 290 : 90;

  return (
    <div className="min-h-screen">
      <AppSidebar />
      {/* En móvil: sin padding izquierdo (sidebar oculto)
          En desktop (lg+): padding = ancho del sidebar */}
      <div
        className="flex min-h-screen flex-col transition-[padding] duration-300 lg:pl-[var(--sidebar-w)]"
        style={{ ["--sidebar-w" as any]: `${sidebarW}px` }}
      >
        <AppHeader />
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DefaultLayout;
