import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_LOGO, APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { zodResolver } from "@hookform/resolvers/zod";
import { Target, Loader2, UserPlus, Sparkles, ShieldCheck, LineChart } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";

const loginSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(1, { message: "Senha é obrigatória" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const tenantSlug = useTenantSlug();
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
      setLocation(buildTenantPath(tenantSlug, "/dashboard"));
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
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url("/background-01.webp")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-background/10 backdrop-blur-[2px] z-0"></div>

      <div className="relative z-10 w-full max-w-6xl grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-center">
        {/* Peça publicitária */}
        <section className="rounded-3xl border border-white/15 bg-black/70 text-white p-8 sm:p-10 shadow-2xl space-y-8">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-emerald-300">
              <Sparkles className="h-4 w-4" />
              Plataforma CAC 360
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
              Automatize todo o ciclo CAC em um único painel inteligente.
            </h1>
            <p className="text-base text-white/80 max-w-2xl">
              Do onboarding ao deferimento, o CAC 360 integra workflow, auditoria, disparo de e-mails e gestão documental
              em um ambiente multi-tenant pensado para clubes de tiro que precisam de escala com segurança.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
              <p className="text-sm text-white/70 mt-3">Auditoria completa de cada ação e isolamento por tenant.</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
              <LineChart className="h-6 w-6 text-sky-300" />
              <p className="text-sm text-white/70 mt-3">Workflow em 6 etapas com insights de progresso em tempo real.</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
              <Target className="h-6 w-6 text-rose-300" />
              <p className="text-sm text-white/70 mt-3">Triggers inteligentes de e-mail e controle de documentos enxuto.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Button
              asChild
              className="h-12 px-6 text-sm font-semibold uppercase tracking-wide bg-emerald-500 hover:bg-emerald-400 text-black"
            >
              <a href="https://acrdigital.com.br" target="_blank" rel="noreferrer">
                Agendar demonstração
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 px-6 text-sm font-semibold uppercase tracking-wide border-white/40 text-white hover:text-black hover:bg-white"
            >
              <a href="https://github.com/rodrigogpx/cr-workflow" target="_blank" rel="noreferrer">
                Baixar brochure
              </a>
            </Button>
          </div>
        </section>

        {/* Card de login */}
        <Card className="w-full max-w-md border border-primary/30 bg-card/95 backdrop-blur-sm shadow-xl">
        <CardHeader className="space-y-4 text-center pb-4">
          <div className="flex justify-center">
            <div className="relative">
              <img 
                src={APP_LOGO}
                alt=""
                className="h-28 w-auto"
              />
            </div>
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
