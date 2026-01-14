import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import React, { Suspense, lazy } from "react";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MainDashboard = lazy(() => import("./pages/MainDashboard"));
const ClientWorkflow = lazy(() => import("./pages/ClientWorkflow"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const SuperAdminTenants = lazy(() => import("./pages/SuperAdminTenants"));
// Tenant Admin pages (unified)
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminOperators = lazy(() => import("./pages/AdminOperators"));
const AdminEmails = lazy(() => import("./pages/AdminEmails"));
const AdminSettings = lazy(() => import("./pages/TenantSettings"));
const AdminAudit = lazy(() => import("./pages/AdminAudit"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function getBackgroundForPath(path: string) {
  // Considerar tanto rotas raiz quanto rotas com slug de tenant (/:tenantSlug/...).
  if (
    path.includes("/cr-workflow") ||
    path.includes("/client/") ||
    path.includes("/workflow-admin")
  ) {
    return "/backgrond-02.webp";
  }
  return "/background-01.webp";
}

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const tenantSlug = useTenantSlug();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    const target = buildTenantPath(tenantSlug, "/login");
    return <Redirect to={target} />;
  }

  return <>{children}</>;
}

function ApprovedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const tenantSlug = useTenantSlug();
  console.log("[FRONT DEBUG] ApprovedRoute - User:", user, "Loading:", loading);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    const target = buildTenantPath(tenantSlug, "/login");
    return <Redirect to={target} />;
  }

  if (!user.role) {
    const target = buildTenantPath(tenantSlug, "/pending-approval");
    return <Redirect to={target} />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const tenantSlug = useTenantSlug();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!user.role) {
    return <Redirect to="/pending-approval" />;
  }

  if (user.role !== "admin") {
    const target = buildTenantPath(tenantSlug, "/dashboard");
    return <Redirect to={target} />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
      <Switch>
        <Route path={"/login"} component={Login} />
        <Route path={"/:tenantSlug/login"} component={Login} />
        <Route path={"/register"} component={Register} />
        <Route path={"/:tenantSlug/register"} component={Register} />
        <Route path={"/pending-approval"}>
          <AuthenticatedRoute>
            <PendingApproval />
          </AuthenticatedRoute>
        </Route>
        <Route path={"/:tenantSlug/pending-approval"}>
          <AuthenticatedRoute>
            <PendingApproval />
          </AuthenticatedRoute>
        </Route>
        <Route path={"/"} component={Login} />
        <Route path={"/:tenantSlug"}>
          {({ tenantSlug }: { tenantSlug: string }) => (
            <Redirect to={buildTenantPath(tenantSlug, "/dashboard")} />
          )}
        </Route>
        <Route path={"/:tenantSlug/dashboard"}>
          <ApprovedRoute>
            <MainDashboard />
          </ApprovedRoute>
        </Route>
        <Route path={"/dashboard"}>
          <ApprovedRoute>
            <MainDashboard />
          </ApprovedRoute>
        </Route>
        <Route path={"/:tenantSlug/cr-workflow"}>
          <ApprovedRoute>
            <Dashboard />
          </ApprovedRoute>
        </Route>
        <Route path={"/cr-workflow"}>
          <ApprovedRoute>
            <Dashboard />
          </ApprovedRoute>
        </Route>
        <Route path={"/:tenantSlug/client/:id"}>
          <ApprovedRoute>
            <ClientWorkflow />
          </ApprovedRoute>
        </Route>
        <Route path={"/client/:id"}>
          <ApprovedRoute>
            <ClientWorkflow />
          </ApprovedRoute>
        </Route>
        {/* Tenant Admin - Unified */}
        <Route path={"/:tenantSlug/admin"}>
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        </Route>
        <Route path={"/admin"}>
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        </Route>
        <Route path={"/:tenantSlug/admin/users"}>
          <AdminRoute>
            <AdminUsers />
          </AdminRoute>
        </Route>
        <Route path={"/admin/users"}>
          <AdminRoute>
            <AdminUsers />
          </AdminRoute>
        </Route>
        <Route path={"/:tenantSlug/admin/operators"}>
          <AdminRoute>
            <AdminOperators />
          </AdminRoute>
        </Route>
        <Route path={"/admin/operators"}>
          <AdminRoute>
            <AdminOperators />
          </AdminRoute>
        </Route>
        <Route path={"/:tenantSlug/admin/emails"}>
          <AdminRoute>
            <AdminEmails />
          </AdminRoute>
        </Route>
        <Route path={"/admin/emails"}>
          <AdminRoute>
            <AdminEmails />
          </AdminRoute>
        </Route>
        <Route path={"/:tenantSlug/admin/settings"}>
          <AdminRoute>
            <AdminSettings />
          </AdminRoute>
        </Route>
        <Route path={"/admin/settings"}>
          <AdminRoute>
            <AdminSettings />
          </AdminRoute>
        </Route>
        <Route path={"/:tenantSlug/admin/audit"}>
          <AdminRoute>
            <AdminAudit />
          </AdminRoute>
        </Route>
        <Route path={"/admin/audit"}>
          <AdminRoute>
            <AdminAudit />
          </AdminRoute>
        </Route>
        {/* Super Admin */}
        <Route path={"/super-admin/tenants"}>
          <AdminRoute>
            <SuperAdminTenants />
          </AdminRoute>
        </Route>
        {/* Legacy redirects */}
        <Route path={"/:tenantSlug/platform-admin/users"}>
          {({ tenantSlug }: { tenantSlug: string }) => (
            <Redirect to={buildTenantPath(tenantSlug, "/admin/users")} />
          )}
        </Route>
        <Route path={"/:tenantSlug/platform-admin/email-templates"}>
          {({ tenantSlug }: { tenantSlug: string }) => (
            <Redirect to={buildTenantPath(tenantSlug, "/admin/emails")} />
          )}
        </Route>
        <Route path={"/:tenantSlug/platform-admin/settings"}>
          {({ tenantSlug }: { tenantSlug: string }) => (
            <Redirect to={buildTenantPath(tenantSlug, "/admin/settings")} />
          )}
        </Route>
        <Route path={"/:tenantSlug/workflow-admin/operators"}>
          {({ tenantSlug }: { tenantSlug: string }) => (
            <Redirect to={buildTenantPath(tenantSlug, "/admin/operators")} />
          )}
        </Route>
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

import { QueryClientProvider } from "@tanstack/react-query";
import { trpc } from "./lib/trpc";
import { queryClient, trpcClient } from "./lib/trpcClient";

function App() {
  const [location] = useLocation();
  const backgroundImage = getBackgroundForPath(location);
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <ThemeProvider defaultTheme="light">
            <TooltipProvider>
              <Toaster />
              <div className="min-h-screen relative overflow-hidden">
                {/* Background Image global (por módulo) */}
                <div
                  className="absolute inset-0 -z-20"
                  style={{
                    backgroundImage: `url("${backgroundImage}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                {/* Overlay para legibilidade em todas as páginas */}
                <div className="absolute inset-0 -z-10 bg-background/20 backdrop-blur-[2px]"></div>

                <div className="relative z-10">
                  <Router />
                </div>
              </div>
            </TooltipProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
