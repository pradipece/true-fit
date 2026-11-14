import { Building2Icon, UserRoundIcon } from "lucide-react";
import type { RoleId } from "@/lib/roles";

export const ROLE_ICON: Record<RoleId, typeof Building2Icon> = {
  company: Building2Icon,
  talent: UserRoundIcon,
};
