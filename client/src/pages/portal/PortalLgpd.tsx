import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollText, Loader2, ExternalLink } from "lucide-react";
import { usePortalAuth } from "./usePortalAuth";

export default function PortalLgpd() {
  const [, navigate] = useLocation();
  const { client, lgpdAccepted, cadastroCompleto, loading } = usePortalAuth();
  const [scrolled, setScrolled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Se já aceitou o LGPD: ir direto ao dashboard se cadastro já está completo, senão para meus-dados
  useEffect(() => {
    if (!loading && lgpdAccepted) {
      navigate(cadastroCompleto ? "/portal" : "/portal/meus-dados");
    }
  }, [loading, lgpdAccepted, cadastroCompleto, navigate]);

  // Se não autenticado, redirecionar para login
  useEffect(() => {
    if (!loading && !client) navigate("/portal/login");
  }, [loading, client, navigate]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setScrolled(true);
    }
  }

  async function handleAccept() {
    if (!checked) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/portal/lgpd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ version: "1.0" }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json()).error || "Erro ao registrar consentimento."
        );
      // Após aceitar LGPD: se cadastro já concluído, ir ao dashboard; senão, preencher dados
      navigate(cadastroCompleto ? "/portal" : "/portal/meus-dados");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalLayout title="Termo de Consentimento — LGPD" loading={loading}>
      <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
        {/* Header do termo */}
        <div className="bg-purple-700 text-white px-6 py-4 flex items-center gap-3">
          <ScrollText className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium flex-1">
            Role até o final para habilitar o aceite
          </p>
          <a
            href="/api/portal/lgpd/documento"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs text-purple-200 hover:text-white border border-purple-400 hover:border-white rounded-md px-2.5 py-1 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Ver em PDF
          </a>
        </div>

        {/* Texto do termo — scrollável */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-80 overflow-y-auto p-6 text-sm text-gray-700 space-y-4 border-b"
        >
          <h3 className="font-bold text-base text-gray-900">
            Termo de Consentimento para Tratamento de Dados Pessoais — LGPD
          </h3>
          <p>
            <strong>
              Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais
            </strong>
          </p>

          <p>
            Ao utilizar este portal, você concorda com o tratamento dos seus
            dados pessoais pela entidade responsável (doravante denominada
            "Clube" ou "Controlador"), nos termos descritos abaixo.
          </p>

          <h4 className="font-semibold text-gray-900">1. Dados Coletados</h4>
          <p>
            Nome completo, CPF, RG, data de nascimento, endereço residencial,
            telefone, email, profissão, e documentos relacionados ao processo de
            obtenção do Certificado de Registro (CR) junto ao Exército
            Brasileiro.
          </p>

          <h4 className="font-semibold text-gray-900">
            2. Finalidade do Tratamento
          </h4>
          <p>Os dados coletados serão utilizados exclusivamente para:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Gestão do processo de obtenção do CR CAC (Certificado de Registro
              para Caçadores, Atiradores e Colecionadores);
            </li>
            <li>Comunicação sobre o andamento do processo;</li>
            <li>
              Cumprimento de obrigações legais perante o Exército Brasileiro e
              demais órgãos;
            </li>
            <li>Emissão de documentos e certidões relacionadas ao processo.</li>
          </ul>

          <h4 className="font-semibold text-gray-900">3. Base Legal</h4>
          <p>
            O tratamento dos dados se fundamenta no art. 7º, incisos II
            (execução de contrato) e V (execução de políticas públicas), da Lei
            nº 13.709/2018 (LGPD).
          </p>

          <h4 className="font-semibold text-gray-900">
            4. Compartilhamento de Dados
          </h4>
          <p>Seus dados poderão ser compartilhados com:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Exército Brasileiro (para fins de registro e controle);</li>
            <li>Polícia Federal (verificação de antecedentes);</li>
            <li>
              Órgãos estaduais e federais competentes, conforme exigência legal.
            </li>
          </ul>
          <p>
            Não compartilhamos seus dados com terceiros para fins comerciais.
          </p>

          <h4 className="font-semibold text-gray-900">5. Prazo de Retenção</h4>
          <p>
            Seus dados serão mantidos pelo período necessário ao cumprimento das
            finalidades acima e das obrigações legais, podendo ser retidos por
            até 5 (cinco) anos após o encerramento do processo, conforme
            determinação legal.
          </p>

          <h4 className="font-semibold text-gray-900">
            6. Seus Direitos (Art. 18 da LGPD)
          </h4>
          <p>Você tem direito a:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Confirmar a existência de tratamento;</li>
            <li>Acessar seus dados;</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
            <li>
              Solicitar a anonimização, bloqueio ou eliminação de dados
              desnecessários;
            </li>
            <li>
              Revogar este consentimento a qualquer momento, mediante
              solicitação ao clube.
            </li>
          </ul>

          <h4 className="font-semibold text-gray-900">
            7. Contato do Controlador
          </h4>
          <p>
            Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento
            de dados, entre em contato diretamente com a secretaria do clube.
          </p>

          <p className="text-xs text-gray-500 mt-4 pt-4 border-t">
            Versão 1.0 — Vigente a partir de 2026.
          </p>
        </div>

        {/* Área de aceite */}
        <div className="p-6 space-y-4">
          {!scrolled && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ↕ Role o texto acima até o final para habilitar o aceite.
            </p>
          )}

          <div className="flex items-start gap-3">
            <Checkbox
              id="accept"
              checked={checked}
              onCheckedChange={val => setChecked(!!val)}
              disabled={!scrolled}
              className="mt-0.5"
            />
            <label
              htmlFor="accept"
              className={`text-sm leading-relaxed cursor-pointer ${
                !scrolled ? "text-gray-400" : "text-gray-700"
              }`}
            >
              Li e compreendi o Termo de Consentimento acima e concordo com o
              tratamento dos meus dados pessoais conforme descrito, nos termos
              da LGPD.
            </label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/portal/login")}
              disabled={submitting}
            >
              Recusar
            </Button>
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              disabled={!scrolled || !checked || submitting}
              onClick={handleAccept}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  Registrando...
                </>
              ) : (
                "Aceitar e Continuar →"
              )}
            </Button>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
