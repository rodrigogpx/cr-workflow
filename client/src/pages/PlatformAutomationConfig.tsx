import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Clock,
  Mail,
  Play,
  Save,
  Loader2,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Database,
} from "lucide-react";
import { toast } from "sonner";

// Chaves de configuração gerenciadas aqui
const CRON_KEYS = [
  "cron.alert.days.warning1",
  "cron.alert.days.warning2",
  "cron.alert.days.warning3",
  "cron.suspension.grace",
  "cron.daily.hour",
  "cron.suspension.hour",
];
const EMAIL_KEYS = [
  "email.platform.fromName",
  "email.platform.fromAddress",
  "email.platform.replyTo",
  "email.platform.smtpHost",
  "email.platform.smtpPort",
  "email.platform.smtpUser",
  "email.platform.smtpPass",
];

const DEFAULTS: Record<string, string> = {
  "cron.alert.days.warning1": "7",
  "cron.alert.days.warning2": "15",
  "cron.alert.days.warning3": "30",
  "cron.suspension.grace": "3",
  "cron.daily.hour": "9",
  "cron.suspension.hour": "10",
  "email.platform.fromName": "CAC 360",
  "email.platform.fromAddress": "",
  "email.platform.replyTo": "",
  "email.platform.smtpHost": "",
  "email.platform.smtpPort": "587",
  "email.platform.smtpUser": "",
  "email.platform.smtpPass": "",
};

export default function PlatformAutomationConfig() {
  const {
    data: allSettings,
    isLoading,
    refetch,
  } = (trpc as any).platform.settings.getAll.useQuery();
  const bulkSetMut = (trpc as any).platform.settings.bulkSet.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas");
      refetch();
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
  const runCronMut = (trpc as any).platform.runCron.useMutation({
    onSuccess: (r: any) => toast.success(r.message ?? "Job executado"),
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const [cronForm, setCronForm] = useState<Record<string, string>>({});
  const [emailForm, setEmailForm] = useState<Record<string, string>>({});
  const [runningJob, setRunningJob] = useState<string | null>(null);

  useEffect(() => {
    if (allSettings) {
      const init = (keys: string[]) =>
        Object.fromEntries(
          keys.map(k => [k, allSettings[k] ?? DEFAULTS[k] ?? ""])
        );
      setCronForm(init(CRON_KEYS));
      setEmailForm(init(EMAIL_KEYS));
    }
  }, [allSettings]);

  const saveCron = () => bulkSetMut.mutate(cronForm);
  const saveEmail = () => bulkSetMut.mutate(emailForm);

  const runJob = async (job: "daily" | "suspension") => {
    setRunningJob(job);
    runCronMut.mutate({ job }, { onSettled: () => setRunningJob(null) });
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
      </div>
    );

  return (
    <div className="space-y-8">
      {/* ── AUTOMAÇÃO / CRON JOBS ── */}
      <div>
        <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
          <Settings2 className="h-3.5 w-3.5" />
          Automação — Cron Jobs
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Alertas de vencimento */}
          <Card className="bg-white/95 shadow-xl border-white/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                Alertas de Vencimento de Assinatura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">
                Quantos dias antes do vencimento enviar alertas por email ao
                admin do tenant.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    "cron.alert.days.warning1",
                    "cron.alert.days.warning2",
                    "cron.alert.days.warning3",
                  ] as const
                ).map((k, i) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs text-gray-600">
                      {i === 0
                        ? "1º Alerta (dias)"
                        : i === 1
                          ? "2º Alerta (dias)"
                          : "3º Alerta (dias)"}
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="90"
                      value={cronForm[k] ?? ""}
                      onChange={e =>
                        setCronForm(f => ({ ...f, [k]: e.target.value }))
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">
                    Graça após vencimento (dias)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    value={cronForm["cron.suspension.grace"] ?? ""}
                    onChange={e =>
                      setCronForm(f => ({
                        ...f,
                        "cron.suspension.grace": e.target.value,
                      }))
                    }
                    className="h-8 text-sm"
                  />
                  <p className="text-[0.6rem] text-gray-400">
                    Dias após vencimento antes de suspender.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">
                    Hora do job diário (UTC)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={cronForm["cron.daily.hour"] ?? ""}
                    onChange={e =>
                      setCronForm(f => ({
                        ...f,
                        "cron.daily.hour": e.target.value,
                      }))
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-amber-700 border-amber-300 hover:bg-amber-50 h-7 text-xs"
                  onClick={() => runJob("daily")}
                  disabled={runningJob === "daily"}
                >
                  {runningJob === "daily" ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Play className="h-3 w-3 mr-1" />
                  )}
                  Executar agora
                </Button>
                <Button
                  size="sm"
                  className="bg-[#123A63] hover:bg-[#0e2d4f] h-7 text-xs"
                  onClick={saveCron}
                  disabled={bulkSetMut.isPending}
                >
                  <Save className="h-3 w-3 mr-1" /> Salvar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Suspensão de inadimplentes */}
          <Card className="bg-white/95 shadow-xl border-white/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Suspensão Automática de Inadimplentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">
                Tenants com assinatura expirada são suspensos automaticamente
                após o período de graça. O job verifica diariamente.
              </p>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">
                  Hora do job de suspensão (UTC)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={cronForm["cron.suspension.hour"] ?? ""}
                  onChange={e =>
                    setCronForm(f => ({
                      ...f,
                      "cron.suspension.hour": e.target.value,
                    }))
                  }
                  className="h-8 text-sm w-32"
                />
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Ação irreversível no
                  acesso
                </p>
                <p>
                  Ao executar agora, todos os tenants com assinatura expirada há
                  mais de {cronForm["cron.suspension.grace"] ?? "3"} dias serão
                  suspensos imediatamente.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-700 border-red-300 hover:bg-red-50 h-7 text-xs"
                  onClick={() => {
                    if (
                      confirm(
                        "Confirma execução do job de suspensão agora? Tenants inadimplentes serão suspensos imediatamente."
                      )
                    ) {
                      runJob("suspension");
                    }
                  }}
                  disabled={runningJob === "suspension"}
                >
                  {runningJob === "suspension" ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Play className="h-3 w-3 mr-1" />
                  )}
                  Executar agora
                </Button>
                <Button
                  size="sm"
                  className="bg-[#123A63] hover:bg-[#0e2d4f] h-7 text-xs"
                  onClick={saveCron}
                  disabled={bulkSetMut.isPending}
                >
                  <Save className="h-3 w-3 mr-1" /> Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── EMAIL DA PLATAFORMA ── */}
      <div>
        <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
          <Mail className="h-3.5 w-3.5" />
          Email da Plataforma
          <Badge
            variant="outline"
            className="text-[0.6rem] border-blue-400/40 text-blue-300 ml-1"
          >
            SMTP global
          </Badge>
        </h2>

        <Card className="bg-white/95 shadow-xl border-white/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              SMTP da Plataforma
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Usado para emails automáticos da plataforma (alertas, faturas).
              Cada clube pode ter seu próprio SMTP em Configurações.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">
                  Nome do remetente
                </Label>
                <Input
                  value={emailForm["email.platform.fromName"] ?? ""}
                  onChange={e =>
                    setEmailForm(f => ({
                      ...f,
                      "email.platform.fromName": e.target.value,
                    }))
                  }
                  placeholder="CAC 360"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Email remetente</Label>
                <Input
                  type="email"
                  value={emailForm["email.platform.fromAddress"] ?? ""}
                  onChange={e =>
                    setEmailForm(f => ({
                      ...f,
                      "email.platform.fromAddress": e.target.value,
                    }))
                  }
                  placeholder="noreply@cac360.com.br"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600">
                Reply-to (opcional)
              </Label>
              <Input
                type="email"
                value={emailForm["email.platform.replyTo"] ?? ""}
                onChange={e =>
                  setEmailForm(f => ({
                    ...f,
                    "email.platform.replyTo": e.target.value,
                  }))
                }
                placeholder="suporte@cac360.com.br"
                className="h-8 text-sm"
              />
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-gray-400" /> Servidor SMTP
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Host</Label>
                  <Input
                    value={emailForm["email.platform.smtpHost"] ?? ""}
                    onChange={e =>
                      setEmailForm(f => ({
                        ...f,
                        "email.platform.smtpHost": e.target.value,
                      }))
                    }
                    placeholder="smtp.gmail.com"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Porta</Label>
                  <Input
                    type="number"
                    value={emailForm["email.platform.smtpPort"] ?? "587"}
                    onChange={e =>
                      setEmailForm(f => ({
                        ...f,
                        "email.platform.smtpPort": e.target.value,
                      }))
                    }
                    placeholder="587"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Usuário</Label>
                  <Input
                    value={emailForm["email.platform.smtpUser"] ?? ""}
                    onChange={e =>
                      setEmailForm(f => ({
                        ...f,
                        "email.platform.smtpUser": e.target.value,
                      }))
                    }
                    placeholder="usuario@dominio.com"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Senha</Label>
                  <Input
                    type="password"
                    value={emailForm["email.platform.smtpPass"] ?? ""}
                    onChange={e =>
                      setEmailForm(f => ({
                        ...f,
                        "email.platform.smtpPass": e.target.value,
                      }))
                    }
                    placeholder="••••••••"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button
                size="sm"
                className="bg-[#123A63] hover:bg-[#0e2d4f] h-8 text-xs"
                onClick={saveEmail}
                disabled={bulkSetMut.isPending}
              >
                {bulkSetMut.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Salvar Configurações de Email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── SEEDS DE AUTOMAÇÃO ── */}
      <div>
        <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Seeds de Dados
        </h2>

        <Card className="bg-white/95 shadow-xl border-white/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-600" />
              Templates e Dados Iniciais
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Re-execute os seeds de dados para restaurar templates padrão de
              email, workflows e configurações.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  key: "email-templates",
                  label: "Templates de Email",
                  desc: "Restaura os templates padrão de notificação por email para todos os tenants.",
                  icon: <Mail className="h-4 w-4 text-blue-500" />,
                  color: "text-blue-700 border-blue-200 hover:bg-blue-50",
                },
                {
                  key: "workflow-steps",
                  label: "Etapas de Workflow",
                  desc: "Recria as etapas padrão do workflow CR para clientes sem etapas configuradas.",
                  icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
                  color: "text-green-700 border-green-200 hover:bg-green-50",
                },
                {
                  key: "plan-definitions",
                  label: "Planos Padrão",
                  desc: "Recria os planos Starter, Professional e Enterprise com configurações padrão.",
                  icon: <Settings2 className="h-4 w-4 text-purple-500" />,
                  color: "text-purple-700 border-purple-200 hover:bg-purple-50",
                },
              ].map(item => (
                <div key={item.key} className="border rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <p className="text-sm font-semibold text-gray-800">
                      {item.label}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {item.desc}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-7 text-xs w-full ${item.color}`}
                    onClick={() =>
                      toast.info(
                        "Seeds executados via painel de tenants individualmente ou via CLI."
                      )
                    }
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Executar seed
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
