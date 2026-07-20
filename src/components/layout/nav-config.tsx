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

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Übersicht",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Arbeit",
    items: [
      { title: "Meine Aufgaben", href: "/tasks/mine", icon: ListChecks },
      { title: "Alle Aufgaben", href: "/tasks/all", icon: ClipboardList },
      { title: "Projekte", href: "/projects", icon: FolderKanban },
      { title: "Entscheidungen", href: "/decisions", icon: Scale },
      { title: "Meetings", href: "/meetings", icon: Presentation },
      { title: "Kalender", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Unternehmen",
    items: [
      { title: "Unternehmen", href: "/company", icon: Building2 },
      { title: "Dokumente", href: "/documents", icon: FileText },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Integrationen", href: "/integrations", icon: Plug },
      { title: "Einstellungen", href: "/settings", icon: Settings },
    ],
  },
];

// Flat list retained for call sites that just need every route (e.g. active-state checks).
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
