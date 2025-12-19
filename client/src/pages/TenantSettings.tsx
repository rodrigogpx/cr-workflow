import { useState, useEffect } from "react";
import { TenantAdminLayout } from "@/components/TenantAdminLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function TenantSettings() {
  const { data: smtpConfig, isLoading: isLoadingSmtp } = trpc.emails.getSmtpConfig.useQuery();
  const utils = trpc.useUtils();

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [useSecure, setUseSecure] = useState(false);
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpPassDirty, setSmtpPassDirty] = useState(false);

  useEffect(() => {
    if (smtpConfig) {
      setSmtpHost(smtpConfig.smtpHost || "");
      setSmtpPort(String(smtpConfig.smtpPort || 587));
      setSmtpUser(smtpConfig.smtpUser || "");
      setSmtpFrom(smtpConfig.smtpFrom || "");
      setUseSecure(smtpConfig.useSecure || false);
      setSmtpPass("");
      setSmtpPassDirty(false);
    }
  }, [smtpConfig]);

  const updateSmtpConfigMutation = trpc.emails.updateSmtpConfig.useMutation({
    onSuccess: () => {
      toast.success("Configurações SMTP salvas com sucesso!");
      utils.emails.getSmtpConfig.invalidate();
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar configurações: ${error.message}`);
    },
  });

  const testSmtpConnectionMutation = trpc.emails.testSmtpConnection.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Email de teste enviado para ${data.sentTo}!`);
    },
    onError: (error: any) => {
      toast.error(`Falha ao enviar email de teste: ${error.message}`);
    },
  });

  const handleSaveSmtpConfig = () => {
    if (!smtpHost || !smtpPort || !smtpUser || !smtpFrom) {
      toast.error("Preencha todos os campos obrigatórios de SMTP.");
      return;
    }

    const portNumber = parseInt(smtpPort, 10);
    if (Number.isNaN(portNumber) || portNumber <= 0) {
      toast.error("Porta SMTP inválida.");
      return;
    }

    updateSmtpConfigMutation.mutate({
      smtpHost,
      smtpPort: portNumber,
      smtpUser,
      smtpFrom,
      useSecure,
      smtpPass: smtpPassDirty && smtpPass ? smtpPass : undefined,
    });
  };

  return (
    <TenantAdminLayout active="settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Configurações do seu clube
          </p>
        </div>

        {/* Configuração SMTP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Configuração de Envio de Emails (SMTP)
            </CardTitle>
            <CardDescription>
              Defina as credenciais de envio de email usadas para disparar os templates para seus clientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSmtp ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtpHost">Servidor SMTP *</Label>
                    <Input
                      id="smtpHost"
                      placeholder="smtp.gmail.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPort">Porta *</Label>
                    <Input
                      id="smtpPort"
                      placeholder="587"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpUser">Usuário *</Label>
                    <Input
                      id="smtpUser"
                      placeholder="seu-email@gmail.com"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPass">Senha *</Label>
                    <Input
                      id="smtpPass"
                      type="password"
                      placeholder={smtpConfig?.hasPassword ? '******** (deixe em branco para manter)' : 'Senha ou App Password'}
                      value={smtpPass}
                      onChange={(e) => {
                        setSmtpPass(e.target.value);
                        setSmtpPassDirty(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Gmail: use uma "Senha de App" em vez da senha normal
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtpFrom">Remetente (From) *</Label>
                    <Input
                      id="smtpFrom"
                      placeholder='"Meu Clube" <contato@meuclube.com>'
                      value={smtpFrom}
                      onChange={(e) => setSmtpFrom(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Formato: "Nome" &lt;email@dominio.com&gt;
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      id="useSecure"
                      type="checkbox"
                      checked={useSecure}
                      onChange={(e) => setUseSecure(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="useSecure" className="text-sm font-normal">
                      Usar conexão segura (SSL/TLS)
                    </Label>
                  </div>
                  <div className="flex flex-col gap-2 pt-4">
                    <Button
                      onClick={handleSaveSmtpConfig}
                      disabled={updateSmtpConfigMutation.isPending}
                    >
                      {updateSmtpConfigMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => testSmtpConnectionMutation.mutate({})}
                      disabled={testSmtpConnectionMutation.isPending || !smtpHost}
                    >
                      {testSmtpConnectionMutation.isPending ? 'Enviando email de teste...' : 'Enviar Email de Teste'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TenantAdminLayout>
  );
}
