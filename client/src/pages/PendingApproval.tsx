import { APP_LOGO } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";

export default function PendingApproval() {
  const { user, loading } = useAuth();
  const tenantSlug = useTenantSlug();
  const loginPath = buildTenantPath(tenantSlug, "/login");
  const dashboardPath = buildTenantPath(tenantSlug, "/dashboard");
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: () => {
      toast.error("Erro ao fazer logout");
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground uppercase text-sm tracking-wide">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to={loginPath} />;
  }

  if (user.role) {
    return <Redirect to={dashboardPath} />;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url("/background-01.webp")',
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-[#0A0A0A]/85 backdrop-blur-[2px] z-0"></div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src={APP_LOGO} 
            alt="CAC 360 – Gestão de Ciclo Completo" 
            className="h-24 w-auto"
          />
        </div>

        {/* Card Principal */}
        <Card className="bg-[#1A1A1A] border-2 border-dashed border-white/30">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-10 h-10 text-yellow-500" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-white uppercase tracking-wide">
              Aguardando Aprovação
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <p className="text-white/80 text-lg leading-relaxed">
                Seu cadastro foi realizado com sucesso! No momento, você está aguardando a aprovação de um administrador para ter acesso ao sistema.
              </p>

              <div className="bg-[#C41E3A]/10 border border-[#C41E3A]/30 rounded-lg p-6 mt-6">
                <p className="text-white/90 font-medium mb-2">
                  O que acontece agora?
                </p>
                <ul className="text-white/70 text-left space-y-2 list-disc list-inside">
                  <li>Um administrador irá revisar seu cadastro</li>
                  <li>Você receberá um perfil de acesso (Operador ou Administrador)</li>
                  <li>Após a aprovação, você poderá acessar o sistema normalmente</li>
                </ul>
              </div>

              <p className="text-white/60 text-sm mt-6">
                Entre em contato com o administrador do sistema caso tenha dúvidas ou se a aprovação estiver demorando mais do que o esperado.
              </p>
            </div>

            {/* Botão de Logout */}
            <div className="flex flex-col gap-3 justify-center pt-4">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 transition-all duration-300 uppercase tracking-wider font-bold w-full max-w-xs mx-auto"
                disabled={logoutMutation.isPending}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {logoutMutation.isPending ? "Saindo..." : "Sair"}
              </Button>

              <Button
                onClick={() => {
                  console.log("Executando limpeza forçada...");
                  localStorage.clear();
                  sessionStorage.clear();
                  // Limpar cookies manualmente
                  document.cookie.split(";").forEach((c) => {
                    document.cookie = c
                      .replace(/^ +/, "")
                      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                  });
                  window.location.href = "/login";
                }}
                variant="ghost"
                className="text-xs text-white/30 hover:text-white/60 hover:bg-transparent uppercase tracking-widest"
              >
                Forçar Saída (Limpar Cache)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-white/40 text-sm">
          <p>CAC 360 – Gestão de Ciclo Completo</p>
          <p className="mt-1">DF-150, Km 08 - Sobradinho/DF</p>
        </div>
      </div>
    </div>
  );
}
