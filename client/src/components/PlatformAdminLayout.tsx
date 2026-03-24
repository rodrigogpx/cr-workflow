import { ReactNode } from "react";
import { usePlatformAuth } from "@/_core/hooks/usePlatformAuth";
import { APP_LOGO } from "@/const";
import { Button } from "@/components/ui/button";
import { Shield, Building2, Settings, ChevronRight, UserCog, LayoutDashboard } from "lucide-react";
import { useLocation } from "wouter";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";

interface PlatformAdminLayoutProps {
  children: ReactNode;
  active: "dashboard" | "tenants" | "settings" | "admins";
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  support: 'Suporte',
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  admin: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  support: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

export function PlatformAdminLayout({ children, active }: PlatformAdminLayoutProps) {
  const { admin, role, isSuperAdmin } = usePlatformAuth();
  const [, setLocation] = useLocation();
  const tenantSlug = useTenantSlug();

  const items = [
    {
      id: "dashboard" as const,
      label: "Dashboard",
      description: "Visão geral da plataforma",
      icon: LayoutDashboard,
      path: "/platform-admin",
      enabled: true,
      visible: true,
    },
    {
      id: "tenants" as const,
      label: "Tenants (Clubes)",
      description: "Gestão de clubes e planos",
      icon: Building2,
      path: "/platform-admin/tenants",
      enabled: true,
      visible: true,
    },
    {
      id: "admins" as const,
      label: "Administradores",
      description: "Gestão de platform admins",
      icon: UserCog,
      path: "/platform-admin/admins",
      enabled: true,
      visible: isSuperAdmin,
    },
    {
      id: "settings" as const,
      label: "Configurações",
      description: "Parâmetros globais e compliance",
      icon: Settings,
      path: "/platform-admin/settings",
      enabled: true,
      visible: true,
    },
  ].filter(item => item.visible);

  const roleLabel = role ? ROLE_LABELS[role] ?? role : 'Administrador';
  const roleClass = role ? ROLE_COLORS[role] ?? ROLE_COLORS['support'] : ROLE_COLORS['support'];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-black/80 text-white flex flex-col border-r border-white/10">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
          <div className="bg-white rounded-md p-1">
            <img src={APP_LOGO} alt="" className="h-8 w-auto" />
          </div>
          <div className="leading-tight text-xs">
            <p className="uppercase tracking-[0.25em] text-[0.6rem] text-white/50">Administração</p>
            <p className="font-semibold text-[0.8rem]">CAC 360 – Plataforma</p>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-white/10 text-[0.7rem] flex items-center gap-2">
          <Shield className="h-3 w-3 text-emerald-400" />
          <span className="uppercase tracking-wide">Administrador</span>
          <span className={`ml-auto text-[0.6rem] font-semibold px-1.5 py-0.5 rounded border ${roleClass}`}>
            {roleLabel}
          </span>
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
                    ? "bg-white text-black border-white/60 shadow"
                    : item.enabled
                    ? "hover:bg-white/10 text-white/80"
                    : "opacity-40 cursor-not-allowed"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-black" : "text-white/70"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-[0.78rem]">{item.label}</p>
                  <p className="text-[0.65rem] text-white/60 truncate">{item.description}</p>
                </div>
                {item.enabled && (
                  <ChevronRight className={`h-3 w-3 ${isActive ? "text-black" : "text-white/50"}`} />
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 text-[0.65rem] text-white/60 flex flex-col gap-1">
          <span className="truncate">{(admin as any)?.name || (admin as any)?.email}</span>
          <span className="uppercase tracking-[0.2em] text-white/40">{roleLabel}</span>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 min-h-screen bg-background/80 backdrop-blur-sm p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between text-xs sm:text-sm text-white/70 mb-2">
            <div className="flex flex-col">
              <span className="uppercase tracking-[0.2em] text-white/40 text-[0.6rem]">Administração</span>
              <span className="font-medium text-[0.8rem]">CAC 360 – Plataforma</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(buildTenantPath(tenantSlug, "/dashboard"))}
              className="h-8 px-3 text-[0.65rem] font-semibold uppercase tracking-wide border-2 border-dashed border-white/40 hover:border-primary hover:bg-primary/10"
            >
              Voltar para módulos
            </Button>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
