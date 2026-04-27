/**
 * Super Admin - Tenant Management Page
 *
 * Página para gerenciamento de tenants (clubes) da plataforma CAC 360
 */

import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePlatformAuth } from "@/_core/hooks/usePlatformAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  Search,
  Settings,
  Database,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowLeft,
  Trash2,
  Edit,
  Eye,
  Globe,
  Loader,
  PlayCircle,
  PauseCircle,
  Mail,
  GitBranch,
  ScrollText,
  CalendarCheck,
  Package,
  Bot,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { EmailConfigPanel } from "@/components/super-admin/EmailConfigPanel";
import { EmailTemplatesPanel } from "@/components/super-admin/EmailTemplatesPanel";
import { EmailTriggersPanel } from "@/components/super-admin/EmailTriggersPanel";
import { TenantBillingPanel } from "@/components/super-admin/TenantBillingPanel";

// Logo
const APP_LOGO = "/logo.png";

// ─── Módulos disponíveis para habilitar por tenant ───────────────────────────
const MODULE_DEFINITIONS = [
  {
    key: "featureWorkflowCR" as const,
    label: "Workflow CR",
    description: "Gestão de processos e documentos CR",
    icon: GitBranch,
    color: "purple",
  },
  {
    key: "featureApostilamento" as const,
    label: "Aquisição & CRAF",
    description: "Processos de aquisição e registro CRAF",
    icon: ScrollText,
    color: "blue",
  },
  {
    key: "featureRenovacao" as const,
    label: "Compliance & Vencimentos",
    description: "Alertas e controle de vencimentos",
    icon: CalendarCheck,
    color: "amber",
  },
  {
    key: "featureInsumos" as const,
    label: "Munições & Insumos",
    description: "Controle de estoque de munições",
    icon: Package,
    color: "green",
  },
  {
    key: "featureIAT" as const,
    label: "Módulo IAT",
    description: "Inteligência artificial e automações",
    icon: Bot,
    color: "rose",
  },
] as const;

type ModuleKey = (typeof MODULE_DEFINITIONS)[number]["key"];

const MODULE_COLOR_MAP: Record<
  string,
  { enabled: string; hover: string; icon: string; check: string }
> = {
  purple: {
    enabled: "border-purple-500 bg-purple-50",
    hover: "hover:border-purple-400 hover:bg-purple-50/60",
    icon: "bg-purple-100 text-purple-600",
    check: "text-purple-500",
  },
  blue: {
    enabled: "border-blue-500 bg-blue-50",
    hover: "hover:border-blue-400 hover:bg-blue-50/60",
    icon: "bg-blue-100 text-blue-600",
    check: "text-blue-500",
  },
  amber: {
    enabled: "border-amber-500 bg-amber-50",
    hover: "hover:border-amber-400 hover:bg-amber-50/60",
    icon: "bg-amber-100 text-amber-600",
    check: "text-amber-500",
  },
  green: {
    enabled: "border-green-500 bg-green-50",
    hover: "hover:border-green-400 hover:bg-green-50/60",
    icon: "bg-green-100 text-green-600",
    check: "text-green-500",
  },
  rose: {
    enabled: "border-rose-500 bg-rose-50",
    hover: "hover:border-rose-400 hover:bg-rose-50/60",
    icon: "bg-rose-100 text-rose-600",
    check: "text-rose-500",
  },
};

function ModuleCard({
  mod,
  enabled,
  onToggle,
  readonly = false,
}: {
  mod: (typeof MODULE_DEFINITIONS)[number];
  enabled: boolean;
  onToggle: () => void;
  readonly?: boolean;
}) {
  const colors = MODULE_COLOR_MAP[mod.color];
  const Icon = mod.icon;

  return (
    <button
      type="button"
      onClick={readonly ? undefined : onToggle}
      disabled={readonly}
      className={[
        "relative w-full text-left rounded-xl border-2 p-4 transition-all duration-150 focus:outline-none",
        readonly
          ? "cursor-default opacity-80"
          : "focus-visible:ring-2 focus-visible:ring-purple-400",
        enabled
          ? colors.enabled + " shadow-sm"
          : "border-gray-200 bg-white " + (readonly ? "" : colors.hover),
      ].join(" ")}
    >
      {/* Ícone + check */}
      <div className="flex items-start justify-between mb-3">
        <div
          className={`p-2 rounded-lg ${enabled ? colors.icon : "bg-gray-100 text-gray-400"}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        {enabled && (
          <CheckCircle className={`h-5 w-5 ${colors.check} shrink-0`} />
        )}
      </div>

      {/* Nome */}
      <p
        className={`text-sm font-semibold leading-tight ${enabled ? "text-gray-900" : "text-gray-500"}`}
      >
        {mod.label}
      </p>

      {/* Descrição */}
      <p
        className={`text-xs mt-1 leading-snug ${enabled ? "text-gray-600" : "text-gray-400"}`}
      >
        {mod.description}
      </p>

      {/* Status badge */}
      <span
        className={[
          "inline-block mt-3 text-[0.65rem] font-medium px-2 py-0.5 rounded-full",
          enabled
            ? `${colors.check} bg-white/70 border border-current`
            : "text-gray-400 bg-gray-100",
        ].join(" ")}
      >
        {enabled ? "Habilitado" : "Desabilitado"}
      </span>
    </button>
  );
}

interface Tenant {
  id: number;
  slug: string;
  name: string;
  dbHost: string;
  dbName: string;
  primaryColor: string;
  secondaryColor: string;
  featureWorkflowCR: boolean;
  featureApostilamento: boolean;
  featureRenovacao: boolean;
  featureInsumos: boolean;
  featureIAT: boolean;
  plan: "starter" | "professional" | "enterprise";
  subscriptionStatus: "active" | "suspended" | "trial" | "cancelled";
  subscriptionExpiresAt: string | null;
  maxUsers: number;
  maxClients: number;
  isActive: boolean;
  createdAt: string;
}

function TenantStats({ tenantId }: { tenantId: number }) {
  const { data, isLoading } = trpc.tenants.getStats.useQuery({ id: tenantId });

  if (isLoading) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
      </span>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-1 mt-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"
          title="Usuários"
        >
          <Users className="h-3 w-3" /> {data.usersCount}
        </span>
        <span
          className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
          title="Clientes"
        >
          <Building2 className="h-3 w-3" /> {data.clientsCount}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span
          className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full"
          title="Tamanho do Banco de Dados"
        >
          <Database className="h-3 w-3" /> {data.dbSizeMB} MB
        </span>
        <span
          className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"
          title="Armazenamento de Arquivos Usado"
        >
          <Database className="h-3 w-3" /> {data.storageUsedGB} GB
        </span>
      </div>

      <div className="flex items-center gap-2 mt-1">
        {data.lastActivity && (
          <span
            className="flex items-center gap-1 text-gray-500"
            title={`Última atividade: ${new Date(data.lastActivity).toLocaleString()}`}
          >
            <Clock className="h-3 w-3" />{" "}
            {new Date(data.lastActivity).toLocaleDateString()}
          </span>
        )}
        {(data as any).error && (
          <span
            className="flex items-center gap-1 text-red-500"
            title={(data as any).error}
          >
            <AlertCircle className="h-3 w-3" /> Erro BD
          </span>
        )}
      </div>
    </div>
  );
}

export default function SuperAdminTenants() {
  const [, setLocation] = useLocation();
  const utils = trpc.useContext();
  const { admin } = usePlatformAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [activeTab, setActiveTab] = useState<
    "general" | "email" | "templates" | "triggers"
  >("general");
  const [panelMounted, setPanelMounted] = useState(false);

  useEffect(() => {
    if (editingTenant) {
      const timer = setTimeout(() => setPanelMounted(true), 10);
      return () => clearTimeout(timer);
    } else {
      setPanelMounted(false);
    }
  }, [editingTenant]);

  const closeEditPanel = () => {
    setPanelMounted(false);
    setTimeout(() => {
      setEditingTenant(null);
      setActiveTab("general");
    }, 300);
  };

  // Form state for new tenant
  const [newTenant, setNewTenant] = useState({
    slug: "",
    name: "",
    // Admin credentials
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    // Plan & Features
    plan: "starter" as const,
    maxUsers: 10,
    maxClients: 500,
    featureWorkflowCR: true,
    featureApostilamento: false,
    featureRenovacao: false,
    featureInsumos: false,
    featureIAT: false,
  });

  const {
    data: tenants = [],
    isLoading: isLoadingTenants,
    isFetching,
  } = trpc.tenants.list.useQuery();
  const { data: planDefinitions = [] } = trpc.plans.list.useQuery();

  const createTenant = trpc.tenants.create.useMutation({
    onSuccess: () => {
      toast.success(`Tenant "${newTenant.name}" criado com sucesso!`);
      setShowCreateModal(false);
      setNewTenant({
        slug: "",
        name: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
        plan: "starter",
        maxUsers: 10,
        maxClients: 500,
        featureWorkflowCR: true,
        featureApostilamento: false,
        featureRenovacao: false,
        featureInsumos: false,
        featureIAT: false,
      });
      utils.tenants.list.invalidate();
    },
    onError: err => toast.error(err.message || "Erro ao criar tenant"),
  });

  const updateTenant = trpc.tenants.update.useMutation({
    onSuccess: () => {
      toast.success("Tenant atualizado");
      closeEditPanel();
      utils.tenants.list.invalidate();
    },
    onError: err => toast.error(err.message || "Erro ao atualizar tenant"),
  });

  const setStatus = trpc.tenants.setStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado");
      utils.tenants.list.invalidate();
    },
    onError: err => toast.error(err.message || "Erro ao alterar status"),
  });

  const deleteTenant = trpc.tenants.delete.useMutation({
    onSuccess: () => {
      toast.success("Tenant cancelado/arquivado");
      utils.tenants.list.invalidate();
    },
    onError: err => toast.error(err.message || "Erro ao remover tenant"),
  });

  const hardDeleteTenant = trpc.tenants.hardDelete.useMutation({
    onSuccess: () => {
      toast.success("Tenant excluído DEFINITIVAMENTE");
      utils.tenants.list.invalidate();
    },
    onError: err =>
      toast.error(err.message || "Erro ao excluir tenant permanentemente"),
  });

  const [impersonatePassword, setImpersonatePassword] = useState("");
  const [impersonatingTenantId, setImpersonatingTenantId] = useState<
    number | null
  >(null);

  const impersonate = trpc.tenants.impersonate.useMutation({
    onSuccess: data => {
      toast.success(`Entrando como admin de ${data.tenantSlug}...`);
      window.location.href = `/${data.tenantSlug}/dashboard`;
    },
    onError: error => {
      toast.error(error.message || "Erro ao tentar acessar o tenant");
      setImpersonatingTenantId(null);
      setImpersonatePassword("");
    },
  });

  const handleImpersonate = (tenantId: number) => {
    setImpersonatingTenantId(tenantId);
  };

  const confirmImpersonate = () => {
    if (!impersonatingTenantId || !impersonatePassword) return;

    impersonate.mutate({
      tenantId: impersonatingTenantId,
      confirmPassword: impersonatePassword,
    });
  };

  const filteredTenants = useMemo(
    () =>
      tenants.filter(
        t =>
          t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.slug.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [tenants, searchTerm]
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
          </Badge>
        );
      case "trial":
        return (
          <Badge className="bg-blue-500">
            <Clock className="h-3 w-3 mr-1" /> Trial
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-yellow-500">
            <AlertCircle className="h-3 w-3 mr-1" /> Suspenso
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-500">
            <XCircle className="h-3 w-3 mr-1" /> Cancelado
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "enterprise":
        return (
          <Badge
            variant="outline"
            className="border-purple-500 text-purple-500"
          >
            Enterprise
          </Badge>
        );
      case "professional":
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-500">
            Professional
          </Badge>
        );
      case "starter":
        return (
          <Badge variant="outline" className="border-gray-500 text-gray-500">
            Starter
          </Badge>
        );
      default:
        return <Badge variant="outline">{plan}</Badge>;
    }
  };

  const handleCreateTenant = () => {
    // Validate
    if (
      !newTenant.slug ||
      !newTenant.name ||
      !newTenant.adminName ||
      !newTenant.adminEmail ||
      !newTenant.adminPassword
    ) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (newTenant.adminPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    createTenant.mutate({
      slug: newTenant.slug,
      name: newTenant.name,
      adminName: newTenant.adminName,
      adminEmail: newTenant.adminEmail,
      adminPassword: newTenant.adminPassword,
      maxUsers: Number(newTenant.maxUsers),
      maxClients: Number(newTenant.maxClients),
      maxStorageGB: 50,
      primaryColor: "#1a5c00",
      secondaryColor: "#4d9702",
      featureWorkflowCR: Boolean(newTenant.featureWorkflowCR),
      featureApostilamento: Boolean(newTenant.featureApostilamento),
      featureRenovacao: Boolean(newTenant.featureRenovacao),
      featureInsumos: Boolean(newTenant.featureInsumos),
      featureIAT: Boolean(newTenant.featureIAT),
      plan: newTenant.plan,
    });
  };

  const handleUpdateTenant = () => {
    if (!editingTenant) return;
    updateTenant.mutate({
      id: editingTenant.id,
      name: editingTenant.name,
      primaryColor: editingTenant.primaryColor,
      secondaryColor: editingTenant.secondaryColor,
      featureWorkflowCR: editingTenant.featureWorkflowCR,
      featureApostilamento: editingTenant.featureApostilamento,
      featureRenovacao: editingTenant.featureRenovacao,
      featureInsumos: editingTenant.featureInsumos,
      featureIAT: editingTenant.featureIAT,
      maxUsers: editingTenant.maxUsers,
      maxClients: editingTenant.maxClients,
      plan: editingTenant.plan,
      isActive: editingTenant.isActive,
    });
  };

  const toggleStatus = (tenant: Tenant) => {
    const next =
      tenant.subscriptionStatus === "suspended" ||
      tenant.subscriptionStatus === "cancelled"
        ? "active"
        : "suspended";
    setStatus.mutate({ id: tenant.id, status: next });
  };

  const handleDelete = (tenant: Tenant) => {
    if (tenant.subscriptionStatus === "cancelled") {
      if (
        confirm(
          `ATENÇÃO: Deseja EXCLUIR DEFINITIVAMENTE o tenant "${tenant.name}"?\n\nEsta ação não pode ser desfeita e apagará TODOS os dados (usuários, clientes, documentos, etc) deste tenant.`
        )
      ) {
        hardDeleteTenant.mutate({ id: tenant.id });
      }
      return;
    }

    if (
      !confirm(
        `Deseja cancelar/arquivar o tenant "${tenant.name}"?\n\nEle ficará inativo mas os dados serão mantidos para auditoria.`
      )
    )
      return;
    deleteTenant.mutate({ id: tenant.id });
  };

  return (
    <div className="min-h-screen bg-[#f0f0f0]">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-900/95 to-purple-700/95 text-white sticky top-0 z-10 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={APP_LOGO} alt="CAC 360" className="h-10 w-auto" />
              <div>
                <h1 className="text-xl font-bold">CAC 360 — Platform Admin</h1>
                <p className="text-sm text-purple-200">
                  Gerenciamento de Tenants
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">
                  {admin?.name || "Admin"}
                </p>
                <p className="text-xs text-purple-200">{admin?.email || ""}</p>
              </div>
              <Button
                variant="outline"
                className="text-white border-white/50 hover:bg-white/10"
                onClick={() => setLocation("/platform-admin")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total de Tenants
                  </p>
                  <p className="text-3xl font-bold">{tenants.length}</p>
                </div>
                <Building2 className="h-10 w-10 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ativos</p>
                  <p className="text-3xl font-bold text-green-600">
                    {
                      tenants.filter(t => t.subscriptionStatus === "active")
                        .length
                    }
                  </p>
                </div>
                <CheckCircle2 className="h-10 w-10 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Trial</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {
                      tenants.filter(t => t.subscriptionStatus === "trial")
                        .length
                    }
                  </p>
                </div>
                <Clock className="h-10 w-10 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Suspensos</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {
                      tenants.filter(t => t.subscriptionStatus === "suspended")
                        .length
                    }
                  </p>
                </div>
                <AlertCircle className="h-10 w-10 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou slug..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-3">
            {isFetching && (
              <Loader className="h-4 w-4 animate-spin text-gray-500" />
            )}
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-600 text-white shadow-lg shadow-purple-900/30 hover:bg-purple-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Tenant
            </Button>
          </div>
        </div>

        {/* Tenants List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {isLoadingTenants ? (
            <Card className="text-center py-12">
              <CardContent>
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
                <p className="text-gray-500">Carregando tenants...</p>
              </CardContent>
            </Card>
          ) : filteredTenants.length > 0 ? (
            filteredTenants.map(tenant => (
              <Card
                key={tenant.id}
                className="bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Color indicator */}
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: tenant.primaryColor }}
                      >
                        {tenant.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            {tenant.name}
                          </h3>
                          {getStatusBadge(tenant.subscriptionStatus)}
                          {getPlanBadge(tenant.plan)}
                        </div>
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              cac360.com.br/{tenant.slug}
                            </span>
                            <span className="flex items-center gap-1">
                              <Database className="h-3 w-3" />
                              {tenant.dbName}
                            </span>
                          </div>
                          <TenantStats tenantId={tenant.id} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Features */}
                      <div className="flex gap-1 mr-4">
                        {tenant.featureWorkflowCR && (
                          <Badge variant="secondary" className="text-xs">
                            CR
                          </Badge>
                        )}
                        {tenant.featureApostilamento && (
                          <Badge variant="secondary" className="text-xs">
                            APO
                          </Badge>
                        )}
                        {tenant.featureRenovacao && (
                          <Badge variant="secondary" className="text-xs">
                            REN
                          </Badge>
                        )}
                        {tenant.featureInsumos && (
                          <Badge
                            variant="outline"
                            className="bg-primary/5 border-primary/20 text-xs"
                          >
                            Insumos
                          </Badge>
                        )}
                        {tenant.featureIAT && (
                          <Badge
                            variant="outline"
                            className="bg-primary/5 border-primary/20 text-xs"
                          >
                            IAT
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <Button
                        variant="outline"
                        size="icon"
                        title="Entrar como Admin"
                        onClick={() => handleImpersonate(tenant.id)}
                        disabled={impersonate.isPending || !tenant.isActive}
                      >
                        <Globe className="h-4 w-4 text-indigo-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => setEditingTenant(tenant)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={
                          tenant.subscriptionStatus === "suspended"
                            ? "Ativar"
                            : "Suspender"
                        }
                        onClick={() => toggleStatus(tenant)}
                        disabled={setStatus.isLoading}
                      >
                        {tenant.subscriptionStatus === "suspended" ? (
                          <PlayCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <PauseCircle className="h-4 w-4 text-yellow-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        title="Excluir"
                        onClick={() => handleDelete(tenant)}
                        disabled={deleteTenant.isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="text-center py-12 bg-white shadow-sm border border-gray-200">
              <CardContent>
                <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Nenhum tenant encontrado</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Criar Novo Tenant</CardTitle>
              <CardDescription>
                Configure um novo clube/tenant na plataforma CAC 360
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL)*</Label>
                  <Input
                    id="slug"
                    placeholder="meuclube"
                    value={newTenant.slug}
                    onChange={e =>
                      setNewTenant({
                        ...newTenant,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, ""),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {newTenant.slug || "slug"}.cac360.com.br
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Clube*</Label>
                  <Input
                    id="name"
                    placeholder="Clube de Tiro XYZ"
                    value={newTenant.name}
                    onChange={e =>
                      setNewTenant({ ...newTenant, name: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Admin Credentials */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white">
                <h4 className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Administrador do Tenant
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="adminName">Nome do Admin*</Label>
                    <Input
                      id="adminName"
                      placeholder="João Silva"
                      value={newTenant.adminName}
                      onChange={e =>
                        setNewTenant({
                          ...newTenant,
                          adminName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">Email do Admin*</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      placeholder="admin@meuclube.com"
                      value={newTenant.adminEmail}
                      onChange={e =>
                        setNewTenant({
                          ...newTenant,
                          adminEmail: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Senha do Admin*</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={newTenant.adminPassword}
                      onChange={e =>
                        setNewTenant({
                          ...newTenant,
                          adminPassword: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este será o primeiro administrador do tenant. Ele poderá criar
                  novos usuários depois.
                </p>
              </div>

              {/* Plan & Limits */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white">
                <h4 className="font-medium">Plano e Limites</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plan">Plano</Label>
                    <select
                      id="plan"
                      className="w-full p-2 border rounded-md"
                      value={newTenant.plan}
                      onChange={e => {
                        const slug = e.target.value;
                        const plan = (planDefinitions as any[]).find(
                          (p: any) => p.slug === slug
                        );
                        setNewTenant({
                          ...newTenant,
                          plan: slug as any,
                          ...(plan
                            ? {
                                maxUsers: plan.maxUsers,
                                maxClients: plan.maxClients,
                                featureWorkflowCR:
                                  plan.featureWorkflowCR ?? true,
                                featureApostilamento:
                                  plan.featureApostilamento ?? false,
                                featureRenovacao:
                                  plan.featureRenovacao ?? false,
                                featureInsumos: plan.featureInsumos ?? false,
                                featureIAT: plan.featureIAT ?? false,
                              }
                            : {}),
                        });
                      }}
                    >
                      {(planDefinitions as any[]).length > 0 ? (
                        (planDefinitions as any[])
                          .filter((p: any) => p.isActive !== false)
                          .sort(
                            (a: any, b: any) =>
                              (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
                          )
                          .map((p: any) => (
                            <option key={p.slug} value={p.slug}>
                              {p.name}
                            </option>
                          ))
                      ) : (
                        <>
                          <option value="starter">Starter</option>
                          <option value="professional">Professional</option>
                          <option value="enterprise">Enterprise</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="maxUsers"
                      className="flex items-center gap-1"
                    >
                      Máx. Usuários
                      <span className="text-[0.6rem] text-gray-400 font-normal">
                        (incluído no plano)
                      </span>
                    </Label>
                    <Input
                      id="maxUsers"
                      type="number"
                      value={newTenant.maxUsers}
                      readOnly
                      disabled
                      className="bg-gray-50 text-gray-500 cursor-default"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="maxClients"
                      className="flex items-center gap-1"
                    >
                      Máx. Clientes
                      <span className="text-[0.6rem] text-gray-400 font-normal">
                        (incluído no plano)
                      </span>
                    </Label>
                    <Input
                      id="maxClients"
                      type="number"
                      value={newTenant.maxClients}
                      readOnly
                      disabled
                      className="bg-gray-50 text-gray-500 cursor-default"
                    />
                  </div>
                </div>
                {(planDefinitions as any[]).find(
                  (p: any) => p.slug === newTenant.plan
                ) &&
                  (() => {
                    const pd = (planDefinitions as any[]).find(
                      (p: any) => p.slug === newTenant.plan
                    );
                    return pd?.description ? (
                      <p className="text-xs text-gray-500">{pd.description}</p>
                    ) : null;
                  })()}
              </div>

              {/* Features */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
                <div>
                  <h4 className="font-semibold text-gray-800">
                    Módulos Disponíveis
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Selecione os módulos ativos para este tenant
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {MODULE_DEFINITIONS.map(mod => (
                    <ModuleCard
                      key={mod.key}
                      mod={mod}
                      enabled={!!newTenant[mod.key]}
                      onToggle={() =>
                        setNewTenant({
                          ...newTenant,
                          [mod.key]: !newTenant[mod.key],
                        })
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateTenant}
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={createTenant.isLoading}
                >
                  {createTenant.isLoading && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Criar Tenant
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Tenant Sliding Panel */}
      {editingTenant && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${panelMounted ? "opacity-100" : "opacity-0"}`}
            onClick={closeEditPanel}
          />

          {/* Panel - slides from right */}
          <div
            className={`absolute top-0 right-0 h-full w-[75vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
              panelMounted ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Panel Header */}
            <div className="bg-purple-700 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-white font-semibold text-lg">
                  Editar Tenant
                </h2>
                <p className="text-white/60 text-sm">
                  {editingTenant.name} &middot; {editingTenant.slug}
                </p>
              </div>
              <button
                onClick={closeEditPanel}
                className="text-white/60 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto bg-[#f5f5f5]">
              <div className="p-6 space-y-6">
                {/* Tabs Navigation */}
                <div className="flex gap-2 border-b">
                  <button
                    className={`px-4 py-2 font-medium transition-colors ${
                      activeTab === "general"
                        ? "border-b-2 border-purple-600 text-purple-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick={() => setActiveTab("general")}
                  >
                    Geral
                  </button>
                  <button
                    className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
                      activeTab === "email"
                        ? "border-b-2 border-purple-600 text-purple-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick={() => setActiveTab("email")}
                  >
                    <Mail className="h-4 w-4" />
                    Email & SMTP
                  </button>
                  <button
                    className={`px-4 py-2 font-medium transition-colors ${
                      activeTab === "templates"
                        ? "border-b-2 border-purple-600 text-purple-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick={() => setActiveTab("templates")}
                  >
                    Templates
                  </button>
                  <button
                    className={`px-4 py-2 font-medium transition-colors ${
                      activeTab === "triggers"
                        ? "border-b-2 border-purple-600 text-purple-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick={() => setActiveTab("triggers")}
                  >
                    Automações
                  </button>
                  <button
                    className={`px-4 py-2 font-medium transition-colors ${
                      activeTab === "billing"
                        ? "border-b-2 border-purple-600 text-purple-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick={() => setActiveTab("billing")}
                  >
                    Financeiro
                  </button>
                </div>

                {/* Tab Content - General */}
                {activeTab === "general" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input
                          value={editingTenant.name}
                          onChange={e =>
                            setEditingTenant({
                              ...editingTenant,
                              name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input value={editingTenant.slug} disabled />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cor primária</Label>
                        <Input
                          value={editingTenant.primaryColor}
                          onChange={e =>
                            setEditingTenant({
                              ...editingTenant,
                              primaryColor: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cor secundária</Label>
                        <Input
                          value={editingTenant.secondaryColor}
                          onChange={e =>
                            setEditingTenant({
                              ...editingTenant,
                              secondaryColor: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Plano</Label>
                        <select
                          className="w-full p-2 border rounded-md"
                          value={editingTenant.plan}
                          onChange={e => {
                            const slug = e.target.value;
                            const plan = (planDefinitions as any[]).find(
                              (p: any) => p.slug === slug
                            );
                            setEditingTenant({
                              ...editingTenant,
                              plan: slug as Tenant["plan"],
                              ...(plan
                                ? {
                                    maxUsers: plan.maxUsers,
                                    maxClients: plan.maxClients,
                                    featureWorkflowCR:
                                      plan.featureWorkflowCR ?? true,
                                    featureApostilamento:
                                      plan.featureApostilamento ?? false,
                                    featureRenovacao:
                                      plan.featureRenovacao ?? false,
                                    featureInsumos:
                                      plan.featureInsumos ?? false,
                                    featureIAT: plan.featureIAT ?? false,
                                  }
                                : {}),
                            });
                          }}
                        >
                          {(planDefinitions as any[]).length > 0 ? (
                            (planDefinitions as any[])
                              .filter((p: any) => p.isActive !== false)
                              .sort(
                                (a: any, b: any) =>
                                  a.displayOrder - b.displayOrder
                              )
                              .map((p: any) => (
                                <option key={p.slug} value={p.slug}>
                                  {p.name}
                                </option>
                              ))
                          ) : (
                            <>
                              <option value="starter">Starter</option>
                              <option value="professional">Professional</option>
                              <option value="enterprise">Enterprise</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          Máx. Usuários
                          <span className="text-[0.6rem] text-gray-400 font-normal">
                            (incluído no plano)
                          </span>
                        </Label>
                        <Input
                          type="number"
                          value={editingTenant.maxUsers}
                          readOnly
                          disabled
                          className="bg-gray-50 text-gray-500 cursor-default"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          Máx. Clientes
                          <span className="text-[0.6rem] text-gray-400 font-normal">
                            (incluído no plano)
                          </span>
                        </Label>
                        <Input
                          type="number"
                          value={editingTenant.maxClients}
                          readOnly
                          disabled
                          className="bg-gray-50 text-gray-500 cursor-default"
                        />
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
                      <div>
                        <h4 className="font-semibold text-gray-800">
                          Módulos Disponíveis
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Selecione os módulos ativos para este tenant
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {MODULE_DEFINITIONS.map(mod => (
                          <ModuleCard
                            key={mod.key}
                            mod={mod}
                            enabled={!!editingTenant[mod.key]}
                            onToggle={() =>
                              setEditingTenant({
                                ...editingTenant,
                                [mod.key]: !editingTenant[mod.key],
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button variant="outline" onClick={closeEditPanel}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleUpdateTenant}
                        className="bg-purple-600 hover:bg-purple-700"
                        disabled={updateTenant.isLoading}
                      >
                        {updateTenant.isLoading && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Salvar alterações
                      </Button>
                    </div>
                  </div>
                )}

                {/* Tab Content - Email */}
                {activeTab === "email" && (
                  <EmailConfigPanel tenantId={editingTenant.id} />
                )}

                {/* Tab Content - Templates */}
                {activeTab === "templates" && (
                  <EmailTemplatesPanel tenantId={editingTenant.id} />
                )}

                {/* Tab Content - Triggers */}
                {activeTab === "triggers" && (
                  <EmailTriggersPanel tenantId={editingTenant.id} />
                )}

                {/* Tab Content - Billing */}
                {activeTab === "billing" && (
                  <TenantBillingPanel
                    tenantId={editingTenant.id}
                    tenantName={editingTenant.name}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Impersonate Password Modal */}
      {impersonatingTenantId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setImpersonatingTenantId(null);
              setImpersonatePassword("");
            }
          }}
        >
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-indigo-500" />
                  Confirmação de Acesso
                </CardTitle>
                <button
                  onClick={() => {
                    setImpersonatingTenantId(null);
                    setImpersonatePassword("");
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  &times;
                </button>
              </div>
              <CardDescription>
                Para acessar este tenant como administrador, digite sua senha de
                Super Admin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="impersonatePassword">Sua Senha</Label>
                <Input
                  id="impersonatePassword"
                  type="password"
                  placeholder="Sua senha de Super Admin"
                  value={impersonatePassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setImpersonatePassword(e.target.value)
                  }
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmImpersonate();
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setImpersonatingTenantId(null);
                    setImpersonatePassword("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmImpersonate}
                  disabled={!impersonatePassword || impersonate.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {impersonate.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Confirmar Acesso
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
