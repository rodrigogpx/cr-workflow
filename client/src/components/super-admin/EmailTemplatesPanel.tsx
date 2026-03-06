import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";

interface EmailTemplatesPanelProps {
  tenantId: number;
}

export function EmailTemplatesPanel({ tenantId }: EmailTemplatesPanelProps) {
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } = trpc.tenants.getEmailTemplates.useQuery({ tenantId });
  
  const seedMutation = trpc.tenants.seedEmailTemplates.useMutation({
    onSuccess: (result) => {
      if (result.skipped) {
        toast.info('Templates já existem para este tenant');
      } else {
        toast.success(`Seed concluído: ${result.templates} templates e ${result.triggers} triggers criados`);
      }
      utils.tenants.getEmailTemplates.invalidate({ tenantId });
      utils.tenants.getEmailTriggers.invalidate({ tenantId });
    },
    onError: (error) => {
      toast.error(`Erro ao executar seed: ${error.message}`);
    },
  });
  
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Templates de Email</h4>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{templates.length} templates</Badge>
          {templates.length === 0 && (
            <Button
              size="sm"
              variant="default"
              onClick={() => seedMutation.mutate({ tenantId })}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Carregar Templates Padrão
            </Button>
          )}
        </div>
      </div>
      
      {templates.length > 0 ? (
        <div className="space-y-2">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{template.templateTitle || template.templateKey}</p>
                    <p className="text-sm text-muted-foreground">{template.subject}</p>
                  </div>
                  <Badge variant="secondary">{template.module}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhum template configurado</p>
          <p className="text-xs mt-2">Clique em "Carregar Templates Padrão" para inicializar os templates do workflow</p>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        💡 Para editar templates, acesse a área admin do tenant em /admin/emails
      </p>
    </div>
  );
}
