import { TenantAdminLayout } from "@/components/TenantAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Users, UserCheck, ArrowRightLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminOperators() {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: number; name: string; operatorId: number | null } | null>(null);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("");

  const { data: operators, isLoading: loadingOperators, refetch: refetchOperators } = trpc.users.listOperatorsWithStats.useQuery();
  const { data: clients, isLoading: loadingClients, refetch: refetchClients } = trpc.users.listClientsForAssignment.useQuery();

  const assignMutation = trpc.users.assignClientToOperator.useMutation({
    onSuccess: () => {
      toast.success("Cliente atribuído com sucesso!");
      setAssignDialogOpen(false);
      setSelectedClient(null);
      setSelectedOperatorId("");
      refetchOperators();
      refetchClients();
    },
    onError: (error) => {
      toast.error(`Erro ao atribuir cliente: ${error.message}`);
    },
  });

  const handleAssign = () => {
    if (!selectedClient || !selectedOperatorId) return;
    assignMutation.mutate({
      clientId: selectedClient.id,
      operatorId: parseInt(selectedOperatorId),
    });
  };

  const openAssignDialog = (client: { id: number; name: string; operatorId: number | null }) => {
    setSelectedClient(client);
    setSelectedOperatorId(client.operatorId?.toString() || "");
    setAssignDialogOpen(true);
  };

  return (
    <TenantAdminLayout active="operators">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operadores</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie operadores e atribua clientes
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Operadores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{operators?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média por Operador</CardTitle>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {operators && operators.length > 0
                  ? Math.round((clients?.length || 0) / operators.length)
                  : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Operators Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Operadores e Clientes Atribuídos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOperators ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead className="text-center">Nº de Clientes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operators?.map((operator) => (
                    <TableRow key={operator.id}>
                      <TableCell className="font-medium">{operator.name}</TableCell>
                      <TableCell>{operator.email}</TableCell>
                      <TableCell>
                        <Badge variant={operator.role === "admin" ? "default" : "secondary"}>
                          {operator.role === "admin" ? "Admin" : "Operador"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-lg px-3 py-1">
                          {operator.clientCount}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Clients Assignment Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-5 w-5" />
              Atribuição de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingClients ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Operador Responsável</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients?.map((client) => {
                    const operator = operators?.find((o) => o.id === client.operatorId);
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.cpf}</TableCell>
                        <TableCell>
                          {operator ? (
                            <span>{operator.name}</span>
                          ) : (
                            <span className="text-muted-foreground italic">Não atribuído</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAssignDialog(client)}
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Atribuir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Cliente a Operador</DialogTitle>
            <DialogDescription>
              Selecione o operador responsável pelo cliente <strong>{selectedClient?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um operador" />
              </SelectTrigger>
              <SelectContent>
                {operators?.map((operator) => (
                  <SelectItem key={operator.id} value={operator.id.toString()}>
                    {operator.name} ({operator.clientCount} clientes)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAssign} disabled={!selectedOperatorId || assignMutation.isPending}>
              {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TenantAdminLayout>
  );
}
