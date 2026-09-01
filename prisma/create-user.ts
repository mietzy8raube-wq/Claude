import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Legt ein Benutzerkonto an oder aktualisiert es (per E-Mail), falls es
// bereits existiert. Es gibt aktuell keine "Benutzer anlegen"-Funktion in
// der Oberfläche (nur Rollen ändern unter „Einstellungen"), daher dieses
// Skript für die Erstinbetriebnahme und für weitere Mitarbeiterkonten.
//
// Aufruf:
//   npm run user:create -- --name "Max Mustermann" --email max@druckluft-chemnitz.de --password "..." --role MITARBEITER
// oder per Umgebungsvariablen (praktisch für Docker):
//   ADMIN_NAME=... ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_ROLE=ADMINISTRATOR npm run user:create

const ROLES: Role[] = ["GESCHAEFTSFUEHRER", "ADMINISTRATOR", "MITARBEITER"];

function readArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    name: get("--name") ?? process.env.ADMIN_NAME,
    email: get("--email") ?? process.env.ADMIN_EMAIL,
    password: get("--password") ?? process.env.ADMIN_PASSWORD,
    role: (get("--role") ?? process.env.ADMIN_ROLE ?? "GESCHAEFTSFUEHRER") as Role,
  };
}

async function main() {
  const { name, email, password, role } = readArgs();

  if (!name || !email || !password) {
    console.error(
      "Fehlende Angaben. Beispiel:\n" +
        '  npm run user:create -- --name "Max Mustermann" --email max@druckluft-chemnitz.de --password "..." --role GESCHAEFTSFUEHRER\n' +
        "Erlaubte Rollen: " +
        ROLES.join(", ")
    );
    process.exit(1);
  }
  if (!ROLES.includes(role)) {
    console.error(`Ungültige Rolle "${role}". Erlaubt: ${ROLES.join(", ")}`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Das Passwort sollte mindestens 8 Zeichen lang sein.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role, isActive: true },
    create: { name, email, passwordHash, role },
  });

  console.log(`Benutzer bereit: ${user.name} <${user.email}> — Rolle ${user.role}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
