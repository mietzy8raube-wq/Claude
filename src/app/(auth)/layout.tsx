import { Building2, ListChecks, Scale, Presentation, Plug } from "lucide-react";

const HIGHLIGHTS = [
  { icon: ListChecks, text: "Aufgaben, Projekte und Meilensteine an einem Ort" },
  { icon: Scale, text: "Entscheidungen mit Optionen, Vor- und Nachteilen dokumentieren" },
  { icon: Presentation, text: "Meetingbeschlüsse direkt in Aufgaben umwandeln" },
  { icon: Plug, text: "Outlook-Kalender und Excel-Im-/Export integriert" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-gradient px-12 py-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]"
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
            <Building2 className="size-4" strokeWidth={2.25} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">GF-Suite</span>
        </div>

        <div className="relative max-w-md">
          <p className="text-[13px] font-semibold tracking-wider text-white/60 uppercase">
            Zentrale Unternehmensübersicht
          </p>
          <h1 className="mt-3 text-[2.1rem] leading-[1.15] font-semibold tracking-tight text-balance">
            Alles Wichtige für die Geschäftsführung, an einem Ort.
          </h1>
          <ul className="mt-8 flex flex-col gap-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-[14.5px] text-white/85">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-white/15">
                  <Icon className="size-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} GF-Suite</p>
      </div>

      <div className="flex items-center justify-center bg-background px-4 py-12 sm:px-8">
        {children}
      </div>
    </div>
  );
}
