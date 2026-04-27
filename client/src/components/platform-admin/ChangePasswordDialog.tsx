import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { usePlatformAuth } from "@/_core/hooks/usePlatformAuth";

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  target: any | null;
}

export function ChangePasswordDialog({
  open,
  onClose,
  target,
}: ChangePasswordDialogProps) {
  const { admin: me, isSuperAdmin } = usePlatformAuth();
  const isSelf = (me as any)?.id === target?.id;
  const requireCurrentPassword = isSelf; // superadmin editing others doesn't need current password

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (open)
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }, [open]);

  const mutation = trpc.platformAdmins.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso.");
      onClose();
    },
    onError: (err: any) =>
      toast.error(err?.message ?? "Erro ao alterar senha."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    mutation.mutate({
      id: target.id,
      newPassword: form.newPassword,
      currentPassword: requireCurrentPassword
        ? form.currentPassword
        : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Trocar Senha</DialogTitle>
          <DialogDescription>
            {isSelf
              ? "Informe a senha atual e a nova senha desejada."
              : `Defina uma nova senha para ${target?.name || target?.email}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {requireCurrentPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="cp-current">Senha atual</Label>
              <Input
                id="cp-current"
                type="password"
                placeholder="••••••••"
                value={form.currentPassword}
                onChange={e =>
                  setForm(f => ({ ...f, currentPassword: e.target.value }))
                }
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cp-new">Nova senha (mín. 8 caracteres)</Label>
            <Input
              id="cp-new"
              type="password"
              placeholder="••••••••"
              value={form.newPassword}
              onChange={e =>
                setForm(f => ({ ...f, newPassword: e.target.value }))
              }
              required
              minLength={8}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Confirmar nova senha</Label>
            <Input
              id="cp-confirm"
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
