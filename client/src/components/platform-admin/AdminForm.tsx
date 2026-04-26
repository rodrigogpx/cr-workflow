import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AdminFormProps {
  open: boolean;
  onClose: () => void;
  /** Quando definido, modo edição. Quando null, modo criação. */
  editTarget: any | null;
}

export function AdminForm({ open, onClose, editTarget }: AdminFormProps) {
  const utils = trpc.useUtils();
  const isEdit = Boolean(editTarget);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "admin" as "superadmin" | "admin" | "support",
  });

  useEffect(() => {
    if (editTarget) {
      setForm(f => ({
        ...f,
        name: editTarget.name ?? "",
        email: editTarget.email ?? "",
        role: editTarget.role ?? "admin",
        password: "",
        confirmPassword: "",
      }));
    } else {
      setForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "admin",
      });
    }
  }, [editTarget, open]);

  const createMutation = trpc.platformAdmins.create.useMutation({
    onSuccess: () => {
      utils.platformAdmins.list.invalidate();
      toast.success("Administrador criado com sucesso.");
      onClose();
    },
    onError: (err: any) =>
      toast.error(err?.message ?? "Erro ao criar administrador."),
  });

  const updateMutation = trpc.platformAdmins.update.useMutation({
    onSuccess: () => {
      utils.platformAdmins.list.invalidate();
      toast.success("Perfil atualizado.");
      onClose();
    },
    onError: (err: any) =>
      toast.error(err?.message ?? "Erro ao atualizar perfil."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && form.password !== form.confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (isEdit) {
      updateMutation.mutate({
        id: editTarget.id,
        name: form.name,
        email: form.email,
      });
    } else {
      createMutation.mutate({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Administrador" : "Novo Administrador"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize o nome ou e-mail do administrador."
              : "Preencha os dados para criar um novo administrador de plataforma."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="adm-name">Nome completo</Label>
            <Input
              id="adm-name"
              placeholder="Ex: Maria Oliveira"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              minLength={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adm-email">E-mail</Label>
            <Input
              id="adm-email"
              type="email"
              placeholder="admin@empresa.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>

          {!isEdit && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="adm-role">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={v => setForm(f => ({ ...f, role: v as any }))}
                >
                  <SelectTrigger id="adm-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="support">Suporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adm-pass">Senha (mín. 8 caracteres)</Label>
                <Input
                  id="adm-pass"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e =>
                    setForm(f => ({ ...f, password: e.target.value }))
                  }
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adm-confirm">Confirmar senha</Label>
                <Input
                  id="adm-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={e =>
                    setForm(f => ({ ...f, confirmPassword: e.target.value }))
                  }
                  required
                  minLength={8}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
