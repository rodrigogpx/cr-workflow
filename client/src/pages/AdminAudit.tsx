import { useState } from "react";
import { TenantAdminLayout } from "@/components/TenantAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { 
  Shield, 
  Download, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'DOWNLOAD' | 'UPLOAD' | 'EXPORT';
type AuditEntity = 'CLIENT' | 'DOCUMENT' | 'USER' | 'WORKFLOW' | 'SETTINGS' | 'AUTH';

const actionLabels: Record<AuditAction, string> = {
  CREATE: 'Criação',
  UPDATE: 'Atualização',
  DELETE: 'Exclusão',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  DOWNLOAD: 'Download',
  UPLOAD: 'Upload',
  EXPORT: 'Exportação',
};

const entityLabels: Record<AuditEntity, string> = {
  CLIENT: 'Cliente',
  DOCUMENT: 'Documento',
  USER: 'Usuário',
  WORKFLOW: 'Workflow',
  SETTINGS: 'Configurações',
  AUTH: 'Autenticação',
};

const actionColors: Record<AuditAction, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-gray-100 text-gray-800',
  DOWNLOAD: 'bg-yellow-100 text-yellow-800',
  UPLOAD: 'bg-cyan-100 text-cyan-800',
  EXPORT: 'bg-orange-100 text-orange-800',
};

export default function AdminAudit() {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    userId: undefined as number | undefined,
    action: undefined as AuditAction | undefined,
    entity: undefined as AuditEntity | undefined,
  });
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: users } = trpc.users.list.useQuery();

  const { data, isLoading, refetch } = trpc.audit.getLogs.useQuery({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    userId: filters.userId,
    action: filters.action,
    entity: filters.entity,
    limit: pageSize,
    offset: page * pageSize,
  });

  const exportMutation = trpc.audit.exportCsv.useMutation({
    onSuccess: (result) => {
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Relatório exportado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao exportar relatório');
    },
  });

  const handleExport = () => {
    exportMutation.mutate({
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      userId: filters.userId,
      action: filters.action,
      entity: filters.entity,
    });
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      userId: undefined,
      action: undefined,
      entity: undefined,
    });
    setPage(0);
  };

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    try {
      return JSON.parse(details);
    } catch {
      return details;
    }
  };

  return (
    <TenantAdminLayout active="audit">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Relatório de Auditoria
            </h1>
            <p className="text-sm text-muted-foreground">
              Histórico de ações realizadas no sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button 
              size="sm" 
              onClick={handleExport}
              disabled={exportMutation.isPending}
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Início</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => {
                    setFilters(f => ({ ...f, startDate: e.target.value }));
                    setPage(0);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Data Fim</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => {
                    setFilters(f => ({ ...f, endDate: e.target.value }));
                    setPage(0);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Usuário</Label>
                <Select
                  value={filters.userId?.toString() || 'all'}
                  onValueChange={(value) => {
                    setFilters(f => ({ ...f, userId: value === 'all' ? undefined : Number(value) }));
                    setPage(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ação</Label>
                <Select
                  value={filters.action || 'all'}
                  onValueChange={(value) => {
                    setFilters(f => ({ ...f, action: value === 'all' ? undefined : value as AuditAction }));
                    setPage(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Object.entries(actionLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Entidade</Label>
                <Select
                  value={filters.entity || 'all'}
                  onValueChange={(value) => {
                    setFilters(f => ({ ...f, entity: value === 'all' ? undefined : value as AuditEntity }));
                    setPage(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Object.entries(entityLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Logs */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !data?.logs.length ? (
              <div className="text-center py-20 text-muted-foreground">
                Nenhum registro de auditoria encontrado.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead className="w-[120px]">Ação</TableHead>
                      <TableHead className="w-[120px]">Entidade</TableHead>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>Detalhes</TableHead>
                      <TableHead className="w-[120px]">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((log) => {
                      const details = parseDetails(log.details);
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">
                            {formatDate(log.createdAt)}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{log.userName}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={actionColors[log.action as AuditAction] || 'bg-gray-100'}>
                              {actionLabels[log.action as AuditAction] || log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {entityLabels[log.entity as AuditEntity] || log.entity}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.entityId || '-'}
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <span className="text-xs text-muted-foreground truncate block">
                              {typeof details === 'object' 
                                ? JSON.stringify(details)
                                : details || '-'}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.ipAddress || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Paginação */}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {page * pageSize + 1} a {Math.min((page + 1) * pageSize, data.total)} de {data.total} registros
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Página {page + 1} de {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </TenantAdminLayout>
  );
}
