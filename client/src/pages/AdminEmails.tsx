import { TenantAdminLayout } from "@/components/TenantAdminLayout";
import EmailTemplates from "./EmailTemplates";

export default function AdminEmails() {
  return (
    <TenantAdminLayout active="emails">
      <EmailTemplates />
    </TenantAdminLayout>
  );
}
