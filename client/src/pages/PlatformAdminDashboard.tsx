/**
 * Platform Admin - Dashboard
 * 
 * Página inicial da administração da plataforma CAC 360.
 * Exibe estatísticas globais, métricas financeiras (placeholder) e navegação para sub-seções.
 */

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePlatformAuth } from "@/_core/hooks/usePlatformAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AdminForm } from "@/components/platform-admin/AdminForm";
import { ChangePasswordDialog } from "@/components/platform-admin/ChangePasswordDialog";
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Database,
  HardDrive,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  ChevronRight,
  UserCog,
  Settings,
  LogOut,
  LayoutDashboard,
  Loader2,
  KeyRound,
  Mail,
  Cog,
} from "lucide-react";

const APP_LOGO = "/logo.png";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  support: "Suporte",
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  admin: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  support: "bg-slate-500/20 text-slate-300 border-slate-500/40",
};

export default function PlatformAdminDashboard() {
  const [, setLocation] = useLocation();
  const { admin, role, isSuperAdmin, logout } = usePlatformAuth();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const { data: tenants = [], isLoading: isLoadingTenants } = trpc.tenants.list.useQuery();
  const { data: globalStats, isLoading: isLoadingStats } = trpc.tenants.getGlobalStats.useQuery();

  const tenantStats = useMemo(() => {
    const active = tenants.filter((t) => t.subscriptionStatus === "active").length;
    const trial = tenants.filter((t) => t.subscriptionStatus === "trial").length;
    const suspended = tenants.filter((t) => t.subscriptionStatus === "suspended").length;
    const cancelled = tenants.filter((t) => t.subscriptionStatus === "cancelled").length;
    return { active, trial, suspended, cancelled, total: tenants.length };
  }, [tenants]);

  const roleLabel = role ? ROLE_LABELS[role] ?? role : "Administrador";
  const roleClass = role ? ROLE_COLORS[role] ?? ROLE_COLORS["support"] : ROLE_COLORS["support"];

  const navItems = [
    {
      id: "tenants",
      label: "Tenants (Clubes)",
      description: "Gerencie clubes, planos, features e configurações de email",
      icon: Building2,
      path: "/platform-admin/tenants",
      color: "from-purple-500 to-purple-700",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-400",
      visible: true,
    },
    {
      id: "admins",
      label: "Administradores",
      description: "Gestão de platform admins, roles e permissões",
      icon: UserCog,
      path: "/platform-admin/admins",
      color: "from-amber-500 to-amber-700",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
      visible: isSuperAdmin,
    },
    {
      id: "settings",
      label: "Configurações",
      description: "Perfil, parâmetros globais e integrações",
      icon: Settings,
      path: "",
      action: () => setSettingsOpen(true),
      color: "from-slate-500 to-slate-700",
      iconBg: "bg-slate-500/10",
      iconColor: "text-slate-400",
      visible: true,
    },
  ].filter((item) => item.visible);

  return (
    <div className="min-h-screen relative bg-gray-950">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/background-super-admin.png')" }}
      />
      <div className="absolute inset-0 bg-slate-950/70" />

      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="bg-gradient-to-r from-purple-900/95 to-purple-700/95 text-white sticky top-0 z-10 backdrop-blur-sm border-b border-white/10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={APP_LOGO} alt="CAC 360" className="h-10 w-auto" />
                <div>
                  <h1 className="text-xl font-bold">CAC 360 — Platform Admin</h1>
                  <p className="text-sm text-purple-200">Painel de Administração</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold">{admin?.name || "Admin"}</p>
                  <div className="flex items-center gap-2 justify-end">
                    <p className="text-xs text-purple-200">{admin?.email || ""}</p>
                    <span
                      className={`text-[0.6rem] font-semibold px-1.5 py-0.5 rounded border ${roleClass}`}
                    >
                      {roleLabel}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-white border-white/30 hover:bg-white/10"
                  onClick={() => {
                    logout?.();
                    setLocation("/platform-admin/login");
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 space-y-8">
          {/* Tenant Stats Row */}
          <div>
            <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Visão Geral da Plataforma
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white/95 backdrop-blur-sm border-white/40 shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Tenants</p>
                      <p className="text-3xl font-bold">
                        {isLoadingTenants ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          tenantStats.total
                        )}
                      </p>
                    </div>
                    <Building2 className="h-10 w-10 text-purple-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/95 backdrop-blur-sm border-white/40 shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Ativos</p>
                      <p className="text-3xl font-bold text-green-600">
                        {isLoadingTenants ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          tenantStats.active
                        )}
                      </p>
                    </div>
                    <CheckCircle2 className="h-10 w-10 text-green-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/95 backdrop-blur-sm border-white/40 shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Em Trial</p>
                      <p className="text-3xl font-bold text-blue-600">
                        {isLoadingTenants ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          tenantStats.trial
                        )}
                      </p>
                    </div>
                    <Clock className="h-10 w-10 text-blue-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/95 backdrop-blur-sm border-white/40 shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Suspensos</p>
                      <p className="text-3xl font-bold text-yellow-600">
                        {isLoadingTenants ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          tenantStats.suspended
                        )}
                      </p>
                    </div>
                    <AlertCircle className="h-10 w-10 text-yellow-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Global Platform Metrics */}
          {globalStats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-white/10 backdrop-blur-sm border-white/10 shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/60">Usuários Totais</p>
                      <p className="text-2xl font-bold text-white">{globalStats.totalUsers}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-400 opacity-60" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur-sm border-white/10 shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/60">Banco de Dados</p>
                      <p className="text-2xl font-bold text-white">{globalStats.platformDbSizeMB} MB</p>
                    </div>
                    <Database className="h-8 w-8 text-indigo-400 opacity-60" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur-sm border-white/10 shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/60">Armazenamento</p>
                      <p className="text-2xl font-bold text-white">{globalStats.globalStorageGB} GB</p>
                    </div>
                    <HardDrive className="h-8 w-8 text-amber-400 opacity-60" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Financial Metrics (Placeholder) */}
          <div>
            <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5" />
              Métricas Financeiras
              <Badge variant="outline" className="text-[0.6rem] border-amber-500/40 text-amber-300 ml-2">
                Em breve
              </Badge>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white/5 backdrop-blur-sm border-white/10 border-dashed shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/40">MRR</p>
                      <p className="text-2xl font-bold text-white/30">R$ —</p>
                      <p className="text-xs text-white/20 mt-1">Receita Recorrente Mensal</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500/30" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/5 backdrop-blur-sm border-white/10 border-dashed shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/40">Receita Mensal</p>
                      <p className="text-2xl font-bold text-white/30">R$ —</p>
                      <p className="text-xs text-white/20 mt-1">Faturamento do mês</p>
                    </div>
                    <CreditCard className="h-8 w-8 text-blue-500/30" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/5 backdrop-blur-sm border-white/10 border-dashed shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/40">Churn Rate</p>
                      <p className="text-2xl font-bold text-white/30">— %</p>
                      <p className="text-xs text-white/20 mt-1">Taxa de cancelamento</p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-500/30" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/5 backdrop-blur-sm border-white/10 border-dashed shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/40">Ticket Médio</p>
                      <p className="text-2xl font-bold text-white/30">R$ —</p>
                      <p className="text-xs text-white/20 mt-1">Valor médio por tenant</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-amber-500/30" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Navigation Cards */}
          <div>
            <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">
              Gerenciamento
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => item.action ? item.action() : setLocation(item.path)}
                    className="group relative bg-white/95 backdrop-blur-sm rounded-xl border border-white/40 p-6 text-left transition-all duration-200 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between">
                      <div className={`${item.iconBg} rounded-lg p-3`}>
                        <Icon className={`h-6 w-6 ${item.iconColor}`} />
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
                    </div>
                    <div className="mt-4">
                      <h3 className="font-semibold text-gray-900 text-base">{item.label}</h3>
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <div
                      className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${item.color} rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl flex flex-col bg-background border-l-2 border-dashed border-white/20 overflow-y-auto">
          <SheetHeader className="border-b-2 border-dashed border-white/20 pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-card rounded-md p-2">
                <Cog className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <SheetTitle className="text-foreground text-lg font-bold uppercase">Configurações</SheetTitle>
                <SheetDescription>
                  Perfil e parâmetros da plataforma
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-6 flex-1">
            {/* Meu Perfil */}
            <div>
              <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Meu Perfil
              </h3>
              <Card className="border-2 border-dashed border-white/20 bg-card">
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Nome</p>
                      <p className="font-semibold text-foreground text-sm">{(admin as any)?.name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">E-mail</p>
                      <p className="font-semibold text-foreground text-sm">{(admin as any)?.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Role</p>
                      <span className={`text-[0.7rem] font-semibold px-2 py-1 rounded border ${roleClass}`}>
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t-2 border-dashed border-white/10">
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold uppercase" onClick={() => setEditProfileOpen(true)}>
                      Editar perfil
                    </Button>
                    <Button size="sm" variant="outline" className="border-2 border-dashed border-white/20" onClick={() => setChangePasswordOpen(true)}>
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                      Trocar senha
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Informações */}
            <div>
              <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
                <Settings className="h-3.5 w-3.5" />
                Informações
              </h3>
              <Card className="border-2 border-dashed border-white/20 bg-card">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 rounded-md p-2 shrink-0">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">Configuração de Emails (SMTP)</h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        As configurações SMTP são isoladas por tenant. Cada clube configura seu servidor
                        em <span className="text-foreground font-medium">Administração → Configurações</span>.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Configurações Globais (Em breve) */}
            <div>
              <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
                <Cog className="h-3.5 w-3.5" />
                Configurações Globais
                <span className="text-[0.6rem] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/40 uppercase font-semibold tracking-wide ml-1">
                  Em breve
                </span>
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { label: "Compliance", desc: "Prazos e regras globais", icon: "📋" },
                  { label: "Integrações", desc: "Sistemas externos e APIs", icon: "🔗" },
                  { label: "Backup", desc: "Política de backup e retenção", icon: "💾" },
                ].map((item) => (
                  <Card key={item.label} className="border-2 border-dashed border-white/10 bg-card/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <span className="text-xl opacity-30">{item.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground/60">{item.desc}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      <AdminForm
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        editTarget={admin}
      />
      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        target={admin}
      />
    </div>
  );
}
