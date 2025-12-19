import { TenantAdminLayout } from "@/components/TenantAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Users, Target, Clock, CheckCircle2, Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const { data: users, isLoading: usersLoading } = trpc.users.list.useQuery();
  const { data: clients, isLoading: clientsLoading } = trpc.clients.list.useQuery();

  const operators = users?.filter(u => u.role === 'operator') || [];
  const admins = users?.filter(u => u.role === 'admin') || [];
  const totalUsers = users?.length || 0;
  const totalClients = clients?.length || 0;

  if (usersLoading || clientsLoading) {
    return (
      <TenantAdminLayout active="dashboard">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </TenantAdminLayout>
    );
  }

  return (
    <TenantAdminLayout active="dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel de Administração</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral do seu clube
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Usuários
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalUsers}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {admins.length} admin • {operators.length} operador{operators.length !== 1 ? 'es' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalClients}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Cadastrados no sistema
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Em Andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-600">{totalClients}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Processos ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Concluídos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">0</p>
              <p className="text-xs text-muted-foreground mt-1">
                CRs emitidos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Clientes por operador */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribuição por Operador</CardTitle>
          </CardHeader>
          <CardContent>
            {operators.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum operador cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {operators.map((op) => {
                  const clientCount = clients?.filter(c => c.operatorId === op.id).length || 0;
                  return (
                    <div key={op.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{op.name || op.email}</p>
                        <p className="text-xs text-muted-foreground">{op.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{clientCount}</p>
                        <p className="text-xs text-muted-foreground">clientes</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TenantAdminLayout>
  );
}
