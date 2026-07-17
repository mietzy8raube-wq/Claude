import {
  LayoutDashboard,
  ListChecks,
  ClipboardList,
  FolderKanban,
  Scale,
  Building2,
  Presentation,
  CalendarDays,
  FileText,
  Plug,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Meine Aufgaben", href: "/tasks/mine", icon: ListChecks },
  { title: "Alle Aufgaben", href: "/tasks/all", icon: ClipboardList },
  { title: "Projekte", href: "/projects", icon: FolderKanban },
  { title: "Entscheidungen", href: "/decisions", icon: Scale },
  { title: "Unternehmen", href: "/company", icon: Building2 },
  { title: "Meetings", href: "/meetings", icon: Presentation },
  { title: "Kalender", href: "/calendar", icon: CalendarDays },
  { title: "Dokumente", href: "/documents", icon: FileText },
  { title: "Integrationen", href: "/integrations", icon: Plug },
  { title: "Einstellungen", href: "/settings", icon: Settings },
];
