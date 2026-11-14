import type { ComponentType } from "react";
import { Building2Icon, UserRoundIcon } from "lucide-react";
import { EspooMark } from "@/components/espoo-mark";
import type { RoleId } from "@/lib/roles";

export const ROLE_ICON: Record<RoleId, ComponentType<{ className?: string }>> = {
  company: Building2Icon,
  talent: UserRoundIcon,
  organiser: EspooMark,
};
