import { PlatformAdminLayout } from "@/components/PlatformAdminLayout";

export default function PlatformAdminSettings() {
  return (
    <PlatformAdminLayout active="settings">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Configurações da Plataforma</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Área reservada para parâmetros globais da plataforma CAC 360: compliance, prazos de vencimento, clubes e integrações futuras.
        </p>
        <div className="rounded-lg border border-dashed border-white/20 bg-background/60 p-4 text-sm text-muted-foreground">
          Esta seção ainda está em planejamento. Use os módulos de Usuários da Plataforma e Templates de Email enquanto consolidamos os requisitos de configuração global.
        </div>
      </div>
    </PlatformAdminLayout>
  );
}
