import { ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { APP_LOGO } from "@/const";
import { Button } from "@/components/ui/button";
import { Shield, Users, Mail, Settings, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

interface PlatformAdminLayoutProps {
  children: ReactNode;
  active: "users" | "emails" | "settings";
}

export function PlatformAdminLayout({ children, active }: PlatformAdminLayoutProps) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  const items = [
    {
      id: "users" as const,
      label: "Usuários da Plataforma",
      description: "Perfis de acesso (admin e operadores)",
      icon: Users,
      path: "/platform-admin/users",
      enabled: true,
    },
    {
      id: "emails" as const,
      label: "Templates de Email",
      description: "Conteúdo de comunicação com clientes",
      icon: Mail,
      path: "/platform-admin/email-templates",
      enabled: true,
    },
    {
      id: "settings" as const,
      label: "Configurações",
      description: "Parâmetros globais e compliance",
      icon: Settings,
      path: "/platform-admin/settings",
      enabled: true,
    },
  ];

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
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 text-xs">
          {items.map((item) => {
            const isActive = active === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                disabled={!item.enabled}
                onClick={() => item.enabled && setLocation(item.path)}
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
          <span className="truncate">{user?.name || user?.email}</span>
          <span className="uppercase tracking-[0.2em] text-white/40">Admin da Plataforma</span>
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
              onClick={() => setLocation("/dashboard")}
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
