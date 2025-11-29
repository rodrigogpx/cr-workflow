import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { APP_LOGO } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Users, UserCheck, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import Footer from "@/components/Footer";

export default function WorkflowAdminOperators() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    setLocation("/cr-workflow");
    return null;
  }

  const roleLabel = user.role === "admin" ? "Administrador" : "Operador";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b-2 border-dashed border-white/20 bg-black sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={APP_LOGO} alt="CAC 360" className="h-12 w-auto" />
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight uppercase">CAC 360 – Gestão de Operadores</h1>
                <p className="text-sm text-white/70">
                  Workflow CR · {roleLabel} · {user.name || user.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/cr-workflow")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 flex-1 space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card/80 backdrop-blur-sm border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Operadores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{operators?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-white/10">
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
        <Card className="bg-card/80 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
                          {operator.role === "admin" ? "Administrador" : "Operador"}
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
        <Card className="bg-card/80 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
                            <span className="text-foreground">{operator.name}</span>
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
      </main>

      <Footer />

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
    </div>
  );
}
