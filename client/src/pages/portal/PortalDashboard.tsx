import React, { useEffect } from "react";
import { useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle2, LogOut, ChevronRight, Clock } from "lucide-react";
import { usePortalAuth } from "./usePortalAuth";

export default function PortalDashboard() {
  const [, navigate] = useLocation();
  const { client, lgpdAccepted, loading, logout } = usePortalAuth();

  useEffect(() => {
    if (!loading && !client) navigate("/portal/login");
  }, [loading, client, navigate]);

  useEffect(() => {
    if (!loading && client && !lgpdAccepted) navigate("/portal/lgpd");
  }, [loading, client, lgpdAccepted, navigate]);

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

          {/* Cards de ação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/portal/meus-dados")}
              className="bg-white rounded-xl border border-purple-100 shadow-sm p-6 text-left hover:border-purple-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-purple-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-purple-500 transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-800">Meus Dados</h3>
              <p className="text-sm text-gray-500 mt-1">Complete e atualize seu cadastro</p>
            </button>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 opacity-60 cursor-not-allowed">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  Em breve
                </span>
              </div>
              <h3 className="font-semibold text-gray-600">Meu Processo</h3>
              <p className="text-sm text-gray-400 mt-1">Acompanhe o andamento do seu CR</p>
            </div>
          </div>

          {/* Status LGPD */}
          {lgpdAccepted && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Termo LGPD aceito — seus dados estão protegidos
            </div>
          )}

          {/* Dica */}
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-purple-800">
            <strong>Próximo passo:</strong> Complete seus dados cadastrais clicando em "Meus
            Dados". Quanto mais completo seu cadastro, mais rápido seu processo avança!
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
