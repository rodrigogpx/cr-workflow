import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { APP_LOGO } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function PlatformAdminBootstrap() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [done, setDone] = useState(false);

  const bootstrapMutation = trpc.auth.bootstrapSuperAdmin.useMutation({
    onSuccess: () => {
      setDone(true);
      setTimeout(() => setLocation("/platform-admin/admins"), 2000);
    },
    onError: (err: any) => {
      if (err?.data?.code === "FORBIDDEN") {
        toast.error("Bootstrap não permitido: já existem administradores cadastrados.");
        setTimeout(() => setLocation("/platform-admin/login"), 1500);
      } else {
        toast.error(err?.message ?? "Erro ao criar superadmin.");
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    bootstrapMutation.mutate({ name: form.name, email: form.email, password: form.password });
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-500" />
          <h2 className="text-xl font-bold">Superadmin criado com sucesso!</h2>
          <p className="text-sm text-muted-foreground">Redirecionando para o painel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-black rounded-xl p-3 shadow-xl">
            <img src={APP_LOGO} alt="CAC 360" className="h-10 w-auto" />
          </div>
        </div>

        <Card className="shadow-xl border-white/10">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Shield className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle className="text-2xl">Configuração Inicial</CardTitle>
            <CardDescription>
              Crie o primeiro superadministrador da plataforma. Este processo só pode ser realizado uma vez.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  placeholder="Ex: João Silva"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  minLength={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@empresa.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Senha (mín. 8 caracteres)</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={bootstrapMutation.isPending}
              >
                {bootstrapMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando…
                  </>
                ) : (
                  "Criar Superadmin"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
