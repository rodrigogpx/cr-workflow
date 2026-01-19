import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users as UsersIcon, Trash2, Shield, User, Edit2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Schema de criação de usuário
const createUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  role: z.enum(["operator", "admin", "despachante"], {
    errorMap: () => ({ message: "Selecione um perfil válido" }),
  }),
});

// Schema de edição de usuário
const updateUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional().or(z.literal("")),
  role: z.enum(["operator", "admin", "despachante"]).optional(),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;
type UpdateUserFormValues = z.infer<typeof updateUserSchema>;

export default function Users() {
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'operator' | 'despachante' | 'pending'>("all");

  // Form para criação
  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "operator",
    },
  });

  // Form para edição
  const editForm = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "operator",
    },
  });
  
  const getFriendlyErrorMessage = (error: any, fallback: string) => {
    const message = error?.message;
    if (typeof message === "string" && message.trim()) {
      try {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed)) {
          const messages = parsed
            .map((item) => (item && typeof item.message === "string" ? item.message : null))
            .filter((m): m is string => !!m);
          if (messages.length > 0) {
            return messages.join("\n");
          }
        }
      } catch {
        return message;
      }
      return message;
    }
    return fallback;
  };

  const { data: users, refetch } = trpc.users.list.useQuery();
  const { data: currentUser } = trpc.auth.me.useQuery();
  
  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso");
      refetch();
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      toast.error(getFriendlyErrorMessage(error, "Erro ao criar usuário"));
    },
  });

  const updateUserMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso");
      refetch();
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast.error(getFriendlyErrorMessage(error, "Erro ao atualizar usuário"));
    },
  });

  const deleteUserMutation = trpc.users.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário excluído com sucesso");
      refetch();
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast.error(getFriendlyErrorMessage(error, "Erro ao excluir usuário"));
    },
  });

  const openCreateDialog = () => {
    createForm.reset({ name: "", email: "", password: "", role: "operator" });
    setIsCreateOpen(true);
  };

  const openEditDialog = (user: any) => {
    setEditingUser(user);
    editForm.reset({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "operator",
      password: "",
    });
  };

  const handleSubmitCreate = (data: CreateUserFormValues) => {
    createUserMutation.mutate({
      name: data.name.trim(),
      email: data.email.trim(),
      password: data.password,
      role: data.role,
    });
  };

  const handleSubmitEdit = (data: UpdateUserFormValues) => {
    if (!editingUser) return;

    updateUserMutation.mutate({
      userId: editingUser.id,
      name: data.name?.trim() || undefined,
      email: data.email?.trim() || undefined,
      role: data.role || undefined,
      password: data.password?.trim() || undefined,
    });
  };

  const handleDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate({ userId: userToDelete });
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const admins = users?.filter((u) => u.role === 'admin') ?? [];

  const filteredUsers = (users ?? []).filter((user) => {
    if (roleFilter === 'all') return true;
    if (roleFilter === 'pending') return !user.role;
    return user.role === roleFilter;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <UsersIcon className="h-6 w-6 text-blue-600" />
                <CardTitle>Gerenciamento de Usuários</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={roleFilter}
                  onValueChange={(value) => setRoleFilter(value as 'all' | 'admin' | 'operator' | 'pending')}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="admin">Administradores</SelectItem>
                    <SelectItem value="operator">Operadores</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={openCreateDialog} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Usuário
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Último Acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const isLastAdmin = admins.length === 1 && admins[0].id === user.id;

                  return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.id === currentUser?.id && (
                          <Badge variant="outline" className="text-xs">
                            Você
                          </Badge>
                        )}
                        {user.name}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.role === 'admin' ? (
                        <Badge className="bg-purple-600">
                          <Shield className="h-3 w-3 mr-1" />
                          Administrador
                        </Badge>
                      ) : user.role === 'operator' ? (
                        <Badge variant="secondary">
                          <User className="h-3 w-3 mr-1" />
                          Operador
                        </Badge>
                      ) : user.role === 'despachante' ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                          <User className="h-3 w-3 mr-1" />
                          Despachante
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      {user.lastSignedIn ? formatDate(user.lastSignedIn) : '-'}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                        className="mr-1"
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUserToDelete(user.id)}
                        disabled={user.id === currentUser?.id || isLastAdmin}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
                })}
              </TableBody>
            </Table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <UsersIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>Nenhum usuário encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Criação de Usuário */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) createForm.reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleSubmitCreate)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                {...createForm.register("name")}
                className={createForm.formState.errors.name ? "border-red-500" : ""}
              />
              {createForm.formState.errors.name && (
                <p className="text-sm text-red-500">{createForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...createForm.register("email")}
                className={createForm.formState.errors.email ? "border-red-500" : ""}
              />
              {createForm.formState.errors.email && (
                <p className="text-sm text-red-500">{createForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Perfil</Label>
              <Select
                value={createForm.watch("role") || "operator"}
                onValueChange={(value) => createForm.setValue("role", value as "operator" | "admin" | "despachante")}
              >
                <SelectTrigger className={createForm.formState.errors.role ? "border-red-500" : ""}>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="despachante">Despachante</SelectItem>
                </SelectContent>
              </Select>
              {createForm.formState.errors.role && (
                <p className="text-sm text-red-500">{createForm.formState.errors.role.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                {...createForm.register("password")}
                className={createForm.formState.errors.password ? "border-red-500" : ""}
              />
              {createForm.formState.errors.password && (
                <p className="text-sm text-red-500">{createForm.formState.errors.password.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Usuário */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) { setEditingUser(null); editForm.reset(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleSubmitEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                {...editForm.register("name")}
                className={editForm.formState.errors.name ? "border-red-500" : ""}
              />
              {editForm.formState.errors.name && (
                <p className="text-sm text-red-500">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                {...editForm.register("email")}
                className={editForm.formState.errors.email ? "border-red-500" : ""}
              />
              {editForm.formState.errors.email && (
                <p className="text-sm text-red-500">{editForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Perfil</Label>
              <Select
                value={editForm.watch("role") || "operator"}
                onValueChange={(value) => editForm.setValue("role", value as "operator" | "admin" | "despachante")}
              >
                <SelectTrigger className={editForm.formState.errors.role ? "border-red-500" : ""}>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="despachante">Despachante</SelectItem>
                </SelectContent>
              </Select>
              {editForm.formState.errors.role && (
                <p className="text-sm text-red-500">{editForm.formState.errors.role.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Senha (deixe em branco para não alterar)</Label>
              <Input
                id="edit-password"
                type="password"
                {...editForm.register("password")}
                className={editForm.formState.errors.password ? "border-red-500" : ""}
              />
              {editForm.formState.errors.password && (
                <p className="text-sm text-red-500">{editForm.formState.errors.password.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={userToDelete !== null} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
              O usuário perderá acesso ao sistema imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir Usuário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
