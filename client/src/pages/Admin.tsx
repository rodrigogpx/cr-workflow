import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Target, Users, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Admin() {
  const [, setLocation] = useLocation();

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

  const delegateClientMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      toast.success("Cliente delegado com sucesso!");
      refetchClients();
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  if (usersLoading || clientsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const operators = users?.filter(u => u.role === 'operator') || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">Administração</h1>
              <p className="text-sm text-muted-foreground">
                Gerenciamento de usuários e delegação de clientes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Admin</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciamento de Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users?.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{u.name || u.email}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Select
                      value={u.role}
                      onValueChange={(value) => {
                        updateRoleMutation.mutate({
                          userId: u.id,
                          role: value as 'operator' | 'admin',
                        });
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operator">Operador</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Delegação de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clients?.map((client) => {
                const currentOperator = users?.find(u => u.id === client.operatorId);
                
                return (
                  <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground">{client.cpf}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        Operador atual: {currentOperator?.name || currentOperator?.email || 'Não atribuído'}
                      </span>
                      <Select
                        value={client.operatorId?.toString() || ''}
                        onValueChange={(value) => {
                          delegateClientMutation.mutate({
                            id: client.id,
                            operatorId: parseInt(value),
                          });
                        }}
                      >
                        <SelectTrigger className="w-[200px]">
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
