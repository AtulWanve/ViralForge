import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = {
  title: "Admin Dashboard | ViralForge",
};

export default async function AdminDashboard() {
  const supabase = await createClient();

  // 1. Verify user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projects Overview</CardTitle>
          <CardDescription>All projects across the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* We will load this data in a separate server component or via a secure action */}
          <AdminProjectsTable />
        </CardContent>
      </Card>
    </div>
  );
}

async function AdminProjectsTable() {
  // Service role: this table aggregates every user's projects, which RLS on the
  // page's regular client would hide. The page above already gated on role=admin.
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all users
  const { data: authData } = await adminClient.auth.admin.listUsers();
  const authUsers = authData?.users || [];

  // Get all projects
  const { data: projects, error: projectsError } = await adminClient
    .from("projects")
    .select("id, name, user_id, updated_at")
    .order("updated_at", { ascending: false });

  // Get asset counts per project
  const { data: assets, error: assetsError } = await adminClient
    .from("generated_assets")
    .select("project_id");

  // Fetch emails from public.users
  const { data: publicUsers, error: publicUsersError } = await adminClient
    .from("users")
    .select("id, email");

  if (projectsError) throw new Error("Failed to load projects in the admin dashboard");
  if (assetsError) throw new Error("Failed to load generated assets in the admin dashboard");
  if (publicUsersError) throw new Error("Failed to load users in the admin dashboard");

  const assetCounts = (assets || []).reduce((acc: Record<string, number>, asset) => {
    acc[asset.project_id] = (acc[asset.project_id] || 0) + 1;
    return acc;
  }, {});

  const projectsWithUsers = (projects || []).map((project) => {
    const user = (publicUsers || []).find((u) => u.id === project.user_id);
    return {
      ...project,
      email: user?.email || "Unknown User",
      assetCount: assetCounts[project.id] || 0,
    };
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project Name</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Assets Generated</TableHead>
          <TableHead>Last Activity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projectsWithUsers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
              No projects found.
            </TableCell>
          </TableRow>
        ) : (
          projectsWithUsers.map((project) => (
            <TableRow key={project.id}>
              <TableCell className="font-medium">{project.name}</TableCell>
              <TableCell>{project.email}</TableCell>
              <TableCell>{project.assetCount}</TableCell>
              <TableCell>{new Date(project.updated_at).toLocaleDateString()}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
