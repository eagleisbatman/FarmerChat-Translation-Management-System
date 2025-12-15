import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardLayout } from "@/components/dashboard-layout";

export default async function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/signin");
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

