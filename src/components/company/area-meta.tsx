import {
  Landmark,
  TrendingUp,
  Megaphone,
  Users,
  Cog,
  Handshake,
  Truck,
  FileSignature,
  ShieldAlert,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { CompanyAreaType } from "@prisma/client";

export const AREA_ICON: Record<CompanyAreaType, LucideIcon> = {
  FINANZEN: Landmark,
  VERTRIEB: TrendingUp,
  MARKETING: Megaphone,
  PERSONAL: Users,
  OPERATIVES: Cog,
  KUNDEN: Handshake,
  LIEFERANTEN: Truck,
  VERTRAEGE: FileSignature,
  RISIKEN: ShieldAlert,
  STRATEGISCHE_ZIELE: Target,
};
