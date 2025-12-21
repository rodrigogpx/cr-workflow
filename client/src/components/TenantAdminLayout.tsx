import { ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { APP_LOGO } from "@/const";
import { Button } from "@/components/ui/button";
import { Shield, Users, Mail, Settings, UserCheck, LayoutDashboard, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";

interface TenantAdminLayoutProps {
  children: ReactNode;
  active: "dashboard" | "users" | "operators" | "emails" | "settings" | "audit";
}

export function TenantAdminLayout({ children, active }: TenantAdminLayoutProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const tenantSlug = useTenantSlug();

  const items = [
    {
      id: "dashboard" as const,
      label: "Painel",
      description: "Visão geral e estatísticas",
      icon: LayoutDashboard,
      path: "/admin",
      enabled: true,
    },
    {
      id: "users" as const,
      label: "Usuários",
      description: "Admins e operadores do clube",
      icon: Users,
      path: "/admin/users",
      enabled: true,
    },
    {
      id: "operators" as const,
      label: "Operadores",
      description: "Atribuição de clientes",
      icon: UserCheck,
      path: "/admin/operators",
      enabled: true,
    },
    {
      id: "emails" as const,
      label: "Templates de Email",
      description: "Comunicação com clientes",
      icon: Mail,
      path: "/admin/emails",
      enabled: true,
    },
    {
      id: "settings" as const,
      label: "Configurações",
      description: "SMTP e parâmetros",
      icon: Settings,
      path: "/admin/settings",
      enabled: true,
    },
    {
      id: "audit" as const,
      label: "Auditoria",
      description: "Histórico de ações",
      icon: FileText,
      path: "/admin/audit",
      enabled: true,
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-black/90 text-white flex flex-col border-r border-white/10">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
          <div className="bg-white rounded-md p-1">
            <img src={APP_LOGO} alt="" className="h-8 w-auto" />
          </div>
          <div className="leading-tight text-xs">
            <p className="uppercase tracking-[0.25em] text-[0.6rem] text-white/50">Administração</p>
            <p className="font-semibold text-[0.8rem]">CAC 360</p>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-white/10 text-[0.7rem] flex items-center gap-2">
          <Shield className="h-3 w-3 text-emerald-400" />
          <span className="uppercase tracking-wide">Admin do Clube</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 text-xs">
          {items.map((item) => {
            const isActive = active === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                disabled={!item.enabled}
                onClick={() => item.enabled && setLocation(buildTenantPath(tenantSlug, item.path))}
                className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-3 transition-all border border-transparent ${
                  isActive
                    ? "bg-primary text-black border-primary shadow"
                    : item.enabled
                    ? "hover:bg-white/10 text-white/80"
                    : "opacity-40 cursor-not-allowed"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-black" : "text-white/70"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-[0.78rem]">{item.label}</p>
                  <p className={`text-[0.65rem] truncate ${isActive ? "text-black/60" : "text-white/50"}`}>
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 text-[0.65rem] text-white/60 flex flex-col gap-1">
          <span className="truncate">{user?.name || user?.email}</span>
          <span className="uppercase tracking-[0.2em] text-white/40">Administrador</span>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 min-h-screen bg-[#f0f0f0]">
        <header className="bg-black/80 border-b border-white/10 px-6 py-3 flex items-center justify-between">
          <div className="text-xs text-white/70">
            <span className="uppercase tracking-[0.2em] text-white/40 text-[0.6rem]">Administração</span>
            <span className="mx-2 text-white/30">•</span>
            <span className="font-medium">{items.find(i => i.id === active)?.label}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(buildTenantPath(tenantSlug, "/dashboard"))}
            className="h-7 px-3 text-[0.65rem] font-semibold uppercase tracking-wide border border-white/30 text-white/70 hover:bg-white/10 hover:text-white bg-transparent"
          >
            ← Voltar
          </Button>
        </header>
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
