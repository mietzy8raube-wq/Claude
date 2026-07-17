import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seed wird gestartet...");

  const passwordHash = await bcrypt.hash("Passwort123!", 12);

  const anna = await prisma.user.upsert({
    where: { email: "anna.mueller@druckluft-chemnitz.de" },
    update: {},
    create: {
      name: "Anna Müller",
      email: "anna.mueller@druckluft-chemnitz.de",
      passwordHash,
      role: "GESCHAEFTSFUEHRER",
    },
  });

  const thomas = await prisma.user.upsert({
    where: { email: "thomas.weber@druckluft-chemnitz.de" },
    update: {},
    create: {
      name: "Thomas Weber",
      email: "thomas.weber@druckluft-chemnitz.de",
      passwordHash,
      role: "GESCHAEFTSFUEHRER",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@druckluft-chemnitz.de" },
    update: {},
    create: {
      name: "System Administrator",
      email: "admin@druckluft-chemnitz.de",
      passwordHash,
      role: "ADMINISTRATOR",
    },
  });

  console.log("Benutzer angelegt:", anna.email, thomas.email, admin.email);

  const departments = await Promise.all(
    ["Geschäftsführung", "Vertrieb", "Produktion", "Verwaltung", "IT"].map((name) =>
      prisma.department.upsert({ where: { name }, update: {}, create: { name } })
    )
  );
  const [deptGF, deptVertrieb, deptProduktion, deptVerwaltung, deptIT] = departments;

  // ---------------------------------------------------------------------
  // Unternehmensbereiche
  // ---------------------------------------------------------------------
  const areaDefs: { type: any; name: string; description: string; responsibleId: string }[] = [
    { type: "FINANZEN", name: "Finanzen", description: "Liquidität, Buchhaltung, Controlling", responsibleId: anna.id },
    { type: "VERTRIEB", name: "Vertrieb", description: "Kundenakquise, Angebote, Umsatzsteuerung", responsibleId: thomas.id },
    { type: "MARKETING", name: "Marketing", description: "Markenauftritt, Kampagnen, Website", responsibleId: thomas.id },
    { type: "PERSONAL", name: "Personal", description: "Recruiting, Mitarbeiterentwicklung", responsibleId: anna.id },
    { type: "OPERATIVES", name: "Operatives Geschäft", description: "Produktion, Logistik, Wartung", responsibleId: thomas.id },
    { type: "KUNDEN", name: "Kunden", description: "Bestandskunden und Key Accounts", responsibleId: thomas.id },
    { type: "LIEFERANTEN", name: "Lieferanten", description: "Einkauf und Lieferantenbeziehungen", responsibleId: anna.id },
    { type: "VERTRAEGE", name: "Verträge", description: "Laufende Verträge und Fristen", responsibleId: anna.id },
    { type: "RISIKEN", name: "Risiken", description: "Unternehmensrisiken und Gegenmaßnahmen", responsibleId: anna.id },
    { type: "STRATEGISCHE_ZIELE", name: "Strategische Ziele", description: "Mittelfristige Unternehmensziele", responsibleId: anna.id },
  ];

  const areas: Record<string, Awaited<ReturnType<typeof prisma.companyArea.upsert>>> = {};
  for (const def of areaDefs) {
    areas[def.type] = await prisma.companyArea.upsert({
      where: { type: def.type },
      update: {},
      create: def,
    });
  }

  await prisma.companyMetric.createMany({
    data: [
      { companyAreaId: areas.FINANZEN.id, name: "Umsatz", value: 482000, unit: "EUR", target: 520000, period: "2026-06" },
      { companyAreaId: areas.FINANZEN.id, name: "Liquidität", value: 156000, unit: "EUR", target: 150000, period: "2026-06" },
      { companyAreaId: areas.FINANZEN.id, name: "EBIT-Marge", value: 12.4, unit: "%", target: 15, period: "2026-06" },
      { companyAreaId: areas.VERTRIEB.id, name: "Neue Aufträge", value: 18, unit: "Stk.", target: 20, period: "2026-06" },
      { companyAreaId: areas.VERTRIEB.id, name: "Angebotsquote", value: 34, unit: "%", target: 40, period: "2026-06" },
      { companyAreaId: areas.PERSONAL.id, name: "Mitarbeiterzahl", value: 47, unit: "Personen", target: 50, period: "2026-06" },
      { companyAreaId: areas.PERSONAL.id, name: "Krankenquote", value: 4.1, unit: "%", target: 4, period: "2026-06" },
      { companyAreaId: areas.OPERATIVES.id, name: "Auslastung Produktion", value: 87, unit: "%", target: 90, period: "2026-06" },
    ],
    skipDuplicates: true,
  });

  await prisma.companyNote.createMany({
    data: [
      { companyAreaId: areas.FINANZEN.id, authorId: anna.id, content: "Liquiditätsplanung für Q3 zeigt stabilen Verlauf, Investition in neue Anlage kann finanziert werden." },
      { companyAreaId: areas.VERTRIEB.id, authorId: thomas.id, content: "Neuer Rahmenvertrag mit Automotive-Kunde in Verhandlung, Abschluss bis Ende Juli angestrebt." },
    ],
  });

  const contact1 = await prisma.contact.create({
    data: {
      type: "KUNDE",
      name: "Sächsische Fahrzeugwerke GmbH",
      company: "Sächsische Fahrzeugwerke GmbH",
      email: "einkauf@saechsische-fahrzeugwerke.example",
      phone: "+49 371 555010",
      notes: "Key Account, Rahmenvertrag seit 2022.",
      responsibleId: thomas.id,
      companyAreaId: areas.KUNDEN.id,
    },
  });

  const contact2 = await prisma.contact.create({
    data: {
      type: "LIEFERANT",
      name: "Meier Kompressorenbau",
      company: "Meier Kompressorenbau KG",
      email: "vertrieb@meier-kompressoren.example",
      phone: "+49 351 555221",
      notes: "Hauptlieferant für Kompressorenkomponenten.",
      responsibleId: anna.id,
      companyAreaId: areas.LIEFERANTEN.id,
    },
  });

  // ---------------------------------------------------------------------
  // Projekte
  // ---------------------------------------------------------------------
  const project1 = await prisma.project.create({
    data: {
      name: "Einführung neue Kompressorenlinie",
      description: "Aufbau und Inbetriebnahme einer neuen Produktionslinie für Industriekompressoren.",
      status: "LAUFEND",
      progress: 62,
      startDate: new Date("2026-03-01"),
      targetDate: new Date("2026-10-31"),
      ownerId: thomas.id,
      budget: 380000,
      budgetSpent: 210000,
      participants: { create: [{ userId: anna.id }, { userId: thomas.id }] },
      milestones: {
        create: [
          { title: "Anlagenbestellung abgeschlossen", dueDate: new Date("2026-04-15"), isDone: true, position: 0 },
          { title: "Hallenumbau fertiggestellt", dueDate: new Date("2026-07-01"), isDone: true, position: 1 },
          { title: "Testbetrieb", dueDate: new Date("2026-09-01"), isDone: false, position: 2 },
          { title: "Serienproduktion", dueDate: new Date("2026-10-31"), isDone: false, position: 3 },
        ],
      },
      risks: {
        create: [
          { title: "Lieferverzug Anlagenbauer", description: "Möglicher Verzug bei Lieferung der Hauptkomponenten.", impact: "HOCH", status: "IN_BEOBACHTUNG", mitigation: "Wöchentliches Update mit Lieferant." },
        ],
      },
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: "Digitalisierung Auftragsabwicklung",
      description: "Einführung eines digitalen Workflows für Angebote, Aufträge und Rechnungen.",
      status: "GEPLANT",
      progress: 15,
      startDate: new Date("2026-08-01"),
      targetDate: new Date("2027-02-28"),
      ownerId: anna.id,
      budget: 65000,
      budgetSpent: 4000,
      participants: { create: [{ userId: anna.id }] },
      milestones: {
        create: [
          { title: "Anforderungsanalyse", dueDate: new Date("2026-08-31"), isDone: false, position: 0 },
          { title: "Auswahl Softwarepartner", dueDate: new Date("2026-10-15"), isDone: false, position: 1 },
        ],
      },
    },
  });

  const project3 = await prisma.project.create({
    data: {
      name: "Zertifizierung ISO 9001 Rezertifizierung",
      description: "Vorbereitung und Durchführung des Rezertifizierungsaudits.",
      status: "ABGESCHLOSSEN",
      progress: 100,
      startDate: new Date("2025-11-01"),
      targetDate: new Date("2026-02-28"),
      ownerId: anna.id,
      budget: 12000,
      budgetSpent: 11200,
      participants: { create: [{ userId: anna.id }, { userId: thomas.id }] },
    },
  });

  // ---------------------------------------------------------------------
  // Entscheidungen
  // ---------------------------------------------------------------------
  const decision1 = await prisma.decision.create({
    data: {
      title: "Investition in zweite Produktionslinie",
      description: "Entscheidung über zusätzliche Kapazitätserweiterung am Standort Chemnitz.",
      background: "Auftragslage übersteigt seit 6 Monaten die verfügbare Kapazität.",
      responsibleId: anna.id,
      decisionDeadline: new Date("2026-08-15"),
      status: "ENTSCHEIDUNG_ERFORDERLICH",
      projectId: project1.id,
      options: {
        create: [
          { title: "Erweiterung am Standort Chemnitz", pros: "Kurze Wege, bestehende Infrastruktur", cons: "Begrenzte Flächenreserven", position: 0 },
          { title: "Neuer Standort in Industriegebiet Süd", pros: "Mehr Platz für Wachstum", cons: "Hohe Anfangsinvestition, längere Anfahrtswege", position: 1 },
        ],
      },
      comments: {
        create: [{ authorId: thomas.id, content: "Ich tendiere zur Erweiterung am Standort, Grundstück Süd sollten wir trotzdem als Option 2027 im Blick behalten." }],
      },
    },
  });

  const decision2 = await prisma.decision.create({
    data: {
      title: "Wechsel des Lohnbuchhaltungs-Dienstleisters",
      description: "Prüfung eines Anbieterwechsels aufgrund steigender Kosten.",
      background: "Aktueller Dienstleister hat Preise um 22% erhöht.",
      responsibleId: anna.id,
      status: "DISKUSSION",
      options: {
        create: [
          { title: "Beim aktuellen Anbieter bleiben", pros: "Keine Umstellung nötig", cons: "Höhere laufende Kosten", position: 0 },
          { title: "Wechsel zu neuem Anbieter", pros: "Kostenersparnis ca. 15%", cons: "Umstellungsaufwand", position: 1 },
        ],
      },
    },
  });

  // ---------------------------------------------------------------------
  // Meetings
  // ---------------------------------------------------------------------
  const meeting1 = await prisma.meeting.create({
    data: {
      title: "Geschäftsführungsmeeting KW 29",
      meetingDate: new Date("2026-07-14T09:00:00.000Z"),
      location: "Konferenzraum 1 / Teams",
      notes: "Schwerpunkt: Fortschritt Kompressorenlinie, Personalplanung H2.",
      createdById: anna.id,
      agendaItems: {
        create: [
          { title: "Projektstatus Kompressorenlinie", position: 0 },
          { title: "Personalplanung 2. Halbjahr", position: 1 },
          { title: "Liquiditätsplanung Q3", position: 2 },
        ],
      },
      attendees: {
        create: [
          { userId: anna.id, name: "Anna Müller", email: anna.email },
          { userId: thomas.id, name: "Thomas Weber", email: thomas.email },
        ],
      },
      resolutions: {
        create: [
          {
            title: "Zusätzliche Schicht ab August",
            description: "Einführung einer dritten Schicht zur Kapazitätssteigerung ab 1. August.",
            responsibleId: thomas.id,
            dueDate: new Date("2026-08-01"),
          },
        ],
      },
    },
  });

  // ---------------------------------------------------------------------
  // Aufgaben
  // ---------------------------------------------------------------------
  const task1 = await prisma.task.create({
    data: {
      title: "Angebot Sächsische Fahrzeugwerke finalisieren",
      description: "Preiskalkulation abschließen und Angebot bis Freitag versenden.",
      assigneeId: thomas.id,
      createdById: anna.id,
      priority: "HOCH",
      status: "IN_BEARBEITUNG",
      visibility: "GEMEINSAM",
      dueDate: new Date("2026-07-18"),
      projectId: null,
      departmentId: deptVertrieb.id,
      companyAreaId: areas.VERTRIEB.id,
      category: "Vertrieb",
      participants: { create: [{ userId: thomas.id }] },
      checklistItems: {
        create: [
          { title: "Kalkulation prüfen", isDone: true, position: 0 },
          { title: "Rabattstaffel abstimmen", isDone: false, position: 1 },
          { title: "Angebot an Kunden senden", isDone: false, position: 2 },
        ],
      },
      comments: { create: [{ authorId: anna.id, content: "Bitte Rabatt maximal 4% ansetzen." }] },
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: "Hallenumbau abnehmen",
      description: "Bauabnahme mit Bauleiter durchführen und Mängelprotokoll erstellen.",
      assigneeId: thomas.id,
      createdById: thomas.id,
      priority: "KRITISCH",
      status: "ZUR_PRUEFUNG",
      visibility: "GEMEINSAM",
      dueDate: new Date("2026-07-10"),
      projectId: project1.id,
      departmentId: deptProduktion.id,
      category: "Bau",
      participants: { create: [{ userId: anna.id }, { userId: thomas.id }] },
    },
  });

  const task3 = await prisma.task.create({
    data: {
      title: "Lohnbuchhaltungs-Angebote einholen",
      description: "Drei Vergleichsangebote von alternativen Dienstleistern einholen.",
      assigneeId: anna.id,
      createdById: anna.id,
      priority: "MITTEL",
      status: "OFFEN",
      visibility: "PERSOENLICH",
      dueDate: new Date("2026-07-25"),
      decisionId: decision2.id,
      departmentId: deptVerwaltung.id,
      companyAreaId: areas.FINANZEN.id,
      category: "Verwaltung",
    },
  });

  const task4 = await prisma.task.create({
    data: {
      title: "IT-Sicherheitsaudit vorbereiten",
      description: "Unterlagen für externes IT-Sicherheitsaudit zusammenstellen.",
      assigneeId: anna.id,
      createdById: admin.id,
      priority: "MITTEL",
      status: "OFFEN",
      visibility: "GEMEINSAM",
      dueDate: new Date("2026-08-05"),
      departmentId: deptIT.id,
      category: "IT",
    },
  });

  const task5 = await prisma.task.create({
    data: {
      title: "Quartalszahlen für Bank aufbereiten",
      description: "Zusammenfassung der Q2-Zahlen für das Bankgespräch am 22.07.",
      assigneeId: anna.id,
      createdById: anna.id,
      priority: "HOCH",
      status: "OFFEN",
      visibility: "PERSOENLICH",
      dueDate: new Date("2026-07-16"),
      companyAreaId: areas.FINANZEN.id,
      departmentId: deptGF.id,
      category: "Finanzen",
    },
  });

  const task6 = await prisma.task.create({
    data: {
      title: "Recruiting Produktionsmitarbeiter (2 Stellen)",
      description: "Stellenausschreibung schalten und erste Bewerbungsgespräche koordinieren.",
      assigneeId: thomas.id,
      createdById: anna.id,
      priority: "HOCH",
      status: "IN_BEARBEITUNG",
      visibility: "GEMEINSAM",
      dueDate: new Date("2026-07-30"),
      departmentId: deptProduktion.id,
      companyAreaId: areas.PERSONAL.id,
      category: "Personal",
    },
  });

  const task7 = await prisma.task.create({
    data: {
      title: "Wartungsvertrag Kompressoren verlängern",
      description: "Verlängerungsangebot des Wartungspartners prüfen und unterschreiben.",
      assigneeId: anna.id,
      createdById: anna.id,
      priority: "NIEDRIG",
      status: "ERLEDIGT",
      visibility: "GEMEINSAM",
      dueDate: new Date("2026-06-30"),
      companyAreaId: areas.VERTRAEGE.id,
      category: "Verträge",
    },
  });

  const task8 = await prisma.task.create({
    data: {
      title: "Newsletter Sommerausgabe erstellen",
      description: "Halbjahresrückblick und Projektupdate für Kunden-Newsletter verfassen.",
      assigneeId: thomas.id,
      createdById: thomas.id,
      priority: "NIEDRIG",
      status: "BLOCKIERT",
      visibility: "GEMEINSAM",
      dueDate: new Date("2026-07-05"),
      companyAreaId: areas.MARKETING.id,
      category: "Marketing",
    },
  });

  // Recurring task example
  await prisma.task.create({
    data: {
      title: "Monatliches Liquiditäts-Reporting",
      description: "Monatliche Liquiditätsübersicht erstellen und an GF-Runde verteilen.",
      assigneeId: anna.id,
      createdById: anna.id,
      priority: "MITTEL",
      status: "OFFEN",
      visibility: "GEMEINSAM",
      dueDate: new Date("2026-07-31"),
      companyAreaId: areas.FINANZEN.id,
      category: "Finanzen",
      isRecurring: true,
      recurrenceFrequency: "MONATLICH",
      recurrenceInterval: 1,
    },
  });

  console.log("Aufgaben angelegt:", [task1, task2, task3, task4, task5, task6, task7, task8].length);

  // ---------------------------------------------------------------------
  // Kalendertermine (lokal, simuliert Outlook-Struktur ohne echte Verbindung)
  // ---------------------------------------------------------------------
  await prisma.calendarEvent.createMany({
    data: [
      {
        userId: anna.id,
        title: "Bankgespräch Finanzierung",
        description: "Gespräch mit Hausbank zu Investitionsfinanzierung.",
        location: "Sparkasse Chemnitz",
        startTime: new Date("2026-07-22T09:00:00.000Z"),
        endTime: new Date("2026-07-22T10:00:00.000Z"),
        timeZone: "Europe/Berlin",
        organizer: anna.email,
        source: "LOKAL",
        syncStatus: "NIE_SYNCHRONISIERT",
      },
      {
        userId: thomas.id,
        title: "Kundentermin Sächsische Fahrzeugwerke",
        description: "Vor-Ort-Termin zur Vertragsverhandlung.",
        location: "Beim Kunden",
        startTime: new Date("2026-07-18T13:00:00.000Z"),
        endTime: new Date("2026-07-18T14:30:00.000Z"),
        timeZone: "Europe/Berlin",
        organizer: thomas.email,
        source: "LOKAL",
        syncStatus: "NIE_SYNCHRONISIERT",
      },
      {
        userId: anna.id,
        title: "Geschäftsführungsmeeting KW 30",
        description: "Wöchentliches GF-Jour-fixe.",
        location: "Konferenzraum 1 / Teams",
        startTime: new Date("2026-07-21T09:00:00.000Z"),
        endTime: new Date("2026-07-21T10:00:00.000Z"),
        timeZone: "Europe/Berlin",
        teamsLink: "https://teams.microsoft.com/l/meetup-join/beispiel",
        organizer: anna.email,
        source: "LOKAL",
        syncStatus: "NIE_SYNCHRONISIERT",
      },
    ],
  });

  console.log("Seed erfolgreich abgeschlossen.");
  console.log("Login-Daten (Entwicklung): Passwort für alle Konten = Passwort123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
