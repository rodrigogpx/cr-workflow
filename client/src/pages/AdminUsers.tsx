import { TenantAdminLayout } from "@/components/TenantAdminLayout";
import UsersPage from "./Users";

export default function AdminUsers() {
  return (
    <TenantAdminLayout active="users">
      <UsersPage />
    </TenantAdminLayout>
  );
}
