#!/usr/bin/env node
// Baut die Systemlandschaft (3D) mit Prozess-Leveln als Einzeldatei (ohne Server).
// Aufruf: node scripts/build-landscape-standalone.mjs  →  ../standalone/systemlandschaft.html
// Inhalt: three.js, die 3D-Welt, live.js und level.js eingebettet. Die Zahlen werden beim Öffnen im
// Browser aus den Beispieldaten berechnet – oder aus einer Tracker-Sicherung (JSON), die man lädt.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLandscape } from "../lib/landscape.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const OUT = path.resolve(ROOT, process.argv[2] || "../standalone/systemlandschaft.html");
const inline = (js) => `<script>\n${js.replace(/<\/script/gi, "<\\/script")}\n</script>`;

// Zusammenfassung wie auf dem Server (lib/landscape.mjs), hier als Browser-Code
const lib = read("lib/landscape.mjs");
const browserLib = `const DEFAULT_SITE = "hq";\n${lib.slice(lib.indexOf("export function landscapeData")).replace(/^export /, "")}`;
if (!/function landscapeData/.test(browserLib) || /\bfs\.|\bpath\./.test(browserLib)) throw new Error("landscapeData nicht sauber herauslösbar – lib/landscape.mjs prüfen.");

const statik = `${read("public/shared.js")}
${browserLib}
window.GFT_STATIC = { compute(db) {
  const S = TrackerShared; const d = db || S.seed();
  const out = landscapeData({ S, issues: d.issues || [], projects: d.projects || [], teams: d.teams || [], sprints: d.sprints || [], users: d.users || [], appUrl: "", company: "druckluft-technik Chemnitz", user: null });
  // Verweise auf die Einzeldatei-Version des Trackers im selben Ordner
  const fix = (u) => (u || "").replace(/^\\/#\\//, "gf-suite-tracker.html#/");
  Object.values(out.sites).forEach((s) => s.top.forEach((i) => (i.url = fix(i.url)))); out.events.forEach((e) => (e.url = fix(e.url))); out.flow.items.forEach((i) => (i.url = fix(i.url))); out.projects.forEach((p) => { p.url = fix(p.url); p.items.forEach((i) => (i.url = fix(i.url))); p.epics.forEach((e) => (e.url = fix(e.url))); });
  return out;
} };`;

let { html, js } = buildLandscape(path.join(ROOT, "landscape", "digitale-welt.html"));
const swap = (from, to) => { if (html.split(from).length !== 2) throw new Error(`Stelle nicht gefunden: ${from}`); html = html.replace(from, () => to); };
swap('<script src="/vendor/three/three.min.js"></script>', inline(read("public/vendor/three/three.min.js")));
swap('<script src="/vendor/three/OrbitControls.js"></script>', inline(read("public/vendor/three/OrbitControls.js")));
swap('<script src="/vendor/three/RoundedBoxGeometry.js"></script>', inline(read("public/vendor/three/RoundedBoxGeometry.js")));
swap('<script src="/landschaft/live.js"></script>', inline(statik) + "\n" + inline(read("public/landschaft/live.js")));
swap('<script src="/landschaft/world.js"></script>', inline(js));
swap('<script src="/landschaft/level.js"></script>', inline(read("public/landschaft/level.js")));
swap('<link rel="icon" href="/icons/icon-64.png">', `<link rel="icon" href="data:image/png;base64,${fs.readFileSync(path.join(ROOT, "public/icons/icon-64.png")).toString("base64")}">`);
html = html.replace("<head>", "<head><!-- three.js: MIT-Lizenz, Copyright 2010-2022 Three.js Authors -->");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`Geschrieben: ${path.relative(process.cwd(), OUT)} (${Math.round(html.length / 1024)} KB)`);
