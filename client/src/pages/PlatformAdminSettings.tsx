import { useState } from "react";
import { PlatformAdminLayout } from "@/components/PlatformAdminLayout";
import { AdminForm } from "@/components/platform-admin/AdminForm";
import { ChangePasswordDialog } from "@/components/platform-admin/ChangePasswordDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Mail, Building2, UserCircle, KeyRound } from "lucide-react";
import { usePlatformAuth } from "@/_core/hooks/usePlatformAuth";

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  support: 'Suporte',
};

export default function PlatformAdminSettings() {
  const { admin, role } = usePlatformAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <PlatformAdminLayout active="settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações da Plataforma</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Parâmetros globais da plataforma CAC 360: seu perfil, configurações SMTP e integrações futuras.
          </p>
        </div>

        {/* Meu Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Meu Perfil
            </CardTitle>
            <CardDescription>Dados da sua conta de administrador da plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Nome</p>
                <p className="font-medium">{(admin as any)?.name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">E-mail</p>
                <p className="font-medium">{(admin as any)?.email || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Role</p>
                <Badge variant="outline" className="text-xs">
                  {role ? ROLE_LABELS[role] ?? role : "—"}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                Editar perfil
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPasswordOpen(true)}>
                <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                Trocar senha
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Aviso sobre SMTP por tenant */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Configuração de Emails (SMTP)
            </CardTitle>
            <CardDescription>
              As configurações de email SMTP são isoladas por tenant. Cada clube configura seu próprio servidor SMTP
              através da página <strong>Administração → Configurações</strong> dentro do seu ambiente.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Placeholder para futuras configurações */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Settings className="h-5 w-5" />
              Configurações Globais
            </CardTitle>
            <CardDescription>
              Em breve: prazos de compliance, integrações com sistemas externos, configurações de backup e mais.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-5 w-5" />
              Gestão de Tenants
            </CardTitle>
            <CardDescription>
              Para gerenciar tenants (clubes), acesse <strong>Platform Admin → Tenants</strong>.
            </CardDescription>
          </CardHeader>
        </Card>
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
