import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

interface EmailConfigPanelProps {
  tenantId: number;
}

export function EmailConfigPanel({ tenantId }: EmailConfigPanelProps) {
  const { data: config, isLoading } = trpc.tenants.getEmailConfig.useQuery({ tenantId });
  const utils = trpc.useContext();
  
  const updateConfig = trpc.tenants.updateEmailConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuração atualizada");
      utils.tenants.getEmailConfig.invalidate({ tenantId });
    },
    onError: (err) => toast.error(err.message),
  });
  
  const testConfig = trpc.tenants.testEmailConfig.useMutation({
    onSuccess: () => toast.success("Email de teste enviado!"),
    onError: (err) => toast.error(err.message),
  });
  
  const [emailMethod, setEmailMethod] = useState<"smtp" | "gateway">("gateway");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [postmanGpxBaseUrl, setPostmanGpxBaseUrl] = useState("");
  const [postmanGpxApiKey, setPostmanGpxApiKey] = useState("");
  const [testEmail, setTestEmail] = useState("");
  
  useEffect(() => {
    if (config) {
      setEmailMethod(config.emailMethod);
      setSmtpHost(config.smtpHost);
      setSmtpPort(config.smtpPort);
      setSmtpUser(config.smtpUser);
      setSmtpFrom(config.smtpFrom);
      setPostmanGpxBaseUrl(config.postmanGpxBaseUrl);
    }
  }, [config]);
  
  const handleSave = () => {
    updateConfig.mutate({
      tenantId,
      emailMethod,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword: smtpPassword || undefined,
      smtpFrom,
      postmanGpxBaseUrl,
      postmanGpxApiKey: postmanGpxApiKey || undefined,
    });
  };
  
  const handleTest = () => {
    if (!testEmail) {
      toast.error("Informe um email para teste");
      return;
    }
    testConfig.mutate({ tenantId, testEmail });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Seletor de Método */}
      <div className="space-y-2">
        <Label>Método de Envio</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="smtp"
              checked={emailMethod === "smtp"}
              onChange={(e) => setEmailMethod(e.target.value as "smtp")}
              className="w-4 h-4"
            />
            <span>SMTP Direto</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="gateway"
              checked={emailMethod === "gateway"}
              onChange={(e) => setEmailMethod(e.target.value as "gateway")}
              className="w-4 h-4"
            />
            <span>Gateway HTTP (PostmanGPX)</span>
          </label>
        </div>
      </div>
      
      {/* Configurações SMTP */}
      {emailMethod === "smtp" && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h4 className="font-medium">Configurações SMTP</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Host SMTP</Label>
                <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Porta</Label>
                <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input 
                  type="password" 
                  value={smtpPassword} 
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder={config?.hasSmtpPassword ? "••••••••" : ""}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Email Remetente (From)</Label>
                <Input value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Configurações Gateway */}
      {emailMethod === "gateway" && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h4 className="font-medium">Configurações Gateway</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL Base PostmanGPX</Label>
                <Input value={postmanGpxBaseUrl} onChange={(e) => setPostmanGpxBaseUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input 
                  type="password" 
                  value={postmanGpxApiKey} 
                  onChange={(e) => setPostmanGpxApiKey(e.target.value)}
                  placeholder={config?.hasPostmanGpxApiKey ? "••••••••" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Email Remetente (From)</Label>
                <Input value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Teste de Configuração */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Testar Configuração
          </h4>
          <div className="flex gap-2">
            <Input 
              type="email" 
              placeholder="seu@email.com" 
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <Button 
              variant="outline" 
              onClick={handleTest}
              disabled={testConfig.isPending}
            >
              {testConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Teste"}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Ações */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
