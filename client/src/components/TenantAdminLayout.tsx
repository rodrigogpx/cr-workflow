import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { APP_LOGO } from "@/const";
import { Button } from "@/components/ui/button";
import { Shield, Users, UserCheck, FileText, X, ChevronRight, Mail, Zap, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { useEffectiveTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";

interface TenantAdminLayoutProps {
  children: ReactNode;
  active: "dashboard" | "users" | "operators" | "emails" | "email-triggers" | "settings" | "audit";
}

export function TenantAdminLayout({ children, active }: TenantAdminLayoutProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const tenantSlug = useEffectiveTenantSlug();
  const [panelMounted, setPanelMounted] = useState(false);

  const isPanelOpen = active !== "dashboard";

  // Animate panel on mount
  useEffect(() => {
    if (isPanelOpen) {
      const timer = setTimeout(() => setPanelMounted(true), 10);
      return () => clearTimeout(timer);
    } else {
      setPanelMounted(false);
    }
  }, [isPanelOpen]);

  const cardItems = [
    {
      id: "users" as const,
      label: "Usuários",
      description: "Gerencie admins e operadores do clube",
      icon: Users,
      path: "/admin/users",
      color: "from-blue-500 to-blue-700",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
    },
    {
      id: "operators" as const,
      label: "Operadores",
      description: "Atribuição de clientes aos operadores",
      icon: UserCheck,
      path: "/admin/operators",
      color: "from-emerald-500 to-emerald-700",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
    },
    {
      id: "audit" as const,
      label: "Auditoria",
      description: "Histórico completo de ações do sistema",
      icon: FileText,
      path: "/admin/audit",
      color: "from-amber-500 to-amber-700",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
    },
    {
      id: "emails" as const,
      label: "Templates de Email",
      description: "Edite os templates de email enviados aos clientes",
      icon: Mail,
      path: "/admin/emails",
      color: "from-purple-500 to-purple-700",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600",
    },
    {
      id: "email-triggers" as const,
      label: "Automação",
      description: "Configure gatilhos para disparos automáticos",
      icon: Zap,
      path: "/admin/email-triggers",
      color: "from-yellow-500 to-yellow-700",
      iconBg: "bg-yellow-500/10",
      iconColor: "text-yellow-600",
    },
    {
      id: "settings" as const,
      label: "Configurações",
      description: "Ajustes do clube, logo e SMTP",
      icon: Settings,
      path: "/admin/settings",
      color: "from-slate-500 to-slate-700",
      iconBg: "bg-slate-500/10",
      iconColor: "text-slate-600",
    },
  ];

  const activeItem = cardItems.find(i => i.id === active);

  const handleClosePanel = () => {
    setPanelMounted(false);
    setTimeout(() => {
      setLocation(buildTenantPath(tenantSlug, "/admin"));
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#f0f0f0]">
      {/* Header */}
      <header className="bg-black/90 border-b border-white/10 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-md p-1">
              <img src={APP_LOGO} alt="" className="h-7 w-auto" />
            </div>
            <div className="leading-tight">
              <p className="uppercase tracking-[0.25em] text-[0.55rem] text-white/40">Administração</p>
              <p className="font-semibold text-white text-[0.8rem]">CAC 360</p>
            </div>
          </div>
          <div className="h-6 w-px bg-white/10 mx-2" />
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            <span className="uppercase tracking-wider text-[0.65rem]">{user?.name || user?.email}</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation(buildTenantPath(tenantSlug, "/dashboard"))}
          className="h-7 px-3 text-[0.65rem] font-semibold uppercase tracking-wide border border-white/30 text-white/70 hover:bg-white/10 hover:text-white bg-transparent"
        >
          ← Voltar ao Dashboard
        </Button>
      </header>

      {/* Main content */}
      <div className="p-6 max-w-6xl mx-auto">
        {active === "dashboard" && (
          <>
            {children}

            {/* Navigation Cards */}
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Configurações do Clube
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cardItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setLocation(buildTenantPath(tenantSlug, item.path))}
                      className="group relative bg-white rounded-xl border border-gray-200 p-5 text-left transition-all duration-200 hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                      <div className="flex items-start justify-between">
                        <div className={`${item.iconBg} rounded-lg p-3`}>
                          <Icon className={`h-6 w-6 ${item.iconColor}`} />
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
                      </div>
                      <div className="mt-4">
                        <h3 className="font-semibold text-gray-900 text-base">{item.label}</h3>
                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.description}</p>
                      </div>
                      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${item.color} rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sliding Panel Overlay */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
              panelMounted ? "opacity-100" : "opacity-0"
            }`}
            onClick={handleClosePanel}
          />

          {/* Panel - slides from left to right, 75% width */}
          <div
            className={`absolute top-0 left-0 h-full w-[75%] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
              panelMounted ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Panel Header */}
            <div className="bg-black/90 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                {activeItem && (
                  <div className={`${activeItem.iconBg} rounded-lg p-2`}>
                    <activeItem.icon className={`h-5 w-5 ${activeItem.iconColor}`} />
                  </div>
                )}
                <div>
                  <h2 className="text-white font-semibold text-base">{activeItem?.label || "Configuração"}</h2>
                  <p className="text-white/50 text-xs">{activeItem?.description}</p>
                </div>
              </div>
              <button
                onClick={handleClosePanel}
                className="text-white/60 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#f5f5f5]">
              <div className="max-w-5xl mx-auto">
                {children}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
