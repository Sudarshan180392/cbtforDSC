import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (!session || (role !== "ADMIN" && role !== "SUPERADMIN")) {
    redirect("/admin-login");
  }

  return <>{children}</>;
}
