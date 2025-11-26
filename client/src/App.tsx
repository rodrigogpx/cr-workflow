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
const ClientWorkflow = lazy(() => import("./pages/ClientWorkflow"));
const Admin = lazy(() => import("./pages/Admin"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const EmailTemplates = lazy(() => import("./pages/EmailTemplates"));
const Users = lazy(() => import("./pages/Users"));
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
        <Route path={"/admin/email-templates"}>
          <AdminRoute>
            <EmailTemplates />
          </AdminRoute>
        </Route>
        <Route path={"/admin/users"}>
          <AdminRoute>
            <Users />
          </AdminRoute>
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
              <Router />
            </TooltipProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
