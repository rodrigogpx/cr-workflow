import { PlatformAdminLayout } from "@/components/PlatformAdminLayout";
import EmailTemplates from "./EmailTemplates";

export default function PlatformAdminEmailTemplates() {
  return (
    <PlatformAdminLayout active="emails">
      <EmailTemplates />
    </PlatformAdminLayout>
  );
}
