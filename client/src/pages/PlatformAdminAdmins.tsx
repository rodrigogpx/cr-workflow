import { useState } from "react";
import { PlatformAdminLayout } from "@/components/PlatformAdminLayout";
import { AdminList } from "@/components/platform-admin/AdminList";
import { AdminForm } from "@/components/platform-admin/AdminForm";
import { ChangePasswordDialog } from "@/components/platform-admin/ChangePasswordDialog";

export default function PlatformAdminAdmins() {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<any | null>(null);

  function openEdit(admin: any) {
    setEditTarget(admin);
    setFormOpen(true);
  }

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
  }

  return (
    <PlatformAdminLayout active="admins">
      <AdminList
        onEdit={openEdit}
        onChangePassword={admin => setPasswordTarget(admin)}
        onAddNew={openCreate}
      />

      <AdminForm open={formOpen} onClose={closeForm} editTarget={editTarget} />

      <ChangePasswordDialog
        open={!!passwordTarget}
        onClose={() => setPasswordTarget(null)}
        target={passwordTarget}
      />
    </PlatformAdminLayout>
  );
}
