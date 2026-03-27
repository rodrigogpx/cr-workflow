import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Mail, CreditCard, Loader2 } from "lucide-react";

export default function PortalAcesso() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Pegar token da URL
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("t") || "";

  useEffect(() => {
    if (!token) {
      setError("Link de convite inválido. Verifique se copiou o link completo do email.");
    }
  }, [token]);

  function formatCpf(value: string) {
    const nums = value.replace(/\D/g, "").slice(0, 11);
    return nums
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/portal/ativar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          email: email.trim(),
          cpf: cpf.replace(/\D/g, ""),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao verificar identidade.");
        return;
      }

      // Sucesso — redirecionar para LGPD
      navigate("/portal/lgpd");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalLayout title="Ativar Acesso ao Portal">
      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-8">
        {/* Ícone e intro */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-purple-600" />
          </div>
          <p className="text-gray-600 text-center max-w-sm">
            Para ativar seu acesso, confirme seus dados cadastrais. Eles devem ser os mesmos
            informados ao clube.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2 text-gray-700">
              <Mail className="h-4 w-4" /> Email cadastrado
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!token || loading}
              className="border-gray-200 focus:border-purple-400 focus:ring-purple-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf" className="flex items-center gap-2 text-gray-700">
              <CreditCard className="h-4 w-4" /> CPF
            </Label>
            <Input
              id="cpf"
              type="text"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              required
              disabled={!token || loading}
              maxLength={14}
              className="border-gray-200 focus:border-purple-400 focus:ring-purple-300"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold"
            disabled={!token || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...
              </>
            ) : (
              "Verificar Identidade e Acessar"
            )}
          </Button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Já ativou seu acesso?{" "}
          <button
            className="text-purple-600 hover:underline"
            onClick={() => navigate("/portal/login")}
          >
            Entrar com email e CPF
          </button>
        </p>
      </div>
    </PortalLayout>
  );
}
