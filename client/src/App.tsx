import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ClientWorkflow from "./pages/ClientWorkflow";
import Admin from "./pages/Admin";
import PendingApproval from "./pages/PendingApproval";
import EmailTemplates from "./pages/EmailTemplates";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
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

  // Redirecionar usuários sem perfil para página de aguardando aprovação
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

  // Redirecionar usuários sem perfil para página de aguardando aprovação
  if (!user.role) {
    return <Redirect to="/pending-approval" />;
  }

  if (user.role !== 'admin') {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/pending-approval"} component={PendingApproval} />
      <Route path={"/"}>
        <Redirect to="/dashboard" />
      </Route>
      <Route path={"/dashboard"}>
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path={"/client/:id"}>
        <ProtectedRoute>
          <ClientWorkflow />
        </ProtectedRoute>
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
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
