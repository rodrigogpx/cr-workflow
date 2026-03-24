import { PlatformAdminLayout } from "@/components/PlatformAdminLayout";
import UsersPage from "./Users";

export default function PlatformAdminUsers() {
  return (
    <PlatformAdminLayout active="dashboard">
      <UsersPage />
    </PlatformAdminLayout>
  );
}
