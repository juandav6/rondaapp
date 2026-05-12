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

  // Login y portal → sin sidebar ni header de admin
  if (isLogin || isPortal) {
    return <>{children}</>;
  }

  // Sesión de SOCIO que por algún motivo llega aquí → sin sidebar
  if (status === "authenticated") {
    const rol = (session?.user as any)?.rol;
    if (rol === "SOCIO") {
      return <>{children}</>;
    }
  }

  // ADMIN → layout completo
  return <AdminLayout>{children}</AdminLayout>;
};

// Componente interno que puede usar useSidebar (requiere estar dentro de SidebarProvider)
function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered } = useSidebar();
  const sidebarW = isExpanded || isHovered ? 290 : 90;

  return (
    <div className="min-h-screen">
      <AppSidebar />
      <div
        className="flex min-h-screen flex-col transition-[padding] duration-300"
        style={{ paddingLeft: `${sidebarW}px` }}
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
