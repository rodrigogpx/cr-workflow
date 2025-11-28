import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_LOGO, APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { zodResolver } from "@hookform/resolvers/zod";
import { Target, Loader2, ArrowLeft, UserPlus } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { toast } from "sonner";

const registerSchema = z.object({
  name: z.string().min(2, { message: "Nome deve ter pelo menos 2 caracteres" }),
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const registerMutation = trpc.auth.register.useMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    if (user && !loading) {
      if (user.role) {
        setLocation("/dashboard");
      } else {
        setLocation("/pending-approval");
      }
    }
  }, [user, loading, setLocation]);

  const onSubmit = async (data: RegisterFormValues) => {
    registerMutation.mutate({
      name: data.name,
      email: data.email,
      password: data.password,
    }, {
      onSuccess: (result) => {
        toast.success(result.message);
        setLocation("/login");
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(196,30,58,0.1),transparent_50%)]"></div>
      <div className="absolute inset-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        backgroundSize: '100% 4px'
      }}></div>

      <Card className="w-full max-w-md border-2 border-dashed border-white/20 bg-card/95 backdrop-blur-sm shadow-2xl relative z-10">
        <CardHeader className="space-y-4 text-center pb-6">
          <div className="flex justify-center">
            <div className="relative">
              <img 
                src={APP_LOGO}
                alt="CAC 360 – Gestão de Ciclo Completo" 
                className="h-16 w-auto"
              />
              <div className="absolute -inset-2 border-2 border-dashed border-primary/30 rounded-lg -z-10"></div>
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold uppercase tracking-tight text-white">
              Criar Conta
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {APP_TITLE || "CAC 360 – Gestão de Ciclo Completo"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input id="name" type="text" placeholder="Seu nome completo" {...register("name")} />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" {...register("email")} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="Mínimo 6 caracteres" {...register("password")} />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input id="confirmPassword" type="password" placeholder="Repita a senha" {...register("confirmPassword")} />
              {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
            </div>
            {errors.root && <p className="text-sm text-red-500 text-center">{errors.root.message}</p>}
            <Button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full h-12 bg-primary hover:bg-primary/90 border-2 border-dashed border-white/40 font-bold uppercase tracking-wide text-base transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5"
            >
              {registerMutation.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-5 h-5 mr-2" />
              )}
              Criar Conta
            </Button>
          </form>

          <div className="pt-4 border-t-2 border-dashed border-white/10">
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Já tem uma conta?
              </p>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full border-2 border-dashed border-white/20 bg-transparent hover:bg-white/5 font-bold uppercase tracking-wide"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar para Login
                </Button>
              </Link>
            </div>
          </div>

          <div className="text-center pt-4 border-t-2 border-dashed border-white/10">
            <p className="text-xs text-muted-foreground">
              Após o cadastro, um administrador irá aprovar seu acesso.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
