import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import React, { Suspense, lazy } from "react";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MainDashboard = lazy(() => import("./pages/MainDashboard"));
const ClientWorkflow = lazy(() => import("./pages/ClientWorkflow"));
const Admin = lazy(() => import("./pages/Admin"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const EmailTemplates = lazy(() => import("./pages/EmailTemplates"));
const Users = lazy(() => import("./pages/Users"));
const PlatformAdminUsers = lazy(() => import("./pages/PlatformAdminUsers"));
const PlatformAdminEmailTemplates = lazy(() => import("./pages/PlatformAdminEmailTemplates"));
const PlatformAdminSettings = lazy(() => import("./pages/PlatformAdminSettings"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

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

  return <>{children}</>;
}

function ApprovedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  console.log("[FRONT DEBUG] ApprovedRoute - User:", user, "Loading:", loading);

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

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

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
    return <Redirect to="/dashboard" />;
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
        <Route path={"/register"} component={Register} />
        <Route path={"/pending-approval"}>
          <AuthenticatedRoute>
            <PendingApproval />
          </AuthenticatedRoute>
        </Route>
        <Route path={"/"}>
          <Redirect to="/dashboard" />
        </Route>
        <Route path={"/dashboard"}>
          <ApprovedRoute>
            <MainDashboard />
          </ApprovedRoute>
        </Route>
        <Route path={"/cr-workflow"}>
          <ApprovedRoute>
            <Dashboard />
          </ApprovedRoute>
        </Route>
        <Route path={"/client/:id"}>
          <ApprovedRoute>
            <ClientWorkflow />
          </ApprovedRoute>
        </Route>
        <Route path={"/admin"}>
          <AdminRoute>
            <Admin />
          </AdminRoute>
        </Route>
        <Route path={"/platform-admin/users"}>
          <AdminRoute>
            <PlatformAdminUsers />
          </AdminRoute>
        </Route>
        <Route path={"/platform-admin/email-templates"}>
          <AdminRoute>
            <PlatformAdminEmailTemplates />
          </AdminRoute>
        </Route>
        <Route path={"/platform-admin/settings"}>
          <AdminRoute>
            <PlatformAdminSettings />
          </AdminRoute>
        </Route>
        <Route path={"/admin/email-templates"}>
          <Redirect to="/platform-admin/email-templates" />
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
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <ThemeProvider defaultTheme="light">
            <TooltipProvider>
              <Toaster />
              <div className="min-h-screen relative overflow-hidden">
                {/* Background Image global */}
                <div
                  className="absolute inset-0 -z-20"
                  style={{
                    backgroundImage: 'url("/background-01.webp")',
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                {/* Overlay para legibilidade em todas as páginas */}
                <div className="absolute inset-0 -z-10 bg-background/80 backdrop-blur-[2px]"></div>

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
