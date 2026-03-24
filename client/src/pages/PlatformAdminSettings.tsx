import { useState } from "react";
import { useLocation } from "wouter";
import { PlatformAdminLayout } from "@/components/PlatformAdminLayout";
import { AdminForm } from "@/components/platform-admin/AdminForm";
import { ChangePasswordDialog } from "@/components/platform-admin/ChangePasswordDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Mail, Building2, UserCircle, KeyRound, ChevronRight, Cog } from "lucide-react";
import { usePlatformAuth } from "@/_core/hooks/usePlatformAuth";

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

export default function PlatformAdminSettings() {
  const { admin, role } = usePlatformAuth();
  const [, setLocation] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const roleLabel = role ? ROLE_LABELS[role] ?? role : "—";
  const roleClass = role ? ROLE_COLORS[role] ?? ROLE_COLORS['support'] : ROLE_COLORS['support'];

  return (
    <PlatformAdminLayout active="settings">
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-slate-500/10 rounded-lg p-2.5">
              <Cog className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Configurações da Plataforma</h1>
              <p className="text-sm text-white/50">
                Perfil, parâmetros globais e integrações da plataforma CAC 360
              </p>
            </div>
          </div>
        </div>

        {/* Meu Perfil */}
        <div>
          <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
            <UserCircle className="h-3.5 w-3.5" />
            Meu Perfil
          </h2>
          <Card className="bg-white/95 backdrop-blur-sm border-white/40 shadow-xl">
            <CardContent className="pt-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Nome</p>
                  <p className="font-semibold text-gray-900">{(admin as any)?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">E-mail</p>
                  <p className="font-semibold text-gray-900">{(admin as any)?.email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Role</p>
                  <span className={`text-[0.7rem] font-semibold px-2 py-1 rounded border ${roleClass}`}>
                    {roleLabel}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <Button size="sm" className="mt-3 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setEditOpen(true)}>
                  Editar perfil
                </Button>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setPasswordOpen(true)}>
                  <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                  Trocar senha
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Informações da Plataforma */}
        <div>
          <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
            <Settings className="h-3.5 w-3.5" />
            Informações
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* SMTP */}
            <Card className="bg-white/10 backdrop-blur-sm border-white/10 shadow-xl">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500/10 rounded-lg p-2.5 shrink-0">
                    <Mail className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">Configuração de Emails (SMTP)</h3>
                    <p className="text-xs text-white/50 mt-1 leading-relaxed">
                      As configurações SMTP são isoladas por tenant. Cada clube configura seu servidor
                      em <span className="text-white/70 font-medium">Administração → Configurações</span>.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tenants */}
            <button
              onClick={() => setLocation("/platform-admin/tenants")}
              className="group text-left"
            >
              <Card className="bg-white/10 backdrop-blur-sm border-white/10 shadow-xl hover:bg-white/15 transition-all h-full">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-purple-500/10 rounded-lg p-2.5 shrink-0">
                      <Building2 className="h-5 w-5 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white text-sm">Gestão de Tenants</h3>
                        <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-white/60 transition-colors" />
                      </div>
                      <p className="text-xs text-white/50 mt-1 leading-relaxed">
                        Gerencie clubes, planos, features e configurações de cada tenant.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          </div>
        </div>

        {/* Configurações Futuras */}
        <div>
          <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
            <Cog className="h-3.5 w-3.5" />
            Configurações Globais
            <Badge variant="outline" className="text-[0.6rem] border-amber-500/40 text-amber-300 ml-2">
              Em breve
            </Badge>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Compliance", desc: "Prazos e regras globais", icon: "📋" },
              { label: "Integrações", desc: "Sistemas externos e APIs", icon: "🔗" },
              { label: "Backup", desc: "Política de backup e retenção", icon: "💾" },
            ].map((item) => (
              <Card key={item.label} className="bg-white/5 backdrop-blur-sm border-white/10 border-dashed shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl opacity-30">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-white/30">{item.label}</p>
                      <p className="text-xs text-white/20">{item.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AdminForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editTarget={admin}
      />
      <ChangePasswordDialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        target={admin}
      />
    </PlatformAdminLayout>
  );
}
