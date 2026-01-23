import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Target, Users, Shield, TrendingUp, Clock, CheckCircle2, Mail, Building2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const tenantSlug = useTenantSlug();

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = trpc.users.list.useQuery();
  const { data: clients, isLoading: clientsLoading, refetch: refetchClients } = trpc.clients.list.useQuery();

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      refetchUsers();
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const delegateClientMutation = trpc.clients.delegateOperator.useMutation({
    onSuccess: () => {
      toast.success("Cliente delegado com sucesso!");
      refetchClients();
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  if (authLoading || usersLoading || clientsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground uppercase text-sm tracking-wide">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    setLocation(buildTenantPath(tenantSlug, "/dashboard"));
    return null;
  }

  const operators = users?.filter(u => u.role === 'operator') || [];
  const admins = users?.filter(u => u.role === 'admin') || [];
  const totalUsers = users?.length || 0;
  const totalClients = clients?.length || 0;
  
  // Calcular clientes por operador
  const clientsByOperator = operators.map(op => ({
    operator: op,
    count: clients?.filter(c => c.operatorId === op.id).length || 0
  }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f0f0' }}>
      {/* Header com estilo Firing Range */}
      <header className="border-b-2 border-dashed border-white/20 bg-black sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={buildTenantPath(tenantSlug, "/dashboard")}>
                <Button variant="ghost" size="icon" className="text-white hover:text-primary">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Administração</h1>
                <p className="text-sm text-muted-foreground">Gerenciamento de usuários e delegação</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-primary/40 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold uppercase text-primary">Admin</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {/* Cards de Acesso Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-2 border-dashed border-primary/40 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg border-2 border-dashed border-primary/40 bg-primary/10 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm" style={{ color: '#575757' }}>Templates de Email</h3>
                    <p className="text-xs text-muted-foreground">Edite os templates de email enviados aos clientes</p>
                  </div>
                </div>
                <Button
                  onClick={() => setLocation(buildTenantPath(tenantSlug, "/platform-admin/email-templates"))}
                  className="bg-primary hover:bg-primary/90 border-2 border-dashed border-white/40 font-bold uppercase tracking-wide"
                >
                  Gerenciar →
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-dashed border-primary/40 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg border-2 border-dashed border-primary/40 bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm" style={{ color: '#575757' }}>Usuários do Sistema</h3>
                    <p className="text-xs text-muted-foreground">Gerencie e exclua usuários do sistema</p>
                  </div>
                </div>
                <Button
                  onClick={() => setLocation(buildTenantPath(tenantSlug, "/platform-admin/users"))}
                  className="bg-primary hover:bg-primary/90 border-2 border-dashed border-white/40 font-bold uppercase tracking-wide"
                >
                  Gerenciar →
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-dashed border-purple-500/40 bg-purple-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg border-2 border-dashed border-purple-500/40 bg-purple-500/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-sm" style={{ color: '#575757' }}>Multi-Tenant</h3>
                    <p className="text-xs text-muted-foreground">Gerencie clubes e tenants da plataforma</p>
                  </div>
                </div>
                <Button
                  onClick={() => setLocation("/super-admin/tenants")}
                  className="bg-purple-600 hover:bg-purple-700 border-2 border-dashed border-white/40 font-bold uppercase tracking-wide"
                >
                  Gerenciar →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Estatísticas Globais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-2 border-dashed border-white/20 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total de Usuários
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold" style={{ color: '#5a5858', textAlign: 'center' }}>{totalUsers}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {admins.length} admin{admins.length !== 1 ? 's' : ''} • {operators.length} operador{operators.length !== 1 ? 'es' : ''}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-dashed border-white/20 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Total de Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold" style={{ color: '#5a5858', textAlign: 'center' }}>{totalClients}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Distribuídos entre operadores
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-dashed border-white/20 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Em Andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-yellow-500" style={{ textAlign: 'center' }}>{totalClients}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Processos ativos
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-dashed border-white/20 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Concluídos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-500" style={{ textAlign: 'center' }}>0</p>
              <p className="text-xs text-muted-foreground mt-2">
                CRs emitidos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gerenciamento de Usuários */}
        <Card className="border-2 border-dashed border-white/20 bg-card">
          <CardHeader>
            <CardTitle className="uppercase text-sm tracking-wide flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Gerenciamento de Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users?.map((u) => (
                <div 
                  key={u.id} 
                  className="flex items-center justify-between p-4 border-2 border-dashed border-white/10 rounded-lg bg-background/50 hover:border-primary/40 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg border-2 border-dashed flex items-center justify-center ${
                      !u.role ? 'border-yellow-500/40 bg-yellow-500/10' :
                      u.role === 'admin' ? 'border-primary/40 bg-primary/10' : 
                      u.role === 'despachante' ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/20 bg-muted'
                    }`}>
                      {!u.role ? (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      ) : u.role === 'admin' ? (
                        <Shield className="h-5 w-5 text-primary" />
                      ) : u.role === 'despachante' ? (
                        <Users className="h-5 w-5 text-blue-500" />
                      ) : (
                        <Users className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold uppercase text-sm">{u.name || u.email}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Select
                      value={u.role || "pending"}
                      onValueChange={(value) => {
                        if (value === "pending") return;
                        updateRoleMutation.mutate({
                          userId: u.id,
                          role: value as 'operator' | 'admin' | 'despachante',
                        });
                      }}
                    >
                      <SelectTrigger className="w-[180px] border-2 border-dashed border-white/20 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending" disabled>
                          Aguardando Aprovação
                        </SelectItem>
                        <SelectItem value="operator">Operador</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="despachante">Despachante</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Distribuição de Clientes por Operador */}
        <Card className="border-2 border-dashed border-white/20 bg-card">
          <CardHeader>
            <CardTitle className="uppercase text-sm tracking-wide flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Distribuição de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clientsByOperator.map(({ operator, count }) => (
                <div 
                  key={operator.id}
                  className="flex items-center justify-between p-4 border-2 border-dashed border-white/10 rounded-lg bg-background/50"
                >
                  <div>
                    <p className="font-bold uppercase text-sm">{operator.name || operator.email}</p>
                    <p className="text-xs text-muted-foreground">{operator.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{count}</p>
                    <p className="text-xs text-muted-foreground uppercase">Cliente{count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Delegação de Clientes */}
        <Card className="border-2 border-dashed border-white/20 bg-card">
          <CardHeader>
            <CardTitle className="uppercase text-sm tracking-wide flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Delegação de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clients?.map((client) => {
                const currentOperator = users?.find(u => u.id === client.operatorId);
                
                return (
                  <div 
                    key={client.id} 
                    className="flex items-center justify-between p-4 border-2 border-dashed border-white/10 rounded-lg bg-background/50 hover:border-primary/40 transition-all"
                  >
                    <div>
                      <p className="font-bold uppercase text-sm">{client.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{client.cpf}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase">Operador Atual</p>
                        <p className="text-sm font-bold">{currentOperator?.name || currentOperator?.email || 'Não atribuído'}</p>
                      </div>
                      <Select
                        value={client.operatorId?.toString() || ''}
                        onValueChange={(value) => {
                          delegateClientMutation.mutate({
                            id: client.id,
                            operatorId: parseInt(value),
                          });
                        }}
                      >
                        <SelectTrigger className="w-[200px] border-2 border-dashed border-white/20 bg-background">
                          <SelectValue placeholder="Selecionar operador" />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map((op) => (
                            <SelectItem key={op.id} value={op.id.toString()}>
                              {op.name || op.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
