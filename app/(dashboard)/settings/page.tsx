import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();

  if (!session) {
    redirect("/signin");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Account Settings
          </CardTitle>
          <CardDescription>Your account information and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <p className="text-sm text-muted-foreground">{session.user.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <p className="text-sm text-muted-foreground">{session.user.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Role</label>
            <p className="text-sm text-muted-foreground capitalize">{session.user.role}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

