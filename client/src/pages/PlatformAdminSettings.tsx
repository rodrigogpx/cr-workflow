import { PlatformAdminLayout } from "@/components/PlatformAdminLayout";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Mail, Building2 } from "lucide-react";

export default function PlatformAdminSettings() {
  return (
    <PlatformAdminLayout active="settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações da Plataforma</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Área reservada para parâmetros globais da plataforma CAC 360: compliance, prazos de vencimento e integrações futuras.
          </p>
        </div>

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
              Para gerenciar tenants (clubes), acesse a área de Super Admin em <strong>/super-admin/tenants</strong>.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </PlatformAdminLayout>
  );
}
