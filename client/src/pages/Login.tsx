import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_LOGO, APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { zodResolver } from "@hookform/resolvers/zod";
import { Target, Loader2, UserPlus } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(1, { message: "Senha é obrigatória" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loading, refresh } = useAuth();
  const loginMutation = trpc.auth.login.useMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (user && !loading) {
      setLocation("/dashboard");
    }
  }, [user, loading, setLocation]);

  const onSubmit = async (data: LoginFormValues) => {
    loginMutation.mutate(data, {
      onSuccess: async () => {
        await refresh(); // Recarrega os dados do usuário
        // O redirecionamento será feito pelo useEffect que observa a mudança no 'user'
      },
      onError: (error) => {
        setError("root", { message: error.message });
      },
    });
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(18,58,99,0.15),transparent_50%)]"></div>
      <div className="absolute inset-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        backgroundSize: '100% 4px'
      }}></div>

      <Card className="w-full max-w-xs border border-primary/30 bg-card/95 backdrop-blur-sm shadow-xl relative z-10">
        <CardHeader className="space-y-4 text-center pb-4">
          <div className="flex justify-center">
            <div className="relative bg-white rounded-lg p-2">
              <img 
                src={APP_LOGO}
                alt="CAC 360 – Gestão de Ciclo Completo" 
                className="h-28 w-auto"
              />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-xl font-bold uppercase tracking-tight text-primary">
              {APP_TITLE || "CAC 360 – Gestão de Ciclo Completo"}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              CAC 360 – Gestão de Ciclo Completo
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" {...register("email")} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>
            {errors.root && <p className="text-sm text-red-500 text-center">{errors.root.message}</p>}
            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-10 bg-primary hover:bg-primary/90 font-semibold uppercase tracking-wide text-sm transition-all duration-300 hover:shadow-md hover:shadow-primary/20"
            >
              {loginMutation.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Target className="w-5 h-5 mr-2" />
              )}
              Entrar no Sistema
            </Button>
          </form>

          <div className="pt-4 border-t border-border">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="w-10 h-10 mx-auto border border-secondary/50 rounded-lg flex items-center justify-center bg-secondary/10">
                  <span className="text-sm font-bold text-secondary">1</span>
                </div>
                <p className="text-xs text-muted-foreground uppercase">Cadastro</p>
              </div>
              <div className="space-y-1">
                <div className="w-10 h-10 mx-auto border border-secondary/50 rounded-lg flex items-center justify-center bg-secondary/10">
                  <span className="text-sm font-bold text-secondary">2</span>
                </div>
                <p className="text-xs text-muted-foreground uppercase">Documentos</p>
              </div>
              <div className="space-y-1">
                <div className="w-10 h-10 mx-auto border border-secondary/50 rounded-lg flex items-center justify-center bg-secondary/10">
                  <span className="text-sm font-bold text-secondary">3</span>
                </div>
                <p className="text-xs text-muted-foreground uppercase">Aprovação</p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Não tem uma conta?
              </p>
              <Link href="/register">
                <Button
                  variant="outline"
                  className="w-full border-secondary/40 bg-transparent hover:bg-secondary/10 font-semibold uppercase tracking-wide text-sm"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Criar Conta
                </Button>
              </Link>
            </div>
          </div>

          <div className="text-center pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Acesso restrito à equipe CAC 360
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              © {new Date().getFullYear()} CAC 360. Todos os direitos reservados.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
