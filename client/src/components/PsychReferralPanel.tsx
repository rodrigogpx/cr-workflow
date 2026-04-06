import React, { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText, Upload, Send, CheckCircle2, Loader2, X, Brain
} from "lucide-react";

interface PsychReferralPanelProps {
  clientId: number;
  stepId: number;
  referralSentAt?: string | null;
  referralType?: string | null;
  onSuccess?: () => void;
}

export function PsychReferralPanel({
  clientId,
  stepId,
  referralSentAt,
  referralType,
  onSuccess,
}: PsychReferralPanelProps) {
  const [mode, setMode] = useState<"idle" | "standard" | "custom">("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMutation = trpc.workflow.sendPsychReferral.useMutation({
    onSuccess: () => {
      toast.success("Encaminhamento enviado por e-mail ao cliente!");
      setMode("idle");
      setSelectedFile(null);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error("Erro ao enviar encaminhamento: " + err.message);
    },
  });

  const isPending = sendMutation.isPending;

  function handleSendStandard() {
    sendMutation.mutate({ clientId, stepId, type: "standard" });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  function handleSendCustom() {
    if (!selectedFile) {
      toast.error("Selecione um arquivo para o encaminhamento personalizado.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      sendMutation.mutate({
        clientId,
        stepId,
        type: "custom",
        fileData: dataUri,
        fileName: selectedFile.name,
      });
    };
    reader.readAsDataURL(selectedFile);
  }

  return (
    <Card className="mt-4 border border-blue-100 bg-blue-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-[#123A63]">
          <Brain className="h-4 w-4" />
          Encaminhamento para Avaliação Psicológica
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Already sent badge */}
        {referralSentAt && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
            <div className="text-xs text-green-800">
              <span className="font-semibold">Encaminhamento enviado</span>
              {referralType === "standard" && " (Padrão CAC360)"}{referralType === "custom" && " (Personalizado)"}
              {referralSentAt && (
                <span className="text-green-600"> em {new Date(referralSentAt).toLocaleDateString("pt-BR")}</span>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500">
          Selecione o tipo de encaminhamento a ser enviado por e-mail ao cliente.
        </p>

        {/* Option cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Standard */}
          <button
            type="button"
            onClick={() => setMode(mode === "standard" ? "idle" : "standard")}
            className={`text-left border rounded-xl p-4 transition-all ${
              mode === "standard"
                ? "border-[#123A63] bg-[#123A63]/5 ring-1 ring-[#123A63]"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-[#123A63]" />
              <span className="font-semibold text-sm text-gray-800">Padrão CAC360</span>
              {mode === "standard" && (
                <Badge className="ml-auto bg-[#123A63] text-white text-[10px] py-0 px-1.5">Selecionado</Badge>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Gera automaticamente um PDF de encaminhamento com os dados do cliente e envia por e-mail.
            </p>
          </button>

          {/* Custom */}
          <button
            type="button"
            onClick={() => setMode(mode === "custom" ? "idle" : "custom")}
            className={`text-left border rounded-xl p-4 transition-all ${
              mode === "custom"
                ? "border-amber-500 bg-amber-50/50 ring-1 ring-amber-400"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Upload className="h-4 w-4 text-amber-600" />
              <span className="font-semibold text-sm text-gray-800">Personalizado</span>
              {mode === "custom" && (
                <Badge className="ml-auto bg-amber-500 text-white text-[10px] py-0 px-1.5">Selecionado</Badge>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Envie um encaminhamento próprio. O sistema também anexa a ficha cadastral do cliente no e-mail.
            </p>
          </button>
        </div>

        {/* Standard action */}
        {mode === "standard" && (
          <div className="flex items-center gap-3 bg-white border border-[#123A63]/20 rounded-lg px-4 py-3">
            <FileText className="h-5 w-5 text-[#123A63] flex-shrink-0" />
            <p className="text-xs text-gray-600 flex-1">
              O PDF de encaminhamento será gerado com os dados cadastrais e enviado ao e-mail do cliente.
            </p>
            <Button
              size="sm"
              className="bg-[#123A63] hover:bg-[#0f2f50]"
              onClick={handleSendStandard}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Enviar
            </Button>
          </div>
        )}

        {/* Custom action */}
        {mode === "custom" && (
          <div className="bg-white border border-amber-200 rounded-lg px-4 py-3 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileChange}
            />

            {selectedFile ? (
              <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
                <FileText className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-700 flex-1 truncate">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-1.5 border-2 border-dashed border-amber-300 rounded-lg py-4 text-amber-600 hover:border-amber-400 hover:bg-amber-50 transition-colors"
              >
                <Upload className="h-5 w-5" />
                <span className="text-xs font-medium">Selecionar arquivo</span>
                <span className="text-[10px] text-gray-400">PDF, DOC, DOCX, JPG, PNG</span>
              </button>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleSendCustom}
                disabled={isPending || !selectedFile}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Enviar encaminhamento
              </Button>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
