import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface EmailTriggersPanelProps {
  tenantId: number;
}

export function EmailTriggersPanel({ tenantId }: EmailTriggersPanelProps) {
  const { data: triggers = [], isLoading } = trpc.tenants.getEmailTriggers.useQuery({ tenantId });
  
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
        <h4 className="font-medium">Automações de Email</h4>
        <Badge variant="outline">{triggers.length} triggers</Badge>
      </div>
      
      {triggers.length > 0 ? (
        <div className="space-y-2">
          {triggers.map((trigger) => (
            <Card key={trigger.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{trigger.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Evento: {trigger.triggerEvent}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {trigger.isActive ? (
                      <Badge className="bg-green-500">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma automação configurada
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        💡 Para editar automações, acesse a área admin do tenant em /admin/email-triggers
      </p>
    </div>
  );
}
