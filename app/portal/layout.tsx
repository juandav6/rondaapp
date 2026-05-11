// app/portal/layout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import PortalHeader from "@/components/portal/PortalHeader";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as any;
  if (user.rol === "ADMIN") redirect("/");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <PortalHeader nombre={user.name ?? user.email} />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {children}
      </main>
    </div>
  );
}