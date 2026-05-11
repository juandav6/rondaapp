// app/portal/page.tsx — redirige a /portal/[socioId]
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PortalRedirect() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.socioId) redirect("/login");
  redirect(`/portal/${user.socioId}`);
}