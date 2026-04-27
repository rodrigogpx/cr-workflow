import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  MoreHorizontal,
  Pencil,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { usePlatformAuth } from "@/_core/hooks/usePlatformAuth";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  support: "Suporte",
};

const ROLE_BADGE: Record<string, string> = {
  superadmin:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300",
  admin:
    "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300",
  support:
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
};

interface AdminListProps {
  onEdit: (admin: any) => void;
  onChangePassword: (admin: any) => void;
  onAddNew: () => void;
}

export function AdminList({
  onEdit,
  onChangePassword,
  onAddNew,
}: AdminListProps) {
  const { admin: me, isSuperAdmin } = usePlatformAuth();
  const utils = trpc.useUtils();
  const { data: admins = [], isLoading } = trpc.platformAdmins.list.useQuery();

  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const setStatus = trpc.platformAdmins.setStatus.useMutation({
    onSuccess: () => {
      utils.platformAdmins.list.invalidate();
      toast.success("Status atualizado.");
    },
    onError: (err: any) =>
      toast.error(err?.message ?? "Erro ao atualizar status."),
  });

  const setRole = trpc.platformAdmins.setRole.useMutation({
    onSuccess: () => {
      utils.platformAdmins.list.invalidate();
      toast.success("Role atualizado.");
    },
    onError: (err: any) =>
      toast.error(err?.message ?? "Erro ao atualizar role."),
  });

  const deleteAdmin = trpc.platformAdmins.delete.useMutation({
    onSuccess: () => {
      utils.platformAdmins.list.invalidate();
      toast.success("Administrador removido.");
      setDeleteTarget(null);
    },
    onError: (err: any) =>
      toast.error(err?.message ?? "Erro ao remover administrador."),
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Carregando administradores…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Administradores da Plataforma
          </h2>
          <p className="text-xs text-muted-foreground">
            {admins.length} administrador{admins.length !== 1 ? "es" : ""}{" "}
            cadastrado{admins.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isSuperAdmin && (
          <Button size="sm" onClick={onAddNew}>
            <UserCog className="h-4 w-4 mr-2" />
            Novo Administrador
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  {a.name || "—"}
                  {a.id === (me as any)?.id && (
                    <span className="ml-2 text-[0.65rem] text-muted-foreground">
                      (você)
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {a.email}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center text-[0.7rem] font-semibold px-2 py-0.5 rounded border ${ROLE_BADGE[a.role] ?? ROLE_BADGE["support"]}`}
                  >
                    {ROLE_LABELS[a.role] ?? a.role}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={a.isActive ? "default" : "secondary"}
                    className="text-[0.7rem]"
                  >
                    {a.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onEdit(a)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Editar perfil
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onChangePassword(a)}>
                        <KeyRound className="h-3.5 w-3.5 mr-2" /> Trocar senha
                      </DropdownMenuItem>

                      {isSuperAdmin && a.id !== (me as any)?.id && (
                        <>
                          <DropdownMenuSeparator />
                          {/* Role change */}
                          {a.role !== "superadmin" && (
                            <DropdownMenuItem
                              onClick={() =>
                                setRole.mutate({ id: a.id, role: "superadmin" })
                              }
                            >
                              <ShieldCheck className="h-3.5 w-3.5 mr-2" />{" "}
                              Promover a Superadmin
                            </DropdownMenuItem>
                          )}
                          {a.role !== "admin" && (
                            <DropdownMenuItem
                              onClick={() =>
                                setRole.mutate({ id: a.id, role: "admin" })
                              }
                            >
                              <ShieldCheck className="h-3.5 w-3.5 mr-2" />{" "}
                              Definir como Admin
                            </DropdownMenuItem>
                          )}
                          {a.role !== "support" && (
                            <DropdownMenuItem
                              onClick={() =>
                                setRole.mutate({ id: a.id, role: "support" })
                              }
                            >
                              <ShieldOff className="h-3.5 w-3.5 mr-2" /> Definir
                              como Suporte
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              setStatus.mutate({
                                id: a.id,
                                isActive: !a.isActive,
                              })
                            }
                          >
                            {a.isActive ? (
                              <>
                                <ShieldOff className="h-3.5 w-3.5 mr-2" />{" "}
                                Desativar
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-3.5 w-3.5 mr-2" />{" "}
                                Reativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(a)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Confirm delete */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name || deleteTarget?.email}</strong> será
              removido permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTarget && deleteAdmin.mutate({ id: deleteTarget.id })
              }
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
