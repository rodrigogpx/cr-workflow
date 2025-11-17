import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE, getLoginUrl } from "@/const";
import { Target } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      setLocation("/dashboard");
    }
  }, [user, loading, setLocation]);

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(196,30,58,0.1),transparent_50%)]"></div>
      <div className="absolute inset-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        backgroundSize: '100% 4px'
      }}></div>

      <Card className="w-full max-w-md border-2 border-dashed border-white/20 bg-card/95 backdrop-blur-sm shadow-2xl relative z-10">
        <CardHeader className="space-y-6 text-center pb-8">
          <div className="flex justify-center">
            <div className="relative">
              <img 
                src="/logo.webp" 
                alt="Firing Range" 
                className="h-20 w-auto"
              />
              <div className="absolute -inset-2 border-2 border-dashed border-primary/30 rounded-lg -z-10"></div>
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold uppercase tracking-tight text-white">
              {APP_TITLE || "FIRING RANGE"}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Sistema de Gerenciamento de Workflow CR
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="p-4 border-2 border-dashed border-white/10 rounded-lg bg-background/50">
              <p className="text-sm text-center text-muted-foreground">
                Faça login com sua conta Manus para acessar o sistema
              </p>
            </div>
            <Button
              onClick={handleLogin}
              className="w-full h-12 bg-primary hover:bg-primary/90 border-2 border-dashed border-white/40 font-bold uppercase tracking-wide text-base transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5"
            >
              <Target className="w-5 h-5 mr-2" />
              Entrar no Sistema
            </Button>
          </div>

          <div className="pt-6 border-t-2 border-dashed border-white/10">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="w-12 h-12 mx-auto border-2 border-dashed border-primary/40 rounded-lg flex items-center justify-center bg-primary/10">
                  <span className="text-lg font-bold text-primary">1</span>
                </div>
                <p className="text-xs text-muted-foreground uppercase">Cadastro</p>
              </div>
              <div className="space-y-1">
                <div className="w-12 h-12 mx-auto border-2 border-dashed border-primary/40 rounded-lg flex items-center justify-center bg-primary/10">
                  <span className="text-lg font-bold text-primary">2</span>
                </div>
                <p className="text-xs text-muted-foreground uppercase">Documentos</p>
              </div>
              <div className="space-y-1">
                <div className="w-12 h-12 mx-auto border-2 border-dashed border-primary/40 rounded-lg flex items-center justify-center bg-primary/10">
                  <span className="text-lg font-bold text-primary">3</span>
                </div>
                <p className="text-xs text-muted-foreground uppercase">Aprovação</p>
              </div>
            </div>
          </div>

          <div className="text-center pt-4 border-t-2 border-dashed border-white/10">
            <p className="text-xs text-muted-foreground">
              Acesso restrito à equipe Firing Range
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              © {new Date().getFullYear()} Firing Range. Todos os direitos reservados.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
