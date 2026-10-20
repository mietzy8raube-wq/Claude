/* ======================================================================
   Datei-Leser für den Import: CSV (Trennzeichen und Zeichensatz werden
   erkannt) und Excel .xlsx (ohne externe Bibliotheken – entpackt über die
   im Browser eingebaute DecompressionStream-API).
   readTable(file) → Promise<[{ name, rows: [[Zelle, …], …] }]>
   Datumszellen aus Excel werden als "JJJJ-MM-TT" (bzw. mit Uhrzeit) geliefert.
   ====================================================================== */
globalThis.TableReader = (() => {
"use strict";

/* ---------- CSV ---------- */
function decode(bytes) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { text = new TextDecoder("windows-1252").decode(bytes); } // Excel speichert CSV oft als ANSI
  return text.replace(/^﻿/, "");
}
function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim()) || "";
  let best = ";", max = -1;
  for (const d of [";", ",", "\t", "|"]) { let n = 0, q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === d && !q) n++; } if (n > max) { max = n; best = d; } }
  return best;
}
function parseCsv(text) {
  const d = detectDelimiter(text); const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"' && cell === "") q = true;
    else if (ch === d) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

/* ---------- XLSX ---------- */
async function unzip(buf) {
  const v = new DataView(buf); const u8 = new Uint8Array(buf); let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Die Datei ist keine gültige Excel-Datei (.xlsx).");
  const count = v.getUint16(eocd + 10, true); let p = v.getUint32(eocd + 16, true); const files = {};
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nlen = v.getUint16(p + 28, true), elen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    files[name] = { method, csize, off }; p += 46 + nlen + elen + clen;
  }
  return async (name) => {
    const f = files[name]; if (!f) return null;
    const start = f.off + 30 + v.getUint16(f.off + 26, true) + v.getUint16(f.off + 28, true); const data = u8.subarray(start, start + f.csize);
    if (f.method === 0) return new TextDecoder().decode(data);
    if (f.method !== 8) throw new Error("Nicht unterstützte Komprimierung in der Excel-Datei.");
    if (typeof DecompressionStream === "undefined") throw new Error("Dieser Browser kann .xlsx nicht entpacken – bitte als CSV speichern oder einen aktuellen Browser verwenden.");
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(stream).text();
  };
}
const parseXml = (s) => new DOMParser().parseFromString(s, "application/xml");
const byTag = (el, tag) => [...el.getElementsByTagName(tag)];
const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const BUILTIN_DATES = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
function serialToIso(n, withTime) {
  const ms = Math.round((n - 25569) * 864e5); const d = new Date(ms);
  const p = (x) => String(x).padStart(2, "0"); const date = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  return withTime && (d.getUTCHours() || d.getUTCMinutes()) ? `${date}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : date;
}
async function readXlsx(buf) {
  const get = await unzip(buf);
  const wb = parseXml(await get("xl/workbook.xml") || ""); const rels = parseXml(await get("xl/_rels/workbook.xml.rels") || "<r/>");
  const relMap = Object.fromEntries(byTag(rels, "Relationship").map((r) => [r.getAttribute("Id"), r.getAttribute("Target")]));
  const ss = await get("xl/sharedStrings.xml"); const shared = ss ? byTag(parseXml(ss), "si").map((si) => byTag(si, "t").map((t) => t.textContent).join("")) : [];
  const stx = await get("xl/styles.xml"); const dateStyles = new Set();
  if (stx) {
    const sd = parseXml(stx); const custom = {}; byTag(sd, "numFmt").forEach((f) => (custom[f.getAttribute("numFmtId")] = f.getAttribute("formatCode") || ""));
    const xfs = sd.getElementsByTagName("cellXfs")[0]; (xfs ? byTag(xfs, "xf") : []).forEach((xf, i) => {
      const id = Number(xf.getAttribute("numFmtId") || 0); const code = (custom[id] || "").replace(/"[^"]*"|\[[^\]]*\]/g, "");
      if (BUILTIN_DATES.has(id) || (id >= 164 && /[dmyjt]/i.test(code) && !/^[#0.,%\s]+$/.test(code))) dateStyles.add(i);
    });
  }
  const sheets = [];
  for (const s of byTag(wb, "sheet")) {
    const rid = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    let target = relMap[rid] || ""; target = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const xml = await get(target); if (!xml) continue;
    const doc = parseXml(xml); const rows = [];
    for (const r of byTag(doc, "row")) {
      const out = [];
      for (const c of byTag(r, "c")) {
        const t = c.getAttribute("t"); const v = c.getElementsByTagName("v")[0]?.textContent ?? ""; let val;
        if (t === "s") val = shared[Number(v)] ?? "";
        else if (t === "inlineStr") val = byTag(c, "t").map((x) => x.textContent).join("");
        else if (t === "b") val = v === "1" ? "ja" : "nein";
        else if (t === "str" || t === "e") val = v;
        else if (v !== "" && dateStyles.has(Number(c.getAttribute("s") || 0))) val = serialToIso(Number(v), true);
        else val = v;
        out[colIndex(c.getAttribute("r") || "A")] = String(val).trim();
      }
      for (let k = 0; k < out.length; k++) if (out[k] === undefined) out[k] = "";
      if (out.some((x) => x !== "")) rows.push(out);
    }
    sheets.push({ name: s.getAttribute("name") || `Blatt ${sheets.length + 1}`, rows });
  }
  return sheets;
}

async function readTable(file) {
  const buf = await file.arrayBuffer(); const head = new Uint8Array(buf.slice(0, 4));
  if (head[0] === 0x50 && head[1] === 0x4b) return readXlsx(buf);
  if (head[0] === 0xd0 && head[1] === 0xcf) throw new Error("Alte Excel-Dateien (.xls) bitte in Excel als .xlsx oder CSV speichern.");
  return [{ name: file.name.replace(/\.[^.]+$/, ""), rows: parseCsv(decode(new Uint8Array(buf))) }];
}

/* ---------- Werte deuten ---------- */
/** Datum aus "TT.MM.JJJJ", "JJJJ-MM-TT", "TT/MM/JJ" oder Excel-Seriennummer → "JJJJ-MM-TT" (oder null). */
function toDate(v) {
  const s = String(v ?? "").trim(); if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/); if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  if (/^\d{4,5}(\.\d+)?$/.test(s)) return serialToIso(Number(s), false);
  return null;
}
/** Zahl aus "1.234,5" oder "1234.5" (oder null). */
function toNumber(v) {
  let s = String(v ?? "").trim().replace(/\s/g, ""); if (!s) return null;
  if (/,\d{1,3}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s); return isFinite(n) ? n : null;
}
const toBool = (v) => !/^(nein|no|false|0|inaktiv|n|-)$/i.test(String(v ?? "").trim());
/** Vergleichsschlüssel für Spaltenüberschriften: klein, ohne Umlaute/Leer-/Sonderzeichen. */
const norm = (s) => String(s ?? "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");

return { readTable, parseCsv, toDate, toNumber, toBool, norm };
})();
