import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface EmailTemplatesPanelProps {
  tenantId: number;
}

export function EmailTemplatesPanel({ tenantId }: EmailTemplatesPanelProps) {
  const { data: templates = [], isLoading } = trpc.tenants.getEmailTemplates.useQuery({ tenantId });
  
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
        <Badge variant="outline">{templates.length} templates</Badge>
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
          Nenhum template configurado
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        💡 Para editar templates, acesse a área admin do tenant em /admin/emails
      </p>
    </div>
  );
}
