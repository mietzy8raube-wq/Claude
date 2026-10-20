/* ======================================================================
   Minimaler XLSX-Schreiber (Office Open XML) ohne externe Bibliotheken.
   Erzeugt echte Excel-Dateien mit mehreren Blättern, fixierter Kopfzeile,
   AutoFilter, Spaltenbreiten, echten Datums-/Zahlenwerten, frei formatierten
   Zellen (für Dashboards) und nativen Excel-Diagrammen (Säule, Balken, Linie).

   Tabellenblatt:  { name, columns: [{ h, w, t, wrap }], rows: [[...]] }
     t: "s" Text · "n" Zahl · "h" Zahl 0,00 · "d" Datum · "dt" Datum+Zeit · "p" Prozent
   Freies Blatt:   { name, free: true, columns: [{ w }], cells: [{ r, c, v, t, s }], merges: ["B2:M2"],
                     heights: { 2: 30 }, grid: false, charts: [...] }   (r/c 0-basiert)
     s: { b, sz, color, fill, align, valign, wrap, indent, numFmt, border: { top|bottom|left|right: { color, style } } }
   Diagramm:       { type: "col"|"bar"|"line", stacked, title, at: [c1, r1, c2, r2], cats: { ref, vals },
                     series: [{ name, ref, vals, color }], labels, numFmt }
   ====================================================================== */
globalThis.XLSX = (() => {
"use strict";
const enc = new TextEncoder();
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** ZIP-Archiv ohne Kompression (von Excel problemlos lesbar). */
function zip(files) {
  const parts = [], central = []; let offset = 0;
  const now = new Date(); const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1); const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, time, true); h.setUint16(12, date, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((s, b) => s + b.length, 0)); let p = 0; for (const b of all) { out.set(b, p); p += b.length; }
  return out;
}

const xml = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (n) => { let s = ""; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const argb = (hex) => "FF" + String(hex || "#000000").replace("#", "").toUpperCase();
/** Excel-Seriennummer in Ortszeit (Excel kennt keine Zeitzonen). */
function serial(v, withTime) {
  const d = v instanceof Date ? v : /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T00:00:00") : new Date(v);
  if (isNaN(d)) return null;
  const local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), withTime ? d.getHours() : 0, withTime ? d.getMinutes() : 0, withTime ? d.getSeconds() : 0);
  return local / 864e5 + 25569;
}

/* ---------- Formatvorlagen (werden beim Erstellen gesammelt) ---------- */
function Styles() {
  const fonts = [], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], borders = [], numFmts = [], xfs = [];
  const idx = (list, item) => { let i = list.indexOf(item); if (i < 0) { list.push(item); i = list.length - 1; } return i; };
  const BUILTIN = { "0": 1, "0.00": 2, "0%": 9 };
  function add(s = {}) {
    const font = `<font>${s.b ? "<b/>" : ""}${s.i ? "<i/>" : ""}<sz val="${s.sz || 11}"/><color rgb="${argb(s.color || "#1F2328")}"/><name val="Calibri"/><family val="2"/></font>`;
    const fill = s.fill ? `<fill><patternFill patternType="solid"><fgColor rgb="${argb(s.fill)}"/><bgColor indexed="64"/></patternFill></fill>` : fills[0];
    const side = (k) => { const b = s.border?.[k]; return b ? `<${k} style="${b.style || "thin"}"><color rgb="${argb(b.color)}"/></${k}>` : `<${k}/>`; };
    const border = `<border>${side("left")}${side("right")}${side("top")}${side("bottom")}<diagonal/></border>`;
    let fmt = 0; if (s.numFmt) fmt = BUILTIN[s.numFmt] ?? 164 + idx(numFmts, s.numFmt);
    const al = s.align || s.valign || s.wrap || s.indent ? `<alignment${s.align ? ` horizontal="${s.align}"` : ""} vertical="${s.valign || "center"}"${s.wrap ? ' wrapText="1"' : ""}${s.indent ? ` indent="${s.indent}"` : ""}/>` : "";
    const xf = `<xf numFmtId="${fmt}" fontId="${idx(fonts, font)}" fillId="${idx(fills, fill)}" borderId="${idx(borders, border)}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${al}</xf>`;
    return idx(xfs, xf);
  }
  function xmlOut() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + (numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${xml(f)}"/>`).join("")}</numFmts>` : "")
      + `<fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders>`
      + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>`
      + `<cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
  return { add, xml: xmlOut };
}

/* ---------- Tabellenblätter ---------- */
function cellXml(ref, v, t, s) {
  if (v === null || v === undefined || v === "") return s ? `<c r="${ref}" s="${s}"/>` : "";
  if (t === "d" || t === "dt") { const n = serial(v, t === "dt"); return n === null ? `<c r="${ref}" s="${s}"/>` : `<c r="${ref}" s="${s}"><v>${n}</v></c>`; }
  if (typeof v === "number" && isFinite(v) && t !== "s") return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(String(v).slice(0, 32000))}</t></is></c>`;
}
function tableSheetXml(sh, st) {
  const cols = sh.columns; const rows = sh.rows; const last = colName(cols.length - 1) + (rows.length + 1);
  const S = { head: st.add({ b: true, color: "#FFFFFF", fill: "#1F3A5F", valign: "center" }), s: st.add({}), wrap: st.add({ wrap: true, valign: "top" }),
    d: st.add({ numFmt: "dd.mm.yyyy" }), dt: st.add({ numFmt: "dd.mm.yyyy hh:mm" }), h: st.add({ numFmt: "#,##0.00" }), n: st.add({ numFmt: "0" }), p: st.add({ numFmt: "0%" }) };
  let x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`;
  x += `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"${sh.tabSelected ? ' tabSelected="1"' : ""}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>`;
  x += `<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w || 14}" customWidth="1"/>`).join("")}</cols><sheetData>`;
  x += `<row r="1" ht="20" customHeight="1">${cols.map((c, i) => cellXml(`${colName(i)}1`, c.h, "s", S.head)).join("")}</row>`;
  rows.forEach((row, ri) => {
    const r = ri + 2;
    x += `<row r="${r}">${cols.map((c, ci) => { const t = c.t || "s"; const v = row[ci]; if (v === null || v === undefined || v === "") return "";
      const isNum = typeof v === "number" && ["n", "h", "p"].includes(t); return cellXml(colName(ci) + r, v, isNum || t === "d" || t === "dt" ? t : "s", isNum || t === "d" || t === "dt" ? S[t] : c.wrap ? S.wrap : S.s); }).join("")}</row>`;
  });
  x += `</sheetData>${rows.length ? `<autoFilter ref="A1:${last}"/>` : ""}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  return x;
}
function freeSheetXml(sh, st, drawingRel) {
  const byRow = new Map(); let maxR = 0, maxC = 0;
  for (const c of sh.cells || []) { (byRow.get(c.r) || byRow.set(c.r, []).get(c.r)).push(c); maxR = Math.max(maxR, c.r); maxC = Math.max(maxC, c.c); }
  const heights = sh.heights || {};
  for (const r of Object.keys(heights)) if (!byRow.has(Number(r))) byRow.set(Number(r), []);
  let x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`;
  x += `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${colName(Math.max(maxC, (sh.columns || []).length - 1))}${maxR + 1}"/><sheetViews><sheetView workbookViewId="0"${sh.grid === false ? ' showGridLines="0"' : ""}${sh.tabSelected ? ' tabSelected="1"' : ""}${sh.zoom ? ` zoomScale="${sh.zoom}" zoomScaleNormal="${sh.zoom}"` : ""}/></sheetViews><sheetFormatPr defaultRowHeight="15"/>`;
  if (sh.columns?.length) x += `<cols>${sh.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w || 10}" customWidth="1"/>`).join("")}</cols>`;
  x += "<sheetData>";
  for (const r of [...byRow.keys()].sort((a, b) => a - b)) {
    const cells = byRow.get(r).sort((a, b) => a.c - b.c);
    x += `<row r="${r + 1}"${heights[r] ? ` ht="${heights[r]}" customHeight="1"` : ""}>${cells.map((c) => cellXml(colName(c.c) + (r + 1), c.v, c.t || (typeof c.v === "number" ? "n" : "s"), c.s ? st.add(c.s) : 0)).join("")}</row>`;
  }
  x += "</sheetData>";
  if (sh.merges?.length) x += `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>`;
  x += `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${sh.portrait ? "portrait" : "landscape"}" fitToWidth="1" fitToHeight="0"/>`;
  if (drawingRel) x += `<drawing r:id="${drawingRel}"/>`;
  return x + "</worksheet>";
}

/* ---------- Diagramme ---------- */
const TXT = "1F2328", MUTED = "5B6270", GRID = "E3E5E8";
const rPr = (sz, color, b) => `<a:defRPr sz="${sz}" b="${b ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Calibri"/></a:defRPr>`;
const txPr = (sz, color, b) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr>${rPr(sz, color, b)}</a:pPr><a:endParaRPr lang="de-DE"/></a:p></c:txPr>`;
const strCache = (vals) => `<c:strCache><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${xml(v)}</c:v></c:pt>`).join("")}</c:strCache>`;
const numCache = (vals, fmt) => `<c:numCache><c:formatCode>${xml(fmt || "General")}</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, i) => (typeof v === "number" && isFinite(v) ? `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>` : "")).join("")}</c:numCache>`;
function chartXml(ch) {
  const line = ch.type === "line"; const dir = ch.type === "bar" ? "bar" : "col"; const multi = ch.series.length > 1;
  const showLbl = ch.labels ?? !multi;
  const lf = ch.numFmt || "0"; // Nullwerte nicht beschriften
  const dl = showLbl ? `<c:dLbls><c:numFmt formatCode="${xml(`${lf};-${lf};;`)}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900, TXT, true)}${line ? "" : `<c:dLblPos val="${ch.stacked ? "ctr" : "outEnd"}"/>`}<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>` : "";
  const ser = ch.series.map((s, i) => {
    const fill = line ? `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${s.color.replace("#", "")}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr><a:solidFill><a:srgbClr val="${s.color.replace("#", "")}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:marker>`
      : `<c:spPr><a:solidFill><a:srgbClr val="${s.color.replace("#", "")}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr><c:invertIfNegative val="0"/>`;
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:strRef><c:f>${xml(s.nameRef || "")}</c:f>${strCache([s.name])}</c:strRef></c:tx>${fill}${dl}`
      + `<c:cat><c:strRef><c:f>${xml(ch.cats.ref)}</c:f>${strCache(ch.cats.vals)}</c:strRef></c:cat><c:val><c:numRef><c:f>${xml(s.ref)}</c:f>${numCache(s.vals, ch.numFmt)}</c:numRef></c:val>${line ? '<c:smooth val="0"/>' : ""}</c:ser>`;
  }).join("");
  const plot = line ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${ser}<c:marker val="1"/><c:axId val="1001"/><c:axId val="1002"/></c:lineChart>`
    : `<c:barChart><c:barDir val="${dir}"/><c:grouping val="${ch.stacked ? "stacked" : "clustered"}"/><c:varyColors val="0"/>${ser}<c:gapWidth val="${ch.gap ?? 60}"/>${ch.stacked ? '<c:overlap val="100"/>' : multi ? '<c:overlap val="-10"/>' : ""}<c:axId val="1001"/><c:axId val="1002"/></c:barChart>`;
  const noLine = `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>`;
  const catAx = `<c:catAx><c:axId val="1001"/><c:scaling><c:orientation val="${dir === "bar" ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${dir === "bar" ? "l" : "b"}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:noFill/><a:ln w="9525"><a:solidFill><a:srgbClr val="C9CDD3"/></a:solidFill></a:ln></c:spPr>${txPr(900, MUTED)}<c:crossAx val="1002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
  const valAx = `<c:valAx><c:axId val="1002"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="${ch.hideValAx ? 1 : 0}"/><c:axPos val="${dir === "bar" ? "t" : "l"}"/><c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="${GRID}"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${xml(ch.numFmt || "0")}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${noLine}${txPr(900, MUTED)}<c:crossAx val="1001"/><c:crosses val="${dir === "bar" ? "max" : "autoZero"}"/><c:crossBetween val="between"/></c:valAx>`;
  const title = `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr>${rPr(1200, TXT, true)}</a:pPr><a:r><a:rPr lang="de-DE" sz="1200" b="1"><a:solidFill><a:srgbClr val="${TXT}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${xml(ch.title)}</a:t></a:r></a:p>${ch.subtitle ? `<a:p><a:pPr>${rPr(900, MUTED)}</a:pPr><a:r><a:rPr lang="de-DE" sz="900" b="0"><a:solidFill><a:srgbClr val="${MUTED}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${xml(ch.subtitle)}</a:t></a:r></a:p>` : ""}</c:rich></c:tx><c:overlay val="0"/></c:title>`;
  const legend = multi ? `<c:legend><c:legendPos val="t"/><c:overlay val="0"/>${txPr(900, TXT)}</c:legend>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<c:lang val="de-DE"/><c:roundedCorners val="0"/><c:chart>${title}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}${catAx}${valAx}${noLine}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>`
    + `<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="E3E5E8"/></a:solidFill></a:ln></c:spPr>${txPr(900, TXT)}</c:chartSpace>`;
}
function drawingXml(charts) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + charts.map((ch, i) => { const [c1, r1, c2, r2] = ch.at;
      return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${c1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${c2}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
        + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Diagramm ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>`
        + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`; }).join("")
    + `</xdr:wsDr>`;
}
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const rels = (list) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join("")}</Relationships>`;

function build(sheets, { title = "Auswertung", author = "GF Tracker", active = 0 } = {}) {
  const used = new Set();
  const names = sheets.map((s) => { let n = String(s.name).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Blatt"; let k = n, i = 2; while (used.has(k.toLowerCase())) k = n.slice(0, 28) + " " + i++; used.add(k.toLowerCase()); return k; });
  sheets.forEach((s, i) => (s.tabSelected = i === active));
  const st = Styles(); st.add({}); // Index 0 = Standard
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const files = [], ct = [], wbRels = [];
  let drawingNo = 0, chartNo = 0;
  sheets.forEach((s, i) => {
    let drawingRel = null;
    if (s.charts?.length) {
      drawingNo++; drawingRel = "rId1";
      files.push({ name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`, data: rels([["rId1", "drawing", `../drawings/drawing${drawingNo}.xml`]]) });
      files.push({ name: `xl/drawings/drawing${drawingNo}.xml`, data: drawingXml(s.charts) });
      ct.push(`<Override PartName="/xl/drawings/drawing${drawingNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
      const dRels = s.charts.map((ch, k) => { chartNo++; files.push({ name: `xl/charts/chart${chartNo}.xml`, data: chartXml(ch) }); ct.push(`<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`); return [`rId${k + 1}`, "chart", `../charts/chart${chartNo}.xml`]; });
      files.push({ name: `xl/drawings/_rels/drawing${drawingNo}.xml.rels`, data: rels(dRels) });
    }
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.free ? freeSheetXml(s, st, drawingRel) : tableSheetXml(s, st) });
    ct.push(`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    wbRels.push([`rId${i + 1}`, "worksheet", `worksheets/sheet${i + 1}.xml`]);
  });
  wbRels.push([`rId${sheets.length + 1}`, "styles", "styles.xml"]);
  const filterNames = sheets.map((s, i) => (!s.free && s.rows.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(names[i].replace(/'/g, "''"))}'!$A$1:$${colName(s.columns.length - 1)}$${s.rows.length + 1}</definedName>` : "")).join("");
  files.unshift(
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ct.join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)}</dc:title><dc:creator>${xml(author)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` },
    { name: "docProps/app.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>${xml(author)}</Application></Properties>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}"><bookViews><workbookView activeTab="${active}"/></bookViews><sheets>${names.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${filterNames ? `<definedNames>${filterNames}</definedNames>` : ""}</workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: rels(wbRels) },
  );
  // Formatvorlagen erst zum Schluss schreiben – die Blätter haben sie beim Erzeugen gesammelt
  files.push({ name: "xl/styles.xml", data: st.xml() });
  return zip(files);
}
/** Bezug auf einen Bereich eines Blattes, z. B. ref("Diagrammdaten", 0, 1, 0, 12) → 'Diagrammdaten'!$A$2:$A$13 */
const ref = (sheet, c1, r1, c2 = c1, r2 = r1) => `'${String(sheet).replace(/'/g, "''")}'!$${colName(c1)}$${r1 + 1}${c2 === c1 && r2 === r1 ? "" : `:$${colName(c2)}$${r2 + 1}`}`;
return { build, ref, colName };
})();
