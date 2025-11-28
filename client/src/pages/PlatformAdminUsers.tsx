import { PlatformAdminLayout } from "@/components/PlatformAdminLayout";
import UsersPage from "./Users";

export default function PlatformAdminUsers() {
  return (
    <PlatformAdminLayout active="users">
      <UsersPage />
    </PlatformAdminLayout>
  );
}
