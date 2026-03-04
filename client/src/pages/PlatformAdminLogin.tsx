import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function PlatformAdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.platformLogin.useMutation({
    onSuccess: async (data) => {
      toast.success(`Bem-vindo, ${data.admin.name}!`);
      // Force reload to ensure TRPC context is completely refreshed with new cookie
      window.location.href = "/super-admin/tenants";
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao fazer login. Verifique suas credenciais.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl">
        <CardHeader className="space-y-3 pb-6">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-indigo-500/10 rounded-full border border-indigo-500/20">
              <ShieldAlert className="w-10 h-10 text-indigo-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Plataforma CAC 360
          </CardTitle>
          <CardDescription className="text-center text-zinc-400">
            Acesso restrito para Super Administradores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email Administrativo</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@cac360.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-500"
                disabled={loginMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 focus-visible:ring-indigo-500"
                disabled={loginMutation.isPending}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-11 mt-2"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                "Acessar Plataforma"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-zinc-800 pt-4 text-xs text-zinc-500">
          Esta área é monitorada e estritamente confidencial.
        </CardFooter>
      </Card>
    </div>
  );
}
