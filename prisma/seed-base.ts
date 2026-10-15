import { PrismaClient, type CompanyAreaType } from "@prisma/client";

const prisma = new PrismaClient();

// Produktions-Grundausstattung: nur die strukturellen Daten, die die
// Anwendung voraussetzt (die zehn festen Unternehmensbereiche, siehe
// README "Datenmodell") und eine sinnvolle Abteilungs-Standardliste.
// Enthält bewusst KEINE Demo-Benutzer, Aufgaben, Projekte o. Ä. – dafür
// gibt es `prisma/seed.ts` (nur für lokale Entwicklung/Tests gedacht).
//
// Aufruf: npm run db:init (siehe DEPLOYMENT.md)

async function main() {
  console.log("Grundausstattung wird angelegt...");

  const departments = await Promise.all(
    ["Geschäftsführung", "Vertrieb", "Produktion", "Verwaltung", "IT"].map((name) =>
      prisma.department.upsert({ where: { name }, update: {}, create: { name } })
    )
  );

  const areaDefs: { type: CompanyAreaType; name: string; description: string }[] = [
    { type: "FINANZEN", name: "Finanzen", description: "Liquidität, Buchhaltung, Controlling" },
    { type: "VERTRIEB", name: "Vertrieb", description: "Kundenakquise, Angebote, Umsatzsteuerung" },
    { type: "MARKETING", name: "Marketing", description: "Markenauftritt, Kampagnen, Website" },
    { type: "PERSONAL", name: "Personal", description: "Recruiting, Mitarbeiterentwicklung" },
    { type: "OPERATIVES", name: "Operatives Geschäft", description: "Produktion, Logistik, Wartung" },
    { type: "KUNDEN", name: "Kunden", description: "Bestandskunden und Key Accounts" },
    { type: "LIEFERANTEN", name: "Lieferanten", description: "Einkauf und Lieferantenbeziehungen" },
    { type: "VERTRAEGE", name: "Verträge", description: "Laufende Verträge und Fristen" },
    { type: "RISIKEN", name: "Risiken", description: "Unternehmensrisiken und Gegenmaßnahmen" },
    { type: "STRATEGISCHE_ZIELE", name: "Strategische Ziele", description: "Mittelfristige Unternehmensziele" },
  ];

  for (const def of areaDefs) {
    await prisma.companyArea.upsert({ where: { type: def.type }, update: {}, create: def });
  }

  console.log(`Abteilungen: ${departments.length}, Unternehmensbereiche: ${areaDefs.length}`);
  console.log(
    'Fertig. Namen/Beschreibungen können jederzeit unter "Unternehmen" in der App angepasst werden.'
  );
  console.log('Nächster Schritt: ersten Benutzer anlegen, z. B. per "npm run user:create".');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
