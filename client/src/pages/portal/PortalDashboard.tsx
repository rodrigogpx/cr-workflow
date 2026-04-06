import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle2, LogOut, ChevronRight, GitBranch, FileText, MessageSquare } from "lucide-react";
import { usePortalAuth } from "./usePortalAuth";

type PortalMessage = {
  id: string;
  type: "document_rejection" | "sinarm_comment";
  title: string;
  body: string;
  createdAt: string;
  meta?: {
    fileName?: string;
    sinarmStatus?: string;
    authorName?: string;
  };
};

export default function PortalDashboard() {
  const [, navigate] = useLocation();
  const { client, lgpdAccepted, cadastroCompleto, loading, logout } = usePortalAuth();
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    if (!loading && !client) navigate("/portal/login");
  }, [loading, client, navigate]);

  useEffect(() => {
    if (!loading && client && !lgpdAccepted) navigate("/portal/lgpd");
  }, [loading, client, lgpdAccepted, navigate]);

  useEffect(() => {
    if (!client) return;

    let cancelled = false;
    setMessagesLoading(true);

    fetch("/api/portal/mensagens", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        if (!cancelled) setMessages(Array.isArray(data?.messages) ? data.messages : []);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  function formatDateTime(value: string) {
    if (!value) return "";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleLogout() {
    await logout();
    navigate("/portal/login");
  }

  return (
    <PortalLayout loading={loading}>
      {client && (
        <div className="space-y-6">
          {/* Saudação + logout */}
          <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Olá, {client.name.split(" ")[0]}!
              </h2>
              <p className="text-sm text-gray-500 mt-1">{client.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-600"
            >
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>

          {/* Cards de ação — 4 cards em grid 2x2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Meus Dados */}
            <button
              onClick={() => navigate("/portal/meus-dados")}
              className="bg-white rounded-xl border border-purple-100 shadow-sm p-5 text-left hover:border-purple-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-purple-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-purple-500 transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-800 text-sm">Meus Dados</h3>
              <p className="text-xs text-gray-500 mt-0.5">{cadastroCompleto ? "Ver / editar dados" : "Complete seu cadastro"}</p>
            </button>

            {/* Meu Processo */}
            <button
              onClick={() => navigate("/portal/meu-processo")}
              className="bg-white rounded-xl border border-indigo-100 shadow-sm p-5 text-left hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <GitBranch className="h-5 w-5 text-indigo-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-800 text-sm">Meu Processo</h3>
              <p className="text-xs text-gray-500 mt-0.5">Acompanhe as etapas do seu CR</p>
            </button>

            {/* Documentos */}
            <button
              onClick={() => navigate("/portal/documentos")}
              className="bg-white rounded-xl border border-pink-100 shadow-sm p-5 text-left hover:border-pink-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-pink-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-pink-500 transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-800 text-sm">Documentos</h3>
              <p className="text-xs text-gray-500 mt-0.5">Status da juntada de documentos</p>
            </button>

            {/* Mensagens */}
            <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                  {messages.length} {messages.length === 1 ? "mensagem" : "mensagens"}
                </span>
              </div>
              <h3 className="font-semibold text-gray-800 text-sm">Mensagens</h3>
              <p className="text-xs text-gray-500 mt-0.5">Rejeições de documentos e atualizações SINARM-CAC</p>

              <div className="mt-3 space-y-2.5">
                {messagesLoading && (
                  <p className="text-xs text-gray-500">Carregando mensagens...</p>
                )}

                {!messagesLoading && messages.length === 0 && (
                  <p className="text-xs text-gray-500">Sem mensagens no momento.</p>
                )}

                {!messagesLoading && messages.slice(0, 2).map((msg) => (
                  <div key={msg.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          msg.type === "document_rejection"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {msg.type === "document_rejection" ? "Documento rejeitado" : "SINARM-CAC"}
                      </span>
                      <span className="text-[11px] text-gray-400">{formatDateTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-xs font-medium text-gray-700 mt-1">{msg.title}</p>
                    {msg.meta?.fileName && (
                      <p className="text-[11px] text-gray-500 mt-0.5">Arquivo: {msg.meta.fileName}</p>
                    )}
                    {msg.meta?.sinarmStatus && (
                      <p className="text-[11px] text-gray-500 mt-0.5">Status: {msg.meta.sinarmStatus}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{msg.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status LGPD */}
          {lgpdAccepted && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Termo LGPD aceito — seus dados estão protegidos
            </div>
          )}

          {/* Dica — exibida apenas quando o cadastro ainda não foi concluído */}
          {!cadastroCompleto && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-purple-800">
              <strong>Próximo passo:</strong> Complete seus dados cadastrais clicando em "Meus
              Dados". Quanto mais completo seu cadastro, mais rápido seu processo avança!
            </div>
          )}
        </div>
      )}
    </PortalLayout>
  );
}
