import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { usePortalAuth } from "./usePortalAuth";

const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const STEPS = ["Identificação", "Contato", "Endereço", "Confirmação"];
const APOSTILAMENTO_OPTIONS = [
  { value: "atirador", label: "Atirador" },
  { value: "cacador", label: "Caçador" },
  { value: "colecionador", label: "Colecionador" },
] as const;

export default function PortalMeusDados() {
  const [, navigate] = useLocation();
  const { client, lgpdAccepted, loading, refetch, canEditApostilamentoInPortal } = usePortalAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    birthDate: "",
    identityNumber: "",
    identityIssueDate: "",
    identityIssuer: "",
    identityUf: "",
    gender: "",
    motherName: "",
    fatherName: "",
    maritalStatus: "",
    profession: "",
    phone: "",
    phone2: "",
    cep: "",
    address: "",
    addressNumber: "",
    complement: "",
    neighborhood: "",
    city: "",
    residenceUf: "",
    apostilamentoActivities: [] as string[],
    hasSecondCollectionAddress: false,
    acervoCep: "",
    acervoAddress: "",
    acervoAddressNumber: "",
    acervoNeighborhood: "",
    acervoCity: "",
    acervoUf: "",
    acervoComplement: "",
  });

  // Preencher form com dados existentes do cliente
  useEffect(() => {
    if (client) {
      setForm({
        name: client.name || "",
        birthDate: client.birthDate?.slice(0, 10) || "",
        identityNumber: client.identityNumber || "",
        identityIssueDate: client.identityIssueDate?.slice(0, 10) || "",
        identityIssuer: client.identityIssuer || "",
        identityUf: client.identityUf || "",
        gender: client.gender || "",
        motherName: client.motherName || "",
        fatherName: client.fatherName || "",
        maritalStatus: client.maritalStatus || "",
        profession: client.profession || "",
        phone: client.phone || "",
        phone2: client.phone2 || "",
        cep: client.cep || "",
        address: client.address || "",
        addressNumber: client.addressNumber || "",
        complement: client.complement || "",
        neighborhood: client.neighborhood || "",
        city: client.city || "",
        residenceUf: client.residenceUf || "",
        apostilamentoActivities: client.apostilamentoActivities || [],
        hasSecondCollectionAddress: !!client.hasSecondCollectionAddress,
        acervoCep: client.acervoCep || "",
        acervoAddress: client.acervoAddress || "",
        acervoAddressNumber: client.acervoAddressNumber || "",
        acervoNeighborhood: client.acervoNeighborhood || "",
        acervoCity: client.acervoCity || "",
        acervoUf: client.acervoUf || "",
        acervoComplement: client.acervoComplement || "",
      });
    }
  }, [client]);

  useEffect(() => {
    if (!loading && !client) navigate("/portal/login");
  }, [loading, client, navigate]);

  useEffect(() => {
    if (!loading && client && !lgpdAccepted) navigate("/portal/lgpd");
  }, [loading, client, lgpdAccepted, navigate]);

  function setField(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleActivity(value: string) {
    setForm((f) => {
      const next = f.apostilamentoActivities.includes(value)
        ? f.apostilamentoActivities.filter((v) => v !== value)
        : [...f.apostilamentoActivities, value];
      return { ...f, apostilamentoActivities: next };
    });
  }

  async function fetchCep(cep: string) {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          address: data.logradouro || f.address,
          neighborhood: data.bairro || f.neighborhood,
          city: data.localidade || f.city,
          residenceUf: data.uf || f.residenceUf,
        }));
      }
    } catch {
      // silently ignore CEP fetch errors
    } finally {
      setCepLoading(false);
    }
  }

  function formatCep(v: string) {
    const n = v.replace(/\D/g, "").slice(0, 8);
    return n.replace(/(\d{5})(\d)/, "$1-$2");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/portal/meus-dados", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar dados.");
      await refetch();
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function StepIndicator() {
    return (
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${
                    i < step
                      ? "bg-green-500 text-white"
                      : i === step
                      ? "bg-purple-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs mt-1 hidden sm:block ${
                  i === step ? "text-purple-700 font-semibold" : "text-gray-400"
                }`}
              >
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${i < step ? "bg-green-400" : "bg-gray-200"}`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <PortalLayout title="Meus Dados Cadastrais" loading={loading}>
      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6 sm:p-8">
        <StepIndicator />

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 0 — Identificação */}
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 mb-4">Dados de Identificação</h3>

            <div>
              <Label>Nome Completo *</Label>
              <Input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setField("birthDate", e.target.value)}
                />
              </div>
              <div>
                <Label>Gênero</Label>
                <Select value={form.gender} onValueChange={(v) => setField("gender", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nº do Documento (RG/CNH)</Label>
                <Input
                  value={form.identityNumber}
                  onChange={(e) => setField("identityNumber", e.target.value)}
                />
              </div>
              <div>
                <Label>Data de Emissão</Label>
                <Input
                  type="date"
                  value={form.identityIssueDate}
                  onChange={(e) => setField("identityIssueDate", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Órgão Emissor</Label>
                <Input
                  placeholder="SSP, DETRAN..."
                  value={form.identityIssuer}
                  onChange={(e) => setField("identityIssuer", e.target.value)}
                />
              </div>
              <div>
                <Label>UF Emissora</Label>
                <Select
                  value={form.identityUf}
                  onValueChange={(v) => setField("identityUf", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_LIST.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome da Mãe</Label>
                <Input
                  value={form.motherName}
                  onChange={(e) => setField("motherName", e.target.value)}
                />
              </div>
              <div>
                <Label>Nome do Pai</Label>
                <Input
                  value={form.fatherName}
                  onChange={(e) => setField("fatherName", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estado Civil</Label>
                <Select
                  value={form.maritalStatus}
                  onValueChange={(v) => setField("maritalStatus", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                    <SelectItem value="casado">Casado(a)</SelectItem>
                    <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                    <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                    <SelectItem value="uniao_estavel">União Estável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Profissão</Label>
                <Input
                  value={form.profession}
                  onChange={(e) => setField("profession", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 1 — Contato */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 mb-4">Informações de Contato</h3>

            <div>
              <Label>Email (não editável)</Label>
              <Input value={client?.email || ""} disabled className="bg-gray-50" />
            </div>

            <div>
              <Label>CPF (não editável)</Label>
              <Input value={client?.cpf || ""} disabled className="bg-gray-50" />
            </div>

            <div>
              <Label>Telefone / WhatsApp *</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                required
              />
            </div>

            <div>
              <Label>Telefone Alternativo</Label>
              <Input
                placeholder="(11) 88888-8888"
                value={form.phone2}
                onChange={(e) => setField("phone2", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 2 — Endereço */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 mb-4">Endereço Residencial</h3>

            <div className="p-4 rounded-lg border border-purple-200 bg-purple-50/40 space-y-3">
              <div className="text-sm font-semibold text-purple-900">Atividades para apostilamento</div>
              {!canEditApostilamentoInPortal && (
                <p className="text-xs text-amber-700">Após o primeiro cadastro, esta seção só pode ser alterada no módulo interno.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {APOSTILAMENTO_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={form.apostilamentoActivities.includes(opt.value)}
                      onChange={() => toggleActivity(opt.value)}
                      disabled={!canEditApostilamentoInPortal}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={form.hasSecondCollectionAddress}
                  onChange={(e) => setField("hasSecondCollectionAddress", e.target.checked)}
                  disabled={!canEditApostilamentoInPortal}
                />
                Possui segundo endereço de acervo
              </label>
            </div>

            <div>
              <Label>CEP *</Label>
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="00000-000"
                  value={form.cep}
                  onChange={(e) => {
                    const v = formatCep(e.target.value);
                    setField("cep", v);
                    if (v.replace(/\D/g, "").length === 8) fetchCep(v);
                  }}
                  maxLength={9}
                />
                {cepLoading && <Loader2 className="h-5 w-5 animate-spin text-purple-500 flex-shrink-0" />}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label>Logradouro *</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </div>
              <div>
                <Label>Número *</Label>
                <Input
                  value={form.addressNumber}
                  onChange={(e) => setField("addressNumber", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Complemento</Label>
              <Input
                placeholder="Apto, Bloco..."
                value={form.complement}
                onChange={(e) => setField("complement", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bairro *</Label>
                <Input
                  value={form.neighborhood}
                  onChange={(e) => setField("neighborhood", e.target.value)}
                />
              </div>
              <div>
                <Label>Cidade *</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Estado (UF) *</Label>
              <Select
                value={form.residenceUf}
                onValueChange={(v) => setField("residenceUf", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  {UF_LIST.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.hasSecondCollectionAddress && (
              <div className="space-y-4 p-4 rounded-lg border border-amber-200 bg-amber-50/40">
                <div className="text-sm font-semibold text-amber-900">Segundo endereço de acervo</div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>CEP</Label>
                    <Input
                      value={form.acervoCep}
                      onChange={(e) => setField("acervoCep", formatCep(e.target.value))}
                      disabled={!canEditApostilamentoInPortal}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Logradouro</Label>
                    <Input
                      value={form.acervoAddress}
                      onChange={(e) => setField("acervoAddress", e.target.value)}
                      disabled={!canEditApostilamentoInPortal}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Número</Label>
                    <Input
                      value={form.acervoAddressNumber}
                      onChange={(e) => setField("acervoAddressNumber", e.target.value)}
                      disabled={!canEditApostilamentoInPortal}
                    />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input
                      value={form.acervoNeighborhood}
                      onChange={(e) => setField("acervoNeighborhood", e.target.value)}
                      disabled={!canEditApostilamentoInPortal}
                    />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input
                      value={form.acervoCity}
                      onChange={(e) => setField("acervoCity", e.target.value)}
                      disabled={!canEditApostilamentoInPortal}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>UF</Label>
                    <Select value={form.acervoUf} onValueChange={(v) => setField("acervoUf", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {UF_LIST.map((uf) => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Complemento</Label>
                    <Input
                      value={form.acervoComplement}
                      onChange={(e) => setField("acervoComplement", e.target.value)}
                      disabled={!canEditApostilamentoInPortal}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Confirmação */}
        {step === 3 && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Cadastro enviado com sucesso!</h3>
            <p className="text-gray-600 max-w-sm mx-auto">
              Seus dados foram recebidos e serão analisados pela equipe do clube. Você será
              notificado por email sobre os próximos passos.
            </p>
            <Button
              className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => navigate("/portal")}
            >
              Ir para o Portal →
            </Button>
          </div>
        )}

        {/* Navigation */}
        {step < 3 && (
          <div className="flex gap-3 mt-8 pt-6 border-t">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                disabled={saving}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
            )}
            <div className="flex-1" />
            {step < 2 ? (
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => setStep((s) => s + 1)}
              >
                Próximo <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Salvar Dados
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
