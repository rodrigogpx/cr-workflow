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

      <Card className="w-full max-w-xs border border-primary/30 bg-card/95 backdrop-blur-sm shadow-xl relative z-10">
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
