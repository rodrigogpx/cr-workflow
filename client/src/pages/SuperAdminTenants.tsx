/**
 * Super Admin - Tenant Management Page
 * 
 * Página para gerenciamento de tenants (clubes) da plataforma CAC 360
 */

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Loader
} from "lucide-react";
import { toast } from "sonner";

// Logo
const APP_LOGO = "/logo.png";

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
  plan: "starter" | "professional" | "enterprise";
  subscriptionStatus: "active" | "suspended" | "trial" | "cancelled";
  subscriptionExpiresAt: string | null;
  maxUsers: number;
  maxClients: number;
  isActive: boolean;
  createdAt: string;
}

export default function SuperAdminTenants() {
  const [, setLocation] = useLocation();
  const utils = trpc.useContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

  // Form state for new tenant
  const [newTenant, setNewTenant] = useState({
    slug: "",
    name: "",
    dbHost: "localhost",
    dbPort: 5432,
    dbName: "",
    dbUser: "",
    dbPassword: "",
    plan: "starter" as const,
    maxUsers: 10,
    maxClients: 500,
    featureWorkflowCR: true,
    featureApostilamento: false,
    featureRenovacao: false,
    featureInsumos: false,
  });

  const { data: tenants = [], isLoading: isLoadingTenants, isFetching } = trpc.tenants.list.useQuery();

  const createTenant = trpc.tenants.create.useMutation({
    onSuccess: () => {
      toast.success(`Tenant "${newTenant.name}" criado com sucesso!`);
      setShowCreateModal(false);
      setNewTenant({
        slug: "",
        name: "",
        dbHost: "localhost",
        dbPort: 5432,
        dbName: "",
        dbUser: "",
        dbPassword: "",
        plan: "starter",
        maxUsers: 10,
        maxClients: 500,
        featureWorkflowCR: true,
        featureApostilamento: false,
        featureRenovacao: false,
        featureInsumos: false,
      });
      utils.tenants.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao criar tenant"),
  });

  const updateTenant = trpc.tenants.update.useMutation({
    onSuccess: () => {
      toast.success("Tenant atualizado");
      setEditingTenant(null);
      utils.tenants.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar tenant"),
  });

  const setStatus = trpc.tenants.setStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado");
      utils.tenants.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao alterar status"),
  });

  const deleteTenant = trpc.tenants.delete.useMutation({
    onSuccess: () => {
      toast.success("Tenant removido");
      utils.tenants.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao remover tenant"),
  });

  const seedMocks = trpc.tenants.seedMocks.useMutation({
    onSuccess: (res) => {
      toast.success(`Seed concluído: ${res.tenants} tenants, ${res.users} usuários, ${res.clients} clientes`);
      utils.tenants.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao rodar seed"),
  });

  const filteredTenants = useMemo(
    () =>
      tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.slug.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [tenants, searchTerm]
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Ativo</Badge>;
      case "trial":
        return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" /> Trial</Badge>;
      case "suspended":
        return <Badge className="bg-yellow-500"><AlertCircle className="h-3 w-3 mr-1" /> Suspenso</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "enterprise":
        return <Badge variant="outline" className="border-purple-500 text-purple-500">Enterprise</Badge>;
      case "professional":
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Professional</Badge>;
      case "starter":
        return <Badge variant="outline" className="border-gray-500 text-gray-500">Starter</Badge>;
      default:
        return <Badge variant="outline">{plan}</Badge>;
    }
  };

  const handleCreateTenant = () => {
    // Validate
    if (!newTenant.slug || !newTenant.name || !newTenant.dbName) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    createTenant.mutate({
      ...newTenant,
      dbPort: Number(newTenant.dbPort),
      maxUsers: Number(newTenant.maxUsers),
      maxClients: Number(newTenant.maxClients),
      maxStorageGB: 50, // default
      secondaryColor: newTenant.secondaryColor || "#4d9702",
      primaryColor: newTenant.primaryColor || "#1a5c00",
      featureWorkflowCR: Boolean(newTenant.featureWorkflowCR),
      featureApostilamento: Boolean(newTenant.featureApostilamento),
      featureRenovacao: Boolean(newTenant.featureRenovacao),
      featureInsumos: Boolean(newTenant.featureInsumos),
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
      maxUsers: editingTenant.maxUsers,
      maxClients: editingTenant.maxClients,
      plan: editingTenant.plan,
      isActive: editingTenant.isActive,
    });
  };

  const toggleStatus = (tenant: Tenant) => {
    const next =
      tenant.subscriptionStatus === "suspended" || tenant.subscriptionStatus === "cancelled"
        ? "active"
        : "suspended";
    setStatus.mutate({ id: tenant.id, status: next });
  };

  const handleDelete = (tenant: Tenant) => {
    if (!confirm(`Remover tenant ${tenant.name}?`)) return;
    deleteTenant.mutate({ id: tenant.id });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-900 to-purple-700 text-white sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={APP_LOGO} alt="CAC 360" className="h-10 w-auto" />
              <div>
                <h1 className="text-xl font-bold">CAC 360 - Super Admin</h1>
                <p className="text-sm text-purple-200">Gerenciamento de Tenants</p>
              </div>
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
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Tenants</p>
                  <p className="text-3xl font-bold">{tenants.length}</p>
                </div>
                <Building2 className="h-10 w-10 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ativos</p>
                  <p className="text-3xl font-bold text-green-600">
                    {tenants.filter(t => t.subscriptionStatus === "active").length}
                  </p>
                </div>
                <CheckCircle2 className="h-10 w-10 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Trial</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {tenants.filter(t => t.subscriptionStatus === "trial").length}
                  </p>
                </div>
                <Clock className="h-10 w-10 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Suspensos</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {tenants.filter(t => t.subscriptionStatus === "suspended").length}
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => seedMocks.mutate()}
              disabled={seedMocks.isLoading}
              className="flex items-center gap-2"
            >
              {seedMocks.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              Rodar seed mock
            </Button>
            {isFetching && <Loader className="h-4 w-4 animate-spin text-gray-500" />}
            <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Novo Tenant
            </Button>
          </div>
        </div>

        {/* Tenants List */}
        <div className="grid gap-4">
          {isLoadingTenants ? (
            <Card className="text-center py-12">
              <CardContent>
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
                <p className="text-gray-500">Carregando tenants...</p>
              </CardContent>
            </Card>
          ) : filteredTenants.length > 0 ? (
            filteredTenants.map((tenant) => (
              <Card key={tenant.id} className="hover:shadow-md transition-shadow">
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
                          <h3 className="text-lg font-semibold">{tenant.name}</h3>
                          {getStatusBadge(tenant.subscriptionStatus)}
                          {getPlanBadge(tenant.plan)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {tenant.slug}.cac360.com.br
                          </span>
                          <span className="flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {tenant.dbName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {tenant.maxUsers} usuários / {tenant.maxClients} clientes
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Features */}
                      <div className="flex gap-1 mr-4">
                        {tenant.featureWorkflowCR && (
                          <Badge variant="secondary" className="text-xs">CR</Badge>
                        )}
                        {tenant.featureApostilamento && (
                          <Badge variant="secondary" className="text-xs">APO</Badge>
                        )}
                        {tenant.featureRenovacao && (
                          <Badge variant="secondary" className="text-xs">REN</Badge>
                        )}
                        {tenant.featureInsumos && (
                          <Badge variant="secondary" className="text-xs">INS</Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <Button variant="ghost" size="icon" title="Visualizar">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditingTenant(tenant)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        title={tenant.subscriptionStatus === "suspended" ? "Ativar" : "Suspender"}
                        onClick={() => toggleStatus(tenant)}
                        disabled={setStatus.isLoading}
                      >
                        <Settings className="h-4 w-4" />
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
            <Card className="text-center py-12">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
                    onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  />
                  <p className="text-xs text-muted-foreground">{newTenant.slug || "slug"}.cac360.com.br</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Clube*</Label>
                  <Input
                    id="name"
                    placeholder="Clube de Tiro XYZ"
                    value={newTenant.name}
                    onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  />
                </div>
              </div>

              {/* Database */}
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Configuração do Banco de Dados
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dbHost">Host</Label>
                    <Input
                      id="dbHost"
                      value={newTenant.dbHost}
                      onChange={(e) => setNewTenant({ ...newTenant, dbHost: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dbPort">Porta</Label>
                    <Input
                      id="dbPort"
                      type="number"
                      value={newTenant.dbPort}
                      onChange={(e) => setNewTenant({ ...newTenant, dbPort: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dbName">Nome do Banco*</Label>
                    <Input
                      id="dbName"
                      placeholder="cac360_meuclube"
                      value={newTenant.dbName}
                      onChange={(e) => setNewTenant({ ...newTenant, dbName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dbUser">Usuário</Label>
                    <Input
                      id="dbUser"
                      value={newTenant.dbUser}
                      onChange={(e) => setNewTenant({ ...newTenant, dbUser: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="dbPassword">Senha</Label>
                    <Input
                      id="dbPassword"
                      type="password"
                      value={newTenant.dbPassword}
                      onChange={(e) => setNewTenant({ ...newTenant, dbPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Plan & Limits */}
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Plano e Limites</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plan">Plano</Label>
                    <select
                      id="plan"
                      className="w-full p-2 border rounded-md"
                      value={newTenant.plan}
                      onChange={(e) => setNewTenant({ ...newTenant, plan: e.target.value as any })}
                    >
                      <option value="starter">Starter</option>
                      <option value="professional">Professional</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxUsers">Máx. Usuários</Label>
                    <Input
                      id="maxUsers"
                      type="number"
                      value={newTenant.maxUsers}
                      onChange={(e) => setNewTenant({ ...newTenant, maxUsers: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxClients">Máx. Clientes</Label>
                    <Input
                      id="maxClients"
                      type="number"
                      value={newTenant.maxClients}
                      onChange={(e) => setNewTenant({ ...newTenant, maxClients: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Módulos Habilitados</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="featureWorkflowCR">Workflow CR</Label>
                    <Switch
                      id="featureWorkflowCR"
                      checked={newTenant.featureWorkflowCR}
                      onCheckedChange={(checked) => setNewTenant({ ...newTenant, featureWorkflowCR: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="featureApostilamento">Apostilamento</Label>
                    <Switch
                      id="featureApostilamento"
                      checked={newTenant.featureApostilamento}
                      onCheckedChange={(checked) => setNewTenant({ ...newTenant, featureApostilamento: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="featureRenovacao">Renovação</Label>
                    <Switch
                      id="featureRenovacao"
                      checked={newTenant.featureRenovacao}
                      onCheckedChange={(checked) => setNewTenant({ ...newTenant, featureRenovacao: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="featureInsumos">Insumos</Label>
                    <Switch
                      id="featureInsumos"
                      checked={newTenant.featureInsumos}
                      onCheckedChange={(checked) => setNewTenant({ ...newTenant, featureInsumos: checked })}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateTenant} className="bg-purple-600 hover:bg-purple-700" disabled={createTenant.isLoading}>
                  {createTenant.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Tenant
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Tenant Modal */}
      {editingTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Editar Tenant</CardTitle>
              <CardDescription>
                Ajuste dados e módulos do tenant {editingTenant.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={editingTenant.name}
                    onChange={(e) => setEditingTenant({ ...editingTenant, name: e.target.value })}
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
                    onChange={(e) => setEditingTenant({ ...editingTenant, primaryColor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor secundária</Label>
                  <Input
                    value={editingTenant.secondaryColor}
                    onChange={(e) => setEditingTenant({ ...editingTenant, secondaryColor: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={editingTenant.plan}
                    onChange={(e) => setEditingTenant({ ...editingTenant, plan: e.target.value as Tenant["plan"] })}
                  >
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Máx. Usuários</Label>
                  <Input
                    type="number"
                    value={editingTenant.maxUsers}
                    onChange={(e) => setEditingTenant({ ...editingTenant, maxUsers: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máx. Clientes</Label>
                  <Input
                    type="number"
                    value={editingTenant.maxClients}
                    onChange={(e) => setEditingTenant({ ...editingTenant, maxClients: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Módulos Habilitados</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="editFeatureWorkflowCR">Workflow CR</Label>
                    <Switch
                      id="editFeatureWorkflowCR"
                      checked={editingTenant.featureWorkflowCR}
                      onCheckedChange={(checked) => setEditingTenant({ ...editingTenant, featureWorkflowCR: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="editFeatureApostilamento">Apostilamento</Label>
                    <Switch
                      id="editFeatureApostilamento"
                      checked={editingTenant.featureApostilamento}
                      onCheckedChange={(checked) => setEditingTenant({ ...editingTenant, featureApostilamento: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="editFeatureRenovacao">Renovação</Label>
                    <Switch
                      id="editFeatureRenovacao"
                      checked={editingTenant.featureRenovacao}
                      onCheckedChange={(checked) => setEditingTenant({ ...editingTenant, featureRenovacao: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="editFeatureInsumos">Insumos</Label>
                    <Switch
                      id="editFeatureInsumos"
                      checked={editingTenant.featureInsumos}
                      onCheckedChange={(checked) => setEditingTenant({ ...editingTenant, featureInsumos: checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setEditingTenant(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateTenant} className="bg-purple-600 hover:bg-purple-700" disabled={updateTenant.isLoading}>
                  {updateTenant.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
