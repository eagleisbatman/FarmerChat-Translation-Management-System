import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations, organizationMembers, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { verifyOrganizationAccess } from "@/lib/security/organization-access";
import { OrganizationSettingsClient } from "@/components/organization-settings-client";
import { OrganizationMemberManager } from "@/components/organization-member-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session) {
    redirect("/signin");
  }

  // Verify admin access
  try {
    await verifyOrganizationAccess(session.user.id, id, true);
  } catch (error) {
    redirect("/organizations");
  }

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);

  if (!organization) {
    notFound();
  }

  // Fetch organization members
  const organizationMembersData = await db
    .select({
      member: organizationMembers,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, id))
    .orderBy(organizationMembers.createdAt);

  // Fetch all users for member selection
  const allUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
  }).from(users);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-muted-foreground">
          Configure email, AI providers, and authentication for {organization.name}
        </p>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <OrganizationSettingsClient organizationId={id} organizationName={organization.name} />
        </TabsContent>

        <TabsContent value="members">
          <OrganizationMemberManager
            organizationId={id}
            initialMembers={organizationMembersData}
            allUsers={allUsers}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

