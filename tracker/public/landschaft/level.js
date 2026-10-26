"use strict";
// Prozess-Level: jeder Prozess der Systemlandschaft als eigene, spielartige 3D-Bühne.
// Stationen liegen auf einer Strecke, Vorgänge sind Spielsteine, die sichtbar von Station zu Station wandern.
// Im Prozess „Wartung & Reparatur“ sind es die echten Service-Vorgänge aus dem GF Tracker (live),
// in den übrigen Prozessen die Beispielmengen der Übersicht. Öffnen: GFTLevel.open("wartung") oder #level=wartung.
(() => {
  const THREE = window.THREE;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dark = () => matchMedia("(prefers-color-scheme: dark)").matches;
  // Servicestatus im Tracker → Station im Prozess „Wartung & Reparatur“
  const LIVE_PROC = "wartung";
  const STATUS_STEP = { OPEN: "Fälligkeit oder Störung", SCHEDULED: "Termin abstimmen", WAITING: "Termin abstimmen", PARTS: "Einsatz vorbereiten", WORKING: "Einsatz beim Kunden", RESOLVED: "Vollständigkeit prüfen" };
  const TYPE_COL = { INCIDENT: 0xff5a5f, MAINT: 0x2f6bff, SERVICE: 0x14b8a6, SUBTASK: 0x8b5cf6, SAMPLE: 0x9aa8bd };
  const TYPE_TXT = { INCIDENT: "Störung", MAINT: "Wartung", SERVICE: "Serviceanfrage", SUBTASK: "Teilaufgabe" };
  const PRIO_TXT = { HIGHEST: "Höchste", HIGH: "Hoch", MEDIUM: "Mittel", LOW: "Niedrig", LOWEST: "Niedrigste" };
  const OLD_H = 48; // ab 2 Tagen an einer Station zählt ein Vorgang als „wartet zu lange“
  const SLOT = 0.8, PER_LAYER = 9, MAX_LAYERS = 3;
  const stateCol = (st) => (st === "hot" ? 0xe5484d : st === "warn" ? 0xe8a33d : 0x3d6fff);
  const age = (h) => (h < 24 ? `${h} Std.` : `${Math.round(h / 24)} T`);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  /* ───────────── Oberfläche ───────────── */
  const css = document.createElement("style");
  css.textContent = `
  #lvl{--bg1:#eef1f6;--bg2:#d2d8e4;--glass:rgba(255,255,255,.72);--glass-b:rgba(255,255,255,.9);--line:rgba(15,23,42,.08);--ink:#0b1220;--ink2:#4a5468;--ink3:#8a93a6;
    --acc:#2f6bff;--acc-soft:rgba(47,107,255,.1);--ok:#16a34a;--warn:#f59e0b;--bad:#ef4444;--shadow:0 1px 1px rgba(15,23,42,.04),0 8px 24px rgba(15,23,42,.08),0 24px 60px rgba(15,23,42,.06);
    position:fixed;inset:0;z-index:60;--bgx:0;font:14px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI Variable Text","Segoe UI",Roboto,system-ui,sans-serif;color:var(--ink);
    background:radial-gradient(1400px 820px at 50% 42%,var(--bg1) 0%,var(--bg1) 35%,var(--bg2) 100%);opacity:0;transition:opacity .45s ease;-webkit-font-smoothing:antialiased}
  #lvl.on{opacity:1}
  @media (prefers-color-scheme:dark){#lvl{--bg1:#23252b;--bg2:#141518;--glass:rgba(38,40,46,.72);--glass-b:rgba(60,63,70,.7);--line:rgba(255,255,255,.08);--ink:#f2f4f8;--ink2:#b6bdcb;--ink3:#7d8596;--acc:#6f9bff;--acc-soft:rgba(111,155,255,.16);
    --shadow:0 1px 1px rgba(0,0,0,.2),0 8px 24px rgba(0,0,0,.3),0 24px 60px rgba(0,0,0,.25)}}
  #lvl canvas{position:absolute;inset:0;display:block;outline:none}
  #lvl .g{position:absolute;background:var(--glass);-webkit-backdrop-filter:saturate(180%) blur(22px);backdrop-filter:saturate(180%) blur(22px);border:1px solid var(--glass-b);border-radius:20px;box-shadow:var(--shadow)}
  #lvl button{font:inherit;color:inherit}
  #lvl .lv-head{top:16px;left:16px;display:flex;align-items:center;gap:14px;padding:12px 18px 12px 12px;max-width:min(560px,calc(100% - 32px))}
  #lvl .lv-back{width:40px;height:40px;border-radius:12px;border:0;background:var(--acc-soft);color:var(--acc);display:grid;place-items:center;cursor:pointer;flex:none;transition:transform .15s}
  #lvl .lv-back:hover{transform:translateX(-2px)}
  #lvl .lv-eyebrow{font:600 11px/1.2 inherit;letter-spacing:.08em;text-transform:uppercase;color:var(--acc);display:flex;gap:8px;align-items:center}
  #lvl .lv-title{font:700 22px/1.15 -apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;letter-spacing:-.02em;margin:2px 0 0}
  #lvl .lv-sub{color:var(--ink2);font-size:13px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #lvl .tag{font:600 10.5px/1 inherit;letter-spacing:.02em;text-transform:none;padding:4px 8px;border-radius:999px;background:var(--acc-soft);color:var(--acc)}
  #lvl .tag.live{background:rgba(22,163,74,.12);color:var(--ok)} #lvl .tag.live::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:1px;animation:lvp 1.6s infinite}
  #lvl .tag.demo{background:rgba(138,147,166,.16);color:var(--ink3)}
  @keyframes lvp{50%{opacity:.25}}
  #lvl .lv-stats{top:16px;right:16px;display:flex;align-items:stretch;padding:6px}
  #lvl .st{padding:6px 14px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid var(--line);min-width:84px}
  #lvl .st:last-child{border-right:0}
  #lvl .st b{font:700 20px/1.1 -apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI Variable Display",system-ui,sans-serif;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  #lvl .st span{font-size:11.5px;color:var(--ink3)}
  #lvl .st.bad b{color:var(--bad)} #lvl .st.warn b{color:var(--warn)}
  #lvl .stars{display:flex;gap:3px} #lvl .stars svg{width:20px;height:20px}
  #lvl .lv-mission{left:16px;bottom:112px;width:300px;padding:16px 18px}
  #lvl .lv-mission h3,#lvl .lv-panel h3{font:600 11px/1.2 inherit;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);margin:0 0 10px}
  #lvl .ms{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:start;padding:7px 0}
  #lvl .ms i{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--line);color:var(--ink3);font-style:normal;font-size:12px;font-weight:700}
  #lvl .ms.done i{background:var(--ok);color:#fff}
  #lvl .ms b{font-weight:600;font-size:13px;display:block} #lvl .ms small{color:var(--ink3);font-size:12px}
  #lvl .bar{height:6px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:6px} #lvl .bar i{display:block;height:100%;border-radius:99px;background:var(--acc);transition:width .8s cubic-bezier(.2,.8,.2,1)}
  #lvl .ms.done .bar i{background:var(--ok)}
  #lvl .lv-levels{left:50%;transform:translateX(-50%);bottom:16px;display:flex;gap:6px;padding:6px;max-width:calc(100% - 32px);overflow-x:auto;scrollbar-width:none}
  #lvl .lv-levels::-webkit-scrollbar{display:none}
  #lvl .lc{border:0;background:none;border-radius:14px;padding:9px 14px 9px 10px;display:flex;align-items:center;gap:10px;cursor:pointer;text-align:left;white-space:nowrap;transition:background .2s}
  #lvl .lc:hover{background:var(--acc-soft)} #lvl .lc.on{background:var(--ink);color:var(--bg1)} #lvl .lc.on small{color:inherit;opacity:.7}
  #lvl .lc .n{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;font:700 13px/1 inherit;background:var(--acc-soft);color:var(--acc);flex:none}
  #lvl .lc.on .n{background:var(--acc);color:#fff}
  #lvl .lc b{display:block;font-size:13px;font-weight:600} #lvl .lc small{font-size:11.5px;color:var(--ink3)}
  #lvl .lv-panel{right:16px;top:100px;width:360px;max-height:calc(100% - 100px - 112px);display:flex;flex-direction:column;overflow:hidden;transform:translateX(24px);opacity:0;pointer-events:none;transition:transform .35s cubic-bezier(.2,.8,.2,1),opacity .25s}
  #lvl .lv-panel.on{transform:none;opacity:1;pointer-events:auto}
  #lvl .lv-pbody{overflow-y:auto;padding:18px 20px 20px}
  #lvl .lv-x{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:10px;border:0;background:var(--line);cursor:pointer;font-size:18px;line-height:1}
  #lvl .lv-panel h2{font:700 21px/1.2 -apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI Variable Display",system-ui,sans-serif;letter-spacing:-.02em;margin:4px 40px 6px 0}
  #lvl .lv-panel p{color:var(--ink2);margin:0 0 14px;font-size:13px;line-height:1.5}
  #lvl .facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 16px}
  #lvl .facts div{background:var(--line);border-radius:14px;padding:10px 12px} #lvl .facts b{display:block;font:700 18px/1.1 inherit;font-variant-numeric:tabular-nums} #lvl .facts span{font-size:11px;color:var(--ink3)}
  #lvl .facts .bad b{color:var(--bad)} #lvl .facts .warn b{color:var(--warn)}
  #lvl dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0 0 16px;font-size:12.5px} #lvl dt{color:var(--ink3)} #lvl dd{margin:0;text-align:right}
  #lvl .it{display:grid;grid-template-columns:10px 1fr auto;gap:10px;align-items:center;padding:9px 10px;border-radius:12px;text-decoration:none;color:inherit;transition:background .15s}
  #lvl .it:hover{background:var(--acc-soft)} #lvl .it i{width:10px;height:10px;border-radius:3px} #lvl .it b{font-weight:600;font-size:12.5px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #lvl .it small{font-size:11.5px;color:var(--ink3)} #lvl .it em{font-style:normal;font:600 11px/1 inherit;padding:4px 7px;border-radius:99px;background:var(--line);color:var(--ink2);white-space:nowrap}
  #lvl .it em.old{background:rgba(245,158,11,.15);color:#b45309} #lvl .it em.sla{background:rgba(239,68,68,.13);color:var(--bad)}
  #lvl .note{font-size:12px;color:var(--ink3);background:var(--line);border-radius:12px;padding:10px 12px;margin:0}
  #lvl .lbl{position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;display:flex;align-items:center;gap:8px;padding:5px 11px 5px 5px;border-radius:999px;background:var(--glass);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
    border:1px solid var(--glass-b);box-shadow:0 2px 10px rgba(15,23,42,.1);white-space:nowrap;font-size:12px;font-weight:600;will-change:transform;transition:box-shadow .2s}
  #lvl .lbl .no{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--ink);color:var(--bg1);font-size:11px}
  #lvl .lbl .ct{font-variant-numeric:tabular-nums;color:var(--ink3);font-weight:600}
  #lvl .lbl.warn .no{background:var(--warn);color:#fff} #lvl .lbl.hot .no{background:var(--bad);color:#fff} #lvl .lbl.dim{opacity:.55}
  #lvl .lbl.sel{box-shadow:0 0 0 2px var(--acc),0 6px 18px rgba(15,23,42,.14)}
  #lvl .lbl.goal .no{background:var(--ok);color:#fff}
  #lvl .tip{position:absolute;left:0;top:0;pointer-events:none;background:var(--ink);color:var(--bg1);border-radius:12px;padding:8px 11px;font-size:12px;max-width:280px;box-shadow:var(--shadow);opacity:0;transition:opacity .12s}
  #lvl .tip.on{opacity:1} #lvl .tip b{display:block;font-size:12.5px} #lvl .tip span{opacity:.7}
  #lvl .pop{position:absolute;left:0;top:0;pointer-events:none;font:800 15px/1 inherit;color:var(--ok);text-shadow:0 2px 10px rgba(22,163,74,.35);white-space:nowrap}
  #lvl .hint{position:absolute;left:20px;bottom:30px;font-size:11.5px;color:var(--ink3)}
  #lvl .toast{position:absolute;left:50%;top:22px;transform:translate(-50%,-20px);opacity:0;padding:10px 16px;border-radius:999px;background:var(--ink);color:var(--bg1);font-weight:600;font-size:13px;transition:all .4s cubic-bezier(.2,.8,.2,1);pointer-events:none}
  #lvl .toast.on{transform:translate(-50%,0);opacity:1}
  @media (max-width:1280px){#lvl .hint{display:none}} @media (max-width:1100px){#lvl .lv-mission{display:none}}
  @media (max-width:860px){#lvl .lv-stats{top:auto;bottom:92px;left:16px;right:16px;justify-content:space-between} #lvl .st{min-width:0;padding:4px 8px} #lvl .st b{font-size:17px}
    #lvl .lv-panel{left:16px;right:16px;width:auto;top:auto;bottom:170px;max-height:45%} #lvl .lv-title{font-size:18px} #lvl .lv-sub{display:none}
    #lvl .nm{display:none} #lvl .lbl{padding:4px 8px 4px 4px;gap:5px} #lvl .lbl.sel .nm{display:inline} #lvl .lv-head{padding:10px 14px 10px 10px}}
  @media (prefers-reduced-motion:reduce){#lvl,#lvl *{transition:none!important;animation:none!important}}`;
  document.head.appendChild(css);

  const STAR = (on) => `<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" fill="${on ? "#f5b400" : "none"}" stroke="${on ? "#f5b400" : "currentColor"}" stroke-opacity="${on ? 1 : 0.35}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

  let root = null, R = null; // R: laufende Bühne
  const live = () => window.GFTLive && window.GFTLive.data;

  /* ───────────── Daten je Level ───────────── */
  function levelData(proc) {
    const d = live(); const isLive = proc.id === LIVE_PROC && d && d.flow;
    const stations = proc.steps.map((s, i) => ({ step: s, i, items: [], liveMapped: false }));
    if (isLive) {
      const byName = new Map(stations.map((st) => [st.step.n, st]));
      Object.values(STATUS_STEP).forEach((n) => { const st = byName.get(n); if (st) st.liveMapped = true; });
      for (const it of d.flow.items) { const st = byName.get(STATUS_STEP[it.status]); if (st) st.items.push({ ...it, id: it.key }); }
    } else {
      stations.forEach((st) => { for (let k = 0; k < (st.step.wip || 0); k++) st.items.push({ id: `${st.step.id}#${k}`, key: null, summary: "Vorgang (Beispiel)", type: "SAMPLE", ageH: st.step.state === "hot" ? 72 : st.step.state === "slow" ? 50 : 6, sample: true }); });
    }
    for (const st of stations) {
      const old = st.items.filter((x) => x.ageH > OLD_H).length;
      st.old = old; st.sla = st.items.filter((x) => x.sla).length;
      st.state = isLive ? (old >= 3 ? "hot" : old ? "warn" : "ok") : st.step.state === "hot" ? "hot" : st.step.state === "slow" ? "warn" : "ok";
      st.dim = isLive && !st.liveMapped;
    }
    const open = stations.reduce((a, s) => a + s.items.length, 0);
    const stau = stations.filter((s) => s.state !== "ok").length;
    let missions;
    if (isLive) {
      const quote = d.flow.open ? 1 - d.flow.sla / d.flow.open : 1;
      missions = [
        { t: "SLA einhalten", s: `${Math.round(quote * 100)} % im Soll · Ziel 95 %`, p: Math.min(1, quote / 0.95), done: quote >= 0.95 },
        { t: "Kein Stau", s: stau ? `${stau} Station${stau > 1 ? "en" : ""} mit Wartezeit über 2 Tagen` : "Alle Stationen im Fluss", p: Math.max(0, 1 - stau / Math.max(1, stations.length)), done: !stau },
        { t: "5 Abschlüsse pro Woche", s: `${d.flow.done7} in den letzten 7 Tagen`, p: Math.min(1, d.flow.done7 / 5), done: d.flow.done7 >= 5 },
      ];
    } else {
      const hot = stations.filter((s) => s.state === "hot").length;
      missions = [
        { t: "Kein Engpass", s: hot ? `${hot} Engpass-Station${hot > 1 ? "en" : ""}` : "Keine Engpässe", p: hot ? 0.3 : 1, done: !hot },
        { t: "Übergaben im Fluss", s: stau ? `${stau} Station${stau > 1 ? "en" : ""} verzögert` : "Alles im Takt", p: Math.max(0, 1 - stau / stations.length), done: !stau },
        { t: "Echte Daten anbinden", s: "Folgt mit Inform, DocuWare & Co.", p: 0.15, done: false },
      ];
    }
    return { proc, isLive, stations, open, stau, missions, stars: missions.filter((m) => m.done).length, done7: isLive ? d.flow.done7 : null, doneToday: isLive ? d.flow.doneToday : null, sla: isLive ? d.flow.sla : 0 };
  }

  /* ───────────── Bühne ───────────── */
  function layout(n, narrow) { // Handy: schmale, hohe Schlange
    const per = narrow ? 2 : n <= 5 ? n : Math.ceil(n / 2); const gap = 5.8, row = 8.4; const pts = [];
    for (let i = 0; i < n; i++) { const r = Math.floor(i / per), c = i % per; const x = (r % 2 ? per - 1 - c : c) * gap - (per - 1) * gap / 2; pts.push(new THREE.Vector3(x, 0, r * row - (Math.ceil(n / per) - 1) * row / 2)); }
    return { pts, gap, row, per };
  }

  function makeTrack(stPts, gap, row) {
    // Start vor der ersten, Ziel nach der letzten Station, weiche Kehren zwischen den Reihen
    const first = stPts[0], second = stPts[1] || first.clone().add(new THREE.Vector3(1, 0, 0));
    const dir0 = second.clone().sub(first).normalize();
    const last = stPts[stPts.length - 1], prev = stPts[stPts.length - 2] || last.clone().sub(dir0);
    const dirN = last.clone().sub(prev).normalize();
    // Start kommt von hinten, Ziel liegt vorn – so bleiben beide klar getrennt
    const start = first.clone().add(new THREE.Vector3(-dir0.x * gap * 0.35, 0, -row * 0.55)), goal = last.clone().add(new THREE.Vector3(dirN.x * gap * 0.2, 0, row * 0.78));
    const ctrl = [start];
    stPts.forEach((p, i) => {
      ctrl.push(p);
      const nx = stPts[i + 1]; if (nx && Math.abs(nx.z - p.z) > 0.1) { const out = p.x >= 0 ? 1 : -1; ctrl.push(new THREE.Vector3(p.x + out * gap * 0.62, 0, p.z + row * 0.22), new THREE.Vector3(p.x + out * gap * 0.62, 0, nx.z - row * 0.22)); }
    });
    ctrl.push(goal);
    const curve = new THREE.CatmullRomCurve3(ctrl, false, "centripetal", 0.5);
    // Parameter je Station auf der Kurve
    const N = 600; const samples = curve.getSpacedPoints(N);
    const uOf = (p) => { let best = 0, bd = Infinity; samples.forEach((q, k) => { const dd = q.distanceToSquared(p); if (dd < bd) { bd = dd; best = k; } }); return best / N; };
    return { curve, start, goal, uSt: stPts.map(uOf) };
  }

  function dashTexture() {
    const c = document.createElement("canvas"); c.width = 128; c.height = 8; const g = c.getContext("2d");
    g.clearRect(0, 0, 128, 8); g.fillStyle = "#fff"; g.fillRect(0, 0, 48, 8);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function radialTexture(inner, outer) {
    const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
    const gr = g.createRadialGradient(256, 256, 20, 256, 256, 256); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512); return new THREE.CanvasTexture(c);
  }

  function build(LD) {
    const W = window.innerWidth, H = window.innerHeight; const dk = dark();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W, H);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.NoToneMapping;
    root.insertBefore(renderer.domElement, root.firstChild);
    const scene = new THREE.Scene();
    const n = LD.stations.length; const { pts, gap, row, per } = layout(n, W < 860); const T = makeTrack(pts, gap, row);
    const span = Math.max(per * gap, Math.ceil(n / per) * row * 1.6) + 10;
    const aspect = W / H; const view = span * 0.62;
    const camera = new THREE.OrthographicCamera(-view * aspect, view * aspect, view, -view, 0.1, 400);
    const camDir = new THREE.Vector3(1, 1.15, 1.25).normalize();
    const target = new THREE.Vector3(0, 0, 0); const camTarget = target.clone();
    camera.position.copy(target).add(camDir.clone().multiplyScalar(90)); camera.lookAt(target);
    camera.updateMatrixWorld();
    // Zoom so wählen, dass die Strecke den freien Bereich zwischen den Bedienfeldern füllt
    const inv = camera.matrixWorldInverse; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    [...pts, ...pts.map((p) => p.clone().setY(3.5)), T.start, T.goal, T.goal.clone().setY(3.5)].forEach((p) => { const q = p.clone().applyMatrix4(inv); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); });
    const pad = 7, fw = W < 860 ? 0.92 : 0.58, fh = W < 860 ? 0.5 : 0.62;
    camera.zoom = Math.min((2 * view * aspect * fw) / (x1 - x0 + pad), (2 * view * fh) / (y1 - y0 + pad)); camera.updateProjectionMatrix();
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = true; controls.screenSpacePanning = false;
    controls.minZoom = camera.zoom * 0.5; controls.maxZoom = camera.zoom * 3.5; controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.12; controls.target.copy(target);
    controls.minAzimuthAngle = Math.PI / 4 - 0.9; controls.maxAzimuthAngle = Math.PI / 4 + 0.9;

    // Licht: weiches Himmelslicht + Sonne mit sanften Schatten
    scene.add(new THREE.HemisphereLight(dk ? 0xbfc8ff : 0xffffff, dk ? 0x1a1c22 : 0xc9d2e3, dk ? 0.7 : 0.72));
    const sun = new THREE.DirectionalLight(0xffffff, dk ? 0.85 : 0.78); sun.position.set(-22, 30, -12); // Schatten fallen nach vorn rechts, gut sichtbar sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 6; sun.shadow.bias = -0.0004;
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 120 }); scene.add(sun);
    const fill = new THREE.DirectionalLight(dk ? 0x7f9cff : 0xcfe0ff, 0.25); fill.position.set(20, 10, -15); scene.add(fill);

    // Bühne: runde Bodenplatte mit weichem Verlauf und Schattenfang
    const stage = new THREE.Mesh(new THREE.CircleGeometry(span * 0.95, 96), new THREE.MeshBasicMaterial({ map: radialTexture(dk ? "#2e3138" : "rgba(255,255,255,.5)", dk ? "rgba(20,21,24,0)" : "rgba(238,241,246,0)"), transparent: true, depthWrite: false }));
    stage.rotation.x = -Math.PI / 2; stage.position.y = -0.02; scene.add(stage);
    const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(span * 3, span * 3), new THREE.ShadowMaterial({ opacity: dk ? 0.4 : 0.24 }));
    shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.receiveShadow = true; scene.add(shadowCatcher);
    // feines Punktraster
    const dots = new THREE.Points(new THREE.BufferGeometry().setFromPoints((() => { const a = []; const s = Math.ceil(span * 0.9); for (let x = -s; x <= s; x += 1.5) for (let z = -s; z <= s; z += 1.5) if (x * x + z * z < s * s * 0.8) a.push(new THREE.Vector3(x, 0, z)); return a; })()),
      new THREE.PointsMaterial({ size: 0.07, color: dk ? 0x4a4f5a : 0xc4ccda, transparent: true, opacity: 0.8 }));
    scene.add(dots);

    // Strecke: helle Bahn, darauf ein laufender Lichtstreifen
    const trackMat = new THREE.MeshStandardMaterial({ color: dk ? 0x3a3d45 : 0xdde5f3, roughness: 0.55, metalness: 0.0 });
    const track = new THREE.Mesh(new THREE.TubeGeometry(T.curve, 500, 0.42, 20, false), trackMat); track.scale.y = 0.28; track.position.y = 0.06; track.receiveShadow = true; track.castShadow = true; scene.add(track);
    const dash = dashTexture(); dash.repeat.set(70, 1);
    const flowMat = new THREE.MeshBasicMaterial({ color: 0x2f6bff, map: dash, transparent: true, opacity: 0.85, depthWrite: false });
    const flow = new THREE.Mesh(new THREE.TubeGeometry(T.curve, 500, 0.075, 8, false), flowMat); flow.position.y = 0.2; scene.add(flow);

    const RB = THREE.RoundedBoxGeometry;
    const platGeo = new RB(3.0, 0.5, 3.0, 4, 0.22); const tokenGeo = new RB(0.6, 0.6, 0.6, 3, 0.14);
    const ringGeo = new THREE.RingGeometry(2.25, 2.55, 64);
    const stObjs = LD.stations.map((st, i) => {
      const g = new THREE.Group(); g.position.copy(pts[i]); scene.add(g);
      const colTop = stateCol(st.state);
      const mat = new THREE.MeshStandardMaterial({ color: dk ? 0x464a54 : 0xffffff, roughness: 0.6, transparent: st.dim, opacity: st.dim ? 0.55 : 1 });
      const plat = new THREE.Mesh(platGeo, mat); plat.position.y = 0.25; plat.castShadow = plat.receiveShadow = true; g.add(plat);
      const strip = new THREE.Mesh(new RB(3.24, 0.26, 3.24, 3, 0.1), new THREE.MeshStandardMaterial({ color: colTop, roughness: 0.4, transparent: st.dim, opacity: st.dim ? 0.3 : 1 }));
      strip.position.y = 0.13; strip.castShadow = true; g.add(strip); plat.position.y = 0.5;
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: colTop, transparent: true, opacity: st.state === "ok" ? 0 : 0.5, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
      plat.userData.station = i; strip.userData.station = i;
      g.scale.set(1, 0.001, 1); // steigt beim Start auf
      return { g, plat, mat, ring, strip, st, u: T.uSt[i], pos: pts[i] };
    });
    // Ziel: flache Plattform mit Fahne
    const goalG = new THREE.Group(); goalG.position.copy(T.goal); scene.add(goalG);
    const gp = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 48), new THREE.MeshStandardMaterial({ color: dk ? 0x2b3a30 : 0xeafbf0, roughness: 0.5 })); gp.position.y = 0.15; gp.castShadow = gp.receiveShadow = true; goalG.add(gp);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 12), new THREE.MeshStandardMaterial({ color: 0x9aa3b2 })); pole.position.set(0, 1.5, 0); pole.castShadow = true; goalG.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55, 8, 2), new THREE.MeshStandardMaterial({ color: 0x16a34a, side: THREE.DoubleSide, roughness: 0.6 })); flag.position.set(0.47, 2.4, 0); flag.castShadow = true; goalG.add(flag);
    const startG = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.24, 48), new THREE.MeshStandardMaterial({ color: dk ? 0x30364a : 0xeef3ff, roughness: 0.5 })); startG.position.copy(T.start); startG.position.y = 0.12; startG.receiveShadow = startG.castShadow = true; scene.add(startG);

    // Lichtpunkte, die ständig über die Strecke laufen
    const sparks = []; const sparkGeo = new THREE.SphereGeometry(0.11, 12, 12);
    for (let k = 0; k < 22; k++) { const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0x7aa2ff, transparent: true, opacity: 0.9 })); m.userData.u = k / 22; scene.add(m); sparks.push(m); }

    return { renderer, scene, camera, controls, camDir, target, camTarget, T, stObjs, goalG, flag, flowMat, dash, sparks, tokenGeo, tokens: new Map(), pts, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(-9, -9), t0: performance.now(), pops: [], confetti: [] };
  }

  /* ───────────── Spielsteine ───────────── */
  function slotPos(R, si, k) {
    const o = R.stObjs[si]; const layer = Math.min(MAX_LAYERS - 1, Math.floor(k / PER_LAYER)); const r = k % PER_LAYER;
    return new THREE.Vector3(o.pos.x + ((r % 3) - 1) * SLOT, 0.75 + 0.27 + layer * 0.56, o.pos.z + (Math.floor(r / 3) - 1) * SLOT);
  }
  function tokenColor(it) { return TYPE_COL[it.type] || TYPE_COL.SAMPLE; }
  function syncTokens(R, LD, animate) {
    const seen = new Set();
    LD.stations.forEach((st, si) => {
      st.items.slice(0, PER_LAYER * MAX_LAYERS).forEach((it, k) => {
        seen.add(it.id); let tk = R.tokens.get(it.id); const to = slotPos(R, si, k);
        if (!tk) {
          const col = tokenColor(it);
          const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.05, emissive: it.sla ? 0xff2d2d : col, emissiveIntensity: it.sla ? 0.55 : 0.08 });
          const m = new THREE.Mesh(R.tokenGeo, mat); m.castShadow = true; m.userData.token = it.id; R.scene.add(m);
          tk = { m, it, si, k, from: null, anim: null, phase: Math.random() * 6.28 }; R.tokens.set(it.id, tk);
          if (animate) { tk.anim = { kind: "path", u0: 0, u1: R.stObjs[si].u, t: 0, dur: 1.2 + R.stObjs[si].u * 1.6, to }; m.position.copy(R.T.curve.getPointAt(0)); }
          else { m.position.copy(to); m.position.y += 6 + Math.random() * 3; tk.anim = { kind: "drop", t: -Math.random() * 0.6 - si * 0.08, dur: 0.9, from: m.position.clone(), to }; }
        } else if (tk.si !== si) {
          tk.anim = { kind: "path", u0: R.stObjs[tk.si].u, u1: R.stObjs[si].u, t: 0, dur: 1.1 + Math.abs(R.stObjs[si].u - R.stObjs[tk.si].u) * 2.2, to };
          if (si > tk.si && animate) pop(R, R.stObjs[si].pos, "→ weiter", "#2f6bff");
          tk.si = si; tk.k = k;
        } else if (tk.k !== k) { tk.anim = { kind: "slide", t: 0, dur: 0.5, from: tk.m.position.clone(), to }; tk.k = k; }
        tk.it = it; tk.target = to;
        tk.m.material.emissive.set(it.sla ? 0xff2d2d : tokenColor(it)); tk.m.material.emissiveIntensity = it.sla ? 0.55 : 0.08;
      });
    });
    // nicht mehr da → abgeschlossen: fährt ins Ziel
    for (const [id, tk] of R.tokens) if (!seen.has(id) && !tk.leaving) {
      tk.leaving = true; tk.anim = { kind: "path", u0: R.stObjs[tk.si].u, u1: 1, t: 0, dur: 1.2 + (1 - R.stObjs[tk.si].u) * 2, to: R.T.goal.clone().setY(0.6), finish: true };
    }
  }

  function pop(R, pos, text, color) {
    const el = document.createElement("div"); el.className = "pop"; el.textContent = text; if (color) el.style.color = color; root.appendChild(el);
    R.pops.push({ el, pos: pos.clone().setY(2.2), t: 0 });
  }
  function confetti(R, pos) {
    const cols = [0x2f6bff, 0x16a34a, 0xf5b400, 0xff5a5f, 0x8b5cf6]; const geo = new THREE.PlaneGeometry(0.16, 0.08);
    for (let k = 0; k < 26; k++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[k % cols.length], side: THREE.DoubleSide, transparent: true }));
      m.position.copy(pos).setY(1.2); R.scene.add(m);
      R.confetti.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 5, 4 + Math.random() * 3, (Math.random() - 0.5) * 5), r: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), t: 0 });
    }
  }

  /* ───────────── HUD ───────────── */
  function hud(LD) {
    const P = window.DW.PROCESSES; const idx = P.indexOf(LD.proc);
    root.querySelector(".lv-head").innerHTML = `<button class="lv-back" data-x aria-label="Zurück zur Systemlandschaft"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div style="min-width:0"><div class="lv-eyebrow">Level ${idx + 1} von ${P.length} · ${esc(LD.proc.area || "Prozess")} ${LD.isLive ? (window.GFTLive && window.GFTLive.label !== "Live · GF Tracker" ? `<span class="tag">${esc(window.GFTLive.label)}</span>` : '<span class="tag live">Live<span class="nm"> · GF Tracker</span></span>') : '<span class="tag demo">Beispieldaten</span>'}</div>
      <h1 class="lv-title">${esc(LD.proc.name)}</h1><div class="lv-sub">${esc(LD.proc.goal || "")}</div></div>`;
    root.querySelector(".lv-stats").innerHTML = `<div class="st"><div class="stars" aria-label="${LD.stars} von 3 Sternen">${[0, 1, 2].map((k) => STAR(k < LD.stars)).join("")}</div><span>${LD.stars} von 3 Sternen</span></div>
      <div class="st"><b>${LD.open}</b><span>im Prozess</span></div>
      <div class="st ${LD.stau ? (LD.stations.some((s) => s.state === "hot") ? "bad" : "warn") : ""}"><b>${LD.stau}</b><span>Stau-Stationen</span></div>
      ${LD.isLive ? `<div class="st"><b>${LD.done7}</b><span>erledigt · 7 Tage</span></div><div class="st ${LD.sla ? "bad" : ""}"><b>${LD.sla}</b><span>SLA verletzt</span></div>` : ""}`;
    root.querySelector(".lv-mission").innerHTML = `<h3>Missionen</h3>${LD.missions.map((m) => `<div class="ms ${m.done ? "done" : ""}"><i>${m.done ? "✓" : ""}</i><div><b>${esc(m.t)}</b><small>${esc(m.s)}</small><div class="bar"><i style="width:${Math.round(m.p * 100)}%"></i></div></div></div>`).join("")}`;
    root.querySelector(".lv-levels").innerHTML = P.map((p, k) => { const L = k === idx ? LD : levelData(p); return `<button class="lc ${k === idx ? "on" : ""}" data-lv="${esc(p.id)}"><span class="n">${k + 1}</span><span><b>${esc(p.name)}</b><small>${"★".repeat(L.stars)}${"☆".repeat(3 - L.stars)} · ${L.isLive ? (window.GFTLive && window.GFTLive.label !== "Live · GF Tracker" ? "Tracker-Daten" : "live") : "Beispiel"}</small></span></button>`; }).join("");
    root.querySelectorAll("[data-lv]").forEach((b) => b.addEventListener("click", () => open(b.dataset.lv)));
    root.querySelector("[data-x]").addEventListener("click", close);
    const on = root.querySelector(".lc.on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
  }

  function labels(R, LD) {
    root.querySelectorAll(".lbl").forEach((e) => e.remove());
    R.lbls = LD.stations.map((st, i) => {
      const el = document.createElement("div"); el.className = `lbl ${st.state === "ok" ? "" : st.state}${st.dim ? " dim" : ""}`;
      const more = st.items.length > PER_LAYER * MAX_LAYERS ? ` +${st.items.length - PER_LAYER * MAX_LAYERS}` : "";
      el.innerHTML = `<span class="no">${i + 1}</span><span class="nm">${esc(st.step.n)}</span> <span class="ct">${st.dim ? "–" : st.items.length}${more}</span>`;
      el.addEventListener("click", () => selectStation(i)); root.appendChild(el); return el;
    });
    const g = document.createElement("div"); g.className = "lbl goal";
    g.innerHTML = `<span class="no">✓</span><span class="nm">Abgeschlossen</span> <span class="ct">${LD.isLive ? `${LD.doneToday} heute` : ""}</span>`; root.appendChild(g); R.goalLbl = g;
  }

  function panel(LD, i) {
    const p = root.querySelector(".lv-panel"); if (i == null) { p.classList.remove("on"); R && R.lbls.forEach((e) => e.classList.remove("sel")); return; }
    const st = LD.stations[i]; const s = st.step; const W = window.DW;
    const grp = (W.GROUPS || []).find((g) => g.id === s.who); const sys = W.SYSTEMS.find((x) => x.id === s.sys);
    const list = st.items.slice(0, 30);
    p.querySelector(".lv-pbody").innerHTML = `<div class="lv-eyebrow">Station ${i + 1} von ${LD.stations.length}${st.state === "hot" ? ' <span class="tag" style="background:rgba(239,68,68,.12);color:#ef4444">Engpass</span>' : st.state === "warn" ? ' <span class="tag" style="background:rgba(245,158,11,.14);color:#b45309">verzögert</span>' : ""}</div>
      <h2>${esc(s.n)}</h2><p>${esc(s.txt || "")}</p>
      <div class="facts"><div><b>${st.dim ? "–" : st.items.length}</b><span>Vorgänge</span></div><div class="${st.old ? (st.old >= 3 ? "bad" : "warn") : ""}"><b>${st.dim ? "–" : st.old}</b><span>über 2 Tage</span></div><div class="${st.sla ? "bad" : ""}"><b>${LD.isLive && !st.dim ? st.sla : "–"}</b><span>SLA verletzt</span></div></div>
      <dl><dt>Zuständig</dt><dd>${esc(grp ? grp.n : s.who || "–")}</dd><dt>Programm</dt><dd>${esc(sys ? sys.name : "–")}</dd><dt>Übergibt</dt><dd>${esc(s.gives || "–")}</dd><dt>Übliche Dauer</dt><dd>${String(s.days ?? "–").replace(".", ",")} Tage</dd></dl>
      ${st.dim ? '<p class="note">Diese Station ist im GF Tracker kein eigener Status. Die Daten kommen mit der Anbindung von Service-App, Inform und DocuWare.</p>'
        : !LD.isLive ? `<p class="note">Beispieldaten aus der Systemlandschaft${s.open ? `: ${esc(s.open)}` : ""}. Echte Zahlen folgen mit der Anbindung der Programme.</p>`
        : list.length ? `<h3 style="margin-top:4px">Vorgänge an dieser Station</h3>${list.map((it) => `<a class="it" href="${esc(rel(it.url))}" target="_blank" rel="noopener"><i style="background:#${tokenColor(it).toString(16).padStart(6, "0")}"></i><span style="min-width:0"><b>${esc(it.key)} · ${esc(it.summary)}</b><small>${esc(TYPE_TXT[it.type] || it.type)} · ${esc(it.statusName)}${it.assignee ? ` · ${esc(it.assignee)}` : " · nicht zugewiesen"}</small></span><em class="${it.sla ? "sla" : it.ageH > OLD_H ? "old" : ""}">${it.sla ? "SLA" : age(it.ageH)}</em></a>`).join("")}${st.items.length > 30 ? `<p class="note" style="margin-top:8px">… und ${st.items.length - 30} weitere</p>` : ""}`
        : '<p class="note">Keine Vorgänge an dieser Station – alles im Fluss.</p>'}`;
    p.classList.add("on"); R.lbls.forEach((e, k) => e.classList.toggle("sel", k === i));
  }
  const rel = (u) => { const d = live(); return d && u && u.startsWith(d.appUrl) ? u.slice(d.appUrl.length) || "/" : u || "#"; };

  function selectStation(i) {
    if (!R) return; R.sel = i; panel(R.LD, i);
    if (i != null) { const p = R.stObjs[i].pos; R.camTarget.set(p.x, 0, p.z); } else R.camTarget.set(0, 0, 0);
  }

  function toast(text) { const t = root.querySelector(".toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2600); }

  /* ───────────── Lauf ───────────── */
  const tmpV = new THREE.Vector3();
  function frame() {
    if (!R) return; R.raf = requestAnimationFrame(frame);
    const now = performance.now(); const dt = Math.min(0.12, (now - (R.last || now)) / 1000); R.last = now; const t = (now - R.t0) / 1000;
    // Aufbau: Stationen steigen nacheinander auf
    R.stObjs.forEach((o, i) => { const k = Math.min(1, Math.max(0, (t - 0.15 - i * 0.09) / 0.7)); o.g.scale.y = reduce ? 1 : Math.max(0.001, easeBack(k));
      if (o.st.state !== "ok") { const pulse = (Math.sin(t * (o.st.state === "hot" ? 4.2 : 2.4)) + 1) / 2; o.ring.material.opacity = 0.18 + pulse * 0.42; o.ring.scale.setScalar(1 + pulse * 0.06); }
      o.mat.emissive.setHex(R.hover === i || R.sel === i ? 0x2f6bff : 0x000000); o.mat.emissiveIntensity = R.hover === i || R.sel === i ? 0.12 : 0; });
    if (!reduce) { R.dash.offset.x -= dt * 0.9; R.flag.rotation.y = Math.sin(t * 2) * 0.15; }
    R.sparks.forEach((m) => { m.userData.u = (m.userData.u + dt * 0.035) % 1; m.position.copy(R.T.curve.getPointAt(m.userData.u)); m.position.y = 0.22; m.material.opacity = 0.35 + 0.55 * Math.sin(m.userData.u * Math.PI); });
    // Spielsteine
    for (const [id, tk] of R.tokens) {
      const a = tk.anim; const m = tk.m;
      if (a) {
        a.t += dt; const k = Math.min(1, Math.max(0, a.t / a.dur)); const e = ease(k);
        if (a.kind === "drop") { if (a.t < 0) continue; const b = easeBack(k); m.position.lerpVectors(a.from, a.to, Math.min(1, b)); if (k > 0.98) m.position.y = a.to.y; }
        else if (a.kind === "slide") m.position.lerpVectors(a.from, a.to, e);
        else {
          const u = a.u0 + (a.u1 - a.u0) * Math.min(1, e / 0.85);
          R.T.curve.getPointAt(Math.min(1, Math.max(0, u)), tmpV); tmpV.y = 0.55 + Math.abs(Math.sin(k * Math.PI * 6)) * 0.35 * (1 - k);
          if (e > 0.85) tmpV.lerp(a.to, (e - 0.85) / 0.15);
          m.position.copy(tmpV); m.rotation.y += dt * 4;
        }
        if (k >= 1) {
          tk.anim = null; m.rotation.y = 0;
          if (a.finish) { R.scene.remove(m); m.material.dispose(); R.tokens.delete(id); confetti(R, R.T.goal); pop(R, R.T.goal, "+1 erledigt"); }
        }
      } else if (!reduce) { m.position.y = tk.target.y + Math.sin(t * 1.6 + tk.phase) * 0.025; }
      const hov = R.hoverToken === id; m.scale.setScalar(hov ? 1.18 : 1);
    }
    // Konfetti & Einblendungen
    R.confetti = R.confetti.filter((c) => { c.t += dt; c.v.y -= 9 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.r.x * dt; c.m.rotation.y += c.r.y * dt; c.m.material.opacity = Math.max(0, 1 - c.t / 1.6);
      if (c.t > 1.6 || c.m.position.y < 0) { R.scene.remove(c.m); c.m.material.dispose(); return false; } return true; });
    // Kamera gleitet zum Ziel (Station oder Mitte)
    const d = R.camTarget.clone().sub(R.controls.target).multiplyScalar(Math.min(1, dt * 3.2));
    if (d.lengthSq() > 1e-6) { R.controls.target.add(d); R.camera.position.add(d); }
    R.controls.update(); R.renderer.render(R.scene, R.camera);
    // HTML-Beschriftungen an die Stationen heften
    const W = R.renderer.domElement.clientWidth, H = R.renderer.domElement.clientHeight;
    const place = (el, p, dy) => { tmpV.copy(p); tmpV.y += dy; tmpV.project(R.camera); const x = (tmpV.x + 1) / 2 * W, y = (1 - tmpV.y) / 2 * H; el.style.transform = `translate(${x - el.offsetWidth / 2}px,${y - el.offsetHeight}px)`; el.style.visibility = tmpV.z < 1 ? "visible" : "hidden"; };
    R.stObjs.forEach((o, i) => { const layers = Math.min(MAX_LAYERS, Math.ceil(o.st.items.length / PER_LAYER)); place(R.lbls[i], o.pos, (o.g.scale.y) * (1.2 + layers * 0.56)); });
    place(R.goalLbl, R.T.goal, 3.2);
    R.pops = R.pops.filter((p) => { p.t += dt; place(p.el, p.pos, p.t * 1.6); p.el.style.opacity = String(Math.max(0, 1 - p.t / 1.4)); if (p.t > 1.4) { p.el.remove(); return false; } return true; });
  }

  function pick(ev) {
    const rc = R.renderer.domElement.getBoundingClientRect();
    R.mouse.set(((ev.clientX - rc.left) / rc.width) * 2 - 1, -((ev.clientY - rc.top) / rc.height) * 2 + 1);
    R.raycaster.setFromCamera(R.mouse, R.camera);
    const objs = [...[...R.tokens.values()].map((t) => t.m), ...R.stObjs.flatMap((o) => [o.plat, o.strip])];
    const hit = R.raycaster.intersectObjects(objs, false)[0];
    return hit ? hit.object.userData : null;
  }
  function onMove(ev) {
    if (!R) return; const u = pick(ev); const tip = root.querySelector(".tip");
    R.hover = u && u.station != null ? u.station : null; R.hoverToken = u && u.token ? u.token : null;
    const tk = R.hoverToken && R.tokens.get(R.hoverToken);
    if (tk) {
      const it = tk.it; tip.innerHTML = it.sample ? `<b>Vorgang (Beispiel)</b><span>${esc(R.LD.stations[tk.si].step.n)}</span>` : `<b>${esc(it.key)} · ${esc(it.summary)}</b><span>${esc(TYPE_TXT[it.type] || it.type)} · ${PRIO_TXT[it.prio] || ""} · seit ${age(it.ageH)}${it.sla ? " · SLA verletzt" : ""}${it.assignee ? ` · ${esc(it.assignee)}` : ""}</span>`;
      tip.style.transform = `translate(${ev.clientX + 14}px,${ev.clientY + 14}px)`; tip.classList.add("on");
    } else tip.classList.remove("on");
    R.renderer.domElement.style.cursor = u ? "pointer" : "grab";
  }
  let downAt = null;
  function onDown(ev) { downAt = [ev.clientX, ev.clientY]; }
  function onUp(ev) {
    const d0 = downAt; downAt = null;
    if (!R || !d0 || ev.target !== R.renderer.domElement || Math.hypot(ev.clientX - d0[0], ev.clientY - d0[1]) > 5) return;
    const u = pick(ev); if (!u) return selectStation(null);
    if (u.token) { const tk = R.tokens.get(u.token); if (tk && !tk.it.sample && tk.it.url) window.open(rel(tk.it.url), "_blank", "noopener"); else if (tk) selectStation(tk.si); return; }
    if (u.station != null) selectStation(u.station);
  }
  function onKey(ev) {
    if (!R) return; const P = window.DW.PROCESSES; const idx = P.indexOf(R.LD.proc);
    if (ev.key === "Escape") { if (R.sel != null) selectStation(null); else close(); }
    if (ev.key === "ArrowRight") open(P[(idx + 1) % P.length].id);
    if (ev.key === "ArrowLeft") open(P[(idx - 1 + P.length) % P.length].id);
  }
  function onResize() {
    if (!R) return; const W = window.innerWidth, H = window.innerHeight; const c = R.camera; const v = c.top;
    c.left = -v * W / H; c.right = v * W / H; c.updateProjectionMatrix(); R.renderer.setSize(W, H);
  }

  function teardown() {
    if (!R) return; cancelAnimationFrame(R.raf); R.controls.dispose();
    R.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
    R.renderer.dispose(); R.renderer.domElement.remove(); root.querySelectorAll(".lbl,.pop").forEach((e) => e.remove()); R = null;
  }

  function open(id) {
    const W = window.DW; if (!W) return; const proc = W.PROCESSES.find((p) => p.id === id) || W.PROCESSES[0];
    if (!root) {
      root = document.createElement("div"); root.id = "lvl"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Prozess-Level");
      root.innerHTML = `<div class="g lv-head"></div><div class="g lv-stats"></div><div class="g lv-mission"></div><div class="g lv-levels" role="tablist" aria-label="Level"></div>
        <aside class="g lv-panel" aria-live="polite"><button class="lv-x" aria-label="Station schließen">×</button><div class="lv-pbody"></div></aside><div class="tip"></div><div class="toast"></div>
        <div class="hint">Ziehen drehen · Scrollen zoomen · ← → Level · Esc zurück</div>`;
      document.body.appendChild(root);
      root.querySelector(".lv-x").addEventListener("click", () => selectStation(null));
      root.addEventListener("pointermove", onMove); root.addEventListener("pointerdown", onDown); root.addEventListener("pointerup", onUp);
      window.addEventListener("keydown", onKey); window.addEventListener("resize", onResize);
      requestAnimationFrame(() => root.classList.add("on"));
    }
    teardown(); window.DWPaused = true;
    const LD = levelData(proc); R = build(LD); R.LD = LD; R.sel = null;
    hud(LD); labels(R, LD); panel(LD, null); syncTokens(R, LD, false); frame();
    if (location.hash !== `#level=${proc.id}`) history.replaceState(null, "", `#level=${proc.id}`);
  }
  function close() {
    if (!root) return; teardown(); window.DWPaused = false;
    window.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize);
    root.classList.remove("on"); const r = root; root = null; setTimeout(() => r.remove(), 450);
    history.replaceState(null, "", location.pathname + location.search);
  }
  // Live-Aktualisierung: neue/weitergerückte/abgeschlossene Vorgänge laufen sichtbar über die Strecke
  function update() {
    if (!R || !R.LD.isLive && R.LD.proc.id !== LIVE_PROC) return;
    const before = R.LD; const LD = levelData(before.proc); R.LD = LD;
    // Beschriftungen und Anzeigen auffrischen, Szene bleibt stehen
    hud(LD); labels(R, LD); if (R.sel != null) panel(LD, R.sel);
    R.stObjs.forEach((o, i) => { const st = LD.stations[i]; o.st = st; const c = stateCol(st.state);
      o.strip.material.color.setHex(c); o.ring.material.color.setHex(c); if (st.state === "ok") o.ring.material.opacity = 0; });
    syncTokens(R, LD, true);
    const gained = LD.stars - before.stars; if (gained > 0) toast(`★ Neuer Stern – ${LD.missions.filter((m) => m.done).map((m) => m.t).join(", ")}`);
  }

  window.GFTLevel = { open, close, update, get isOpen() { return !!R; } };
})();
