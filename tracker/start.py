#!/usr/bin/env python3
"""GF Tracker – Starter für den eigenen Server oder PC (Windows, Linux, macOS).

Nur Python 3.8+ nötig, keine Zusatzpakete. Der Starter
  * besorgt beim ersten Mal die passende Node.js-Laufzeit (offizieller Download, Prüfsumme wird geprüft),
  * fragt die Grundeinstellungen ab und legt die Datei .env an,
  * startet den Tracker samt Systemlandschaft (3D), überwacht ihn und startet ihn nach einem Absturz neu,
  * trägt ihn auf Wunsch als Dienst ein, der beim Hochfahren des Servers startet.

Aufrufe (im Ordner "tracker"):
  python start.py                      Einrichten (beim ersten Mal) und starten
  python start.py --demo               Ausprobieren mit Beispieldaten (eigener Datenordner)
  python start.py --selbsttest         Prüfen, ob alles funktioniert (startet kurz mit Beispieldaten)
  python start.py --dienst-einrichten  Autostart als Dienst (Windows: Aufgabenplanung, Linux: systemd)
  python start.py --dienst-entfernen   Autostart wieder entfernen
  python start.py --einrichten         Einstellungen neu abfragen
Windows: Doppelklick auf start.bat genügt.
"""
import argparse
import hashlib
import http.cookiejar
import json
import os
import platform
import shutil
import signal
import socket
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import urllib.error
import urllib.request
import webbrowser
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / "runtime"
LOGS = ROOT / "logs"
ENV_FILE = ROOT / ".env"
NODE_VERSION = "22.22.0"   # getestete Version (Langzeitversion)
MIN_NODE = (22, 13)
DEMO_LOGIN = ("thomas.weber@druckluft-chemnitz.de", "Passwort123!")
IS_WIN = os.name == "nt"

for stream in (sys.stdout, sys.stderr):  # Umlaute auch in alten Windows-Konsolen
    try:
        stream.reconfigure(errors="replace")
    except Exception:
        pass


def say(msg=""):
    print(msg, flush=True)


def fail(msg):
    say(f"\nFEHLER: {msg}")
    sys.exit(1)


# ───────────────────────── Node.js-Laufzeit ─────────────────────────

def node_version(exe):
    try:
        out = subprocess.run([str(exe), "--version"], capture_output=True, text=True, timeout=15).stdout.strip()
        return tuple(int(x) for x in out.lstrip("v").split(".")[:2])
    except Exception:
        return None


def runtime_dist():
    """Name des offiziellen Node.js-Pakets für dieses System."""
    machine = platform.machine().lower()
    arch = "arm64" if machine in ("arm64", "aarch64") else "x64" if machine in ("x86_64", "amd64", "x64") else None
    if not arch:
        fail(f"Prozessortyp {platform.machine()} wird nicht unterstützt. Bitte Node.js {MIN_NODE[0]}.{MIN_NODE[1]}+ selbst installieren.")
    if IS_WIN:
        return f"node-v{NODE_VERSION}-win-{arch}", ".zip"
    if sys.platform == "darwin":
        return f"node-v{NODE_VERSION}-darwin-{arch}", ".tar.gz"
    return f"node-v{NODE_VERSION}-linux-{arch}", ".tar.xz"


def runtime_exe():
    name, _ = runtime_dist()
    return RUNTIME / name / ("node.exe" if IS_WIN else "bin/node")


def safe_extract_tar(tf, dest):
    dest = dest.resolve()
    for m in tf.getmembers():
        target = (dest / m.name).resolve()
        if not str(target).startswith(str(dest)) or m.issym() and os.path.isabs(m.linkname):
            raise RuntimeError(f"Unerwarteter Pfad im Archiv: {m.name}")
    if hasattr(tarfile, "data_filter"):
        tf.extractall(dest, filter="data")
    else:
        tf.extractall(dest)


def download(url, target):
    req = urllib.request.Request(url, headers={"User-Agent": "gf-tracker-start"})
    with urllib.request.urlopen(req, timeout=120) as r, open(target, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0); got = 0; last = 0
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            f.write(chunk); got += len(chunk)
            if total and time.time() - last > 1:
                last = time.time(); print(f"\r  {got * 100 // total:3d} % von {total // 1048576} MB", end="", flush=True)
    if total:
        print(f"\r  100 % von {total // 1048576} MB", flush=True)


def ensure_node():
    """Vorhandenes Node.js ab 22.13 nutzen, sonst die geprüfte Version in ./runtime ablegen."""
    exe = runtime_exe()
    if exe.exists() and (node_version(exe) or (0,)) >= MIN_NODE:
        return exe
    system = shutil.which("node")
    if system and (node_version(system) or (0,)) >= MIN_NODE:
        return Path(system)
    name, ext = runtime_dist()
    base = f"https://nodejs.org/dist/v{NODE_VERSION}/"
    say(f"Node.js {NODE_VERSION} wird einmalig heruntergeladen (nodejs.org) …")
    try:
        sums = urllib.request.urlopen(urllib.request.Request(base + "SHASUMS256.txt", headers={"User-Agent": "gf-tracker-start"}), timeout=60).read().decode()
    except (urllib.error.URLError, OSError) as e:
        fail(f"Download nicht möglich ({e}).\nOhne Internet: Node.js {NODE_VERSION} von https://nodejs.org herunterladen und das Archiv nach {RUNTIME} entpacken.")
    expected = next((l.split()[0] for l in sums.splitlines() if l.endswith("  " + name + ext)), None)
    if not expected:
        fail(f"Paket {name}{ext} nicht gefunden.")
    RUNTIME.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=RUNTIME) as tmp:
        archive = Path(tmp) / (name + ext)
        download(base + name + ext, archive)
        h = hashlib.sha256()
        with open(archive, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        if h.hexdigest() != expected:
            fail("Prüfsumme des Downloads stimmt nicht – Datei beschädigt oder verändert. Bitte erneut versuchen.")
        say("  Prüfsumme ok, wird entpackt …")
        if ext == ".zip":
            with zipfile.ZipFile(archive) as z:
                dest = RUNTIME.resolve()
                for n in z.namelist():
                    if not str((dest / n).resolve()).startswith(str(dest)):
                        fail(f"Unerwarteter Pfad im Archiv: {n}")
                z.extractall(RUNTIME)
        else:
            with tarfile.open(archive) as tf:
                safe_extract_tar(tf, RUNTIME)
    if not exe.exists() or (node_version(exe) or (0,)) < MIN_NODE:
        fail("Node.js konnte nicht eingerichtet werden.")
    say(f"  Node.js {NODE_VERSION} bereit.\n")
    return exe


# ───────────────────────── Einstellungen (.env) ─────────────────────────

def read_env(path=ENV_FILE):
    vals = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals


def lan_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))  # sendet nichts, ermittelt nur die Netzwerkkarte
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def ask(question, default="", interactive=True):
    if not interactive:
        return default
    try:
        answer = input(f"  {question}{f' [{default}]' if default else ''}: ").strip()
    except EOFError:
        answer = ""
    return answer or default


def setup(args, interactive=True):
    """Erste Einrichtung: fragt die wichtigsten Werte ab und schreibt .env."""
    old = read_env()
    say("\nEinrichtung des GF Trackers (Enter übernimmt den Vorschlag in Klammern)\n")
    company = ask("Firmenname", old.get("COMPANY_NAME", args.firma or "druckluft-technik Chemnitz GmbH"), interactive)
    admin_email = ask("E-Mail des ersten Administrators", old.get("ADMIN_EMAIL", args.admin_email or ""), interactive)
    while interactive and "@" not in admin_email:
        admin_email = ask("Bitte eine gültige E-Mail-Adresse eingeben", "", interactive)
    if not admin_email:
        admin_email = "admin@druckluft-chemnitz.de"
    admin_name = ask("Name des Administrators", old.get("ADMIN_NAME", args.admin_name or "Administrator"), interactive)
    say("\n  HTTPS: Mit einem Zertifikat (PEM oder Windows-.pfx) läuft der Tracker verschlüsselt und lässt sich")
    say("  als App installieren. Ohne Zertifikat läuft er im Firmennetz über http://.")
    cert = ask("Zertifikatsdatei (.pfx oder .pem, leer = ohne HTTPS)", old.get("TLS_PFX") or old.get("TLS_CERT") or (args.zertifikat or ""), interactive)
    tls = {}
    if cert:
        cpath = Path(cert).expanduser().resolve()
        if not cpath.exists():
            fail(f"Zertifikatsdatei {cpath} nicht gefunden.")
        if cpath.suffix.lower() in (".pfx", ".p12"):
            tls = {"TLS_PFX": str(cpath), "TLS_PFX_PASSWORD": ask("Kennwort der .pfx-Datei (leer, wenn keins)", old.get("TLS_PFX_PASSWORD", args.zertifikat_kennwort or ""), interactive)}
        else:
            key = ask("Datei mit dem privaten Schlüssel (.pem)", old.get("TLS_KEY", args.schluessel or ""), interactive)
            kpath = Path(key).expanduser().resolve()
            if not kpath.exists():
                fail(f"Schlüsseldatei {kpath} nicht gefunden.")
            tls = {"TLS_CERT": str(cpath), "TLS_KEY": str(kpath)}
    default_port = old.get("PORT") or str(args.port or (443 if tls else 3000))
    port = ask("Port", default_port, interactive)
    host = ask("Adresse, unter der die anderen den Tracker öffnen (Servername oder DNS-Name)",
               (old.get("APP_URL", "").split("://")[-1].split(":")[0].split("/")[0]) or args.adresse or socket.getfqdn() or lan_ip(), interactive)
    scheme = "https" if tls else "http"
    url = f"{scheme}://{host}" + ("" if (scheme, port) in (("https", "443"), ("http", "80")) else f":{port}")
    vals = {"APP_URL": url, "PORT": port, "COMPANY_NAME": company, "ADMIN_EMAIL": admin_email, "ADMIN_NAME": admin_name, **tls}
    if tls and port == "443":
        vals["HTTP_REDIRECT_PORT"] = "80"
    keep = {k: v for k, v in old.items() if k not in vals and not k.startswith("TLS_") and k != "HTTP_REDIRECT_PORT"}
    lines = ["# GF Tracker – Einstellungen (angelegt von start.py; weitere Optionen siehe .env.example)", ""]
    lines += [f"{k}={v}" for k, v in vals.items()]
    if keep:
        lines += ["", "# übernommen aus der bisherigen Datei"] + [f"{k}={v}" for k, v in keep.items()]
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    try:
        os.chmod(ENV_FILE, 0o600)
    except OSError:
        pass
    say(f"\n  Gespeichert in {ENV_FILE}\n")
    return read_env()


# ───────────────────────── Starten und überwachen ─────────────────────────

def port_free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("0.0.0.0", int(port)))
            return True
        except OSError:
            return False


class Log:
    """Ausgabe des Trackers in die Konsole und nach logs/tracker.log (wird bei 5 MB gewechselt)."""
    def __init__(self, name="tracker.log", console=True):
        LOGS.mkdir(exist_ok=True)
        self.path = LOGS / name; self.console = console; self.lock = threading.Lock()

    def write(self, line):
        with self.lock:
            if self.path.exists() and self.path.stat().st_size > 5 * 1048576:
                self.path.replace(self.path.with_suffix(".log.1"))
            with open(self.path, "a", encoding="utf-8") as f:
                f.write(line + "\n")
            if self.console:
                say(line)


def start_process(node, env, log, on_line=None):
    proc = subprocess.Popen([str(node), "--disable-warning=ExperimentalWarning", "server.mjs"], cwd=str(ROOT), env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", bufsize=1,
                            creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) if IS_WIN else 0)

    def pump():
        for line in proc.stdout:
            line = line.rstrip()
            log.write(line)
            if on_line:
                on_line(line)
    threading.Thread(target=pump, daemon=True).start()
    return proc


def stop_process(proc):
    if proc.poll() is not None:
        return
    try:
        if IS_WIN:
            proc.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            proc.terminate()
        proc.wait(timeout=10)
    except Exception:
        proc.kill()


def build_env(vals, demo=False, data_dir=None):
    env = dict(os.environ)
    env.update(vals)
    env.setdefault("TZ", "Europe/Berlin")
    env.setdefault("HOST", "0.0.0.0")
    env["DATA_DIR"] = str(data_dir or Path(vals.get("DATA_DIR") or (ROOT / ("data-demo" if demo else "data"))).resolve())
    if demo:
        env["SEED_DEMO"] = "1"
    for k in ("TLS_PFX", "TLS_CERT", "TLS_KEY"):
        if env.get(k):
            env[k] = str(Path(env[k]).expanduser().resolve())
    return env


def run(args, vals):
    node = ensure_node()
    env = build_env(vals, demo=args.demo)
    port = env.get("PORT", "3000")
    if not port_free(port):
        fail(f"Port {port} ist belegt (läuft der Tracker schon?). Anderen Port wählen: python start.py --port 3010")
    url = env.get("APP_URL") or f"http://localhost:{port}"
    log = Log("demo.log" if args.demo else "tracker.log", console=not args.dienst_modus)
    ready = threading.Event(); info = {}

    def on_line(line):
        if "Startpasswort:" in line:
            info["pw"] = line.split("Startpasswort:", 1)[1].split()[0]
        if "GF Tracker läuft auf" in line:
            ready.set()

    say(f"GF Tracker wird gestartet … (Daten: {env['DATA_DIR']}, Protokoll: {log.path})")
    proc = start_process(node, env, log, on_line)
    if not ready.wait(60) or proc.poll() is not None:
        stop_process(proc)
        fail(f"Der Tracker ist nicht gestartet. Details im Protokoll: {log.path}")
    local = f"{'https' if env.get('TLS_PFX') or env.get('TLS_CERT') else 'http'}://localhost:{port}"
    say("\n" + "=" * 64)
    say("  GF Tracker läuft.")
    if env.get("HOST") == "127.0.0.1":
        say(f"  Nur auf diesem Rechner:   {local}")
        say(f"  Systemlandschaft (3D):    {local}/landschaft")
    else:
        say(f"  Für alle im Firmennetz:   {url}")
        say(f"  Systemlandschaft (3D):    {url}/landschaft")
        if not args.dienst_modus:
            say(f"  Auf diesem Rechner:       {local}")
    if args.demo:
        say(f"  Beispiel-Anmeldung:       {DEMO_LOGIN[0]}  /  {DEMO_LOGIN[1]}")
    if info.get("pw"):
        say(f"\n  ERSTE ANMELDUNG: {env.get('ADMIN_EMAIL')}  /  Startpasswort: {info['pw']}")
        say("  Bitte gleich nach dem Anmelden unter Einstellungen → Profil ändern.")
    say("  Beenden: Strg+C" if not args.dienst_modus else "  Läuft als Dienst.")
    say("=" * 64 + "\n")
    if not args.ohne_browser and not args.dienst_modus:
        try:
            webbrowser.open(local + "/login")
        except Exception:
            pass

    # Überwachung: bei einem Absturz neu starten (mit wachsender Pause), Strg+C beendet sauber
    crashes = []
    try:
        while True:
            code = proc.wait()
            crashes = [t for t in crashes if time.time() - t < 300] + [time.time()]
            log.write(f"[start.py] Tracker beendet (Code {code}) – Neustart in {min(60, 2 ** len(crashes))} s")
            if len(crashes) >= 6:
                fail(f"Der Tracker stürzt wiederholt ab. Bitte Protokoll prüfen: {log.path}")
            time.sleep(min(60, 2 ** len(crashes)))
            ready.clear()
            proc = start_process(node, env, log, on_line)
    except KeyboardInterrupt:
        say("\nWird beendet …")
        stop_process(proc)
        say("Beendet.")


# ───────────────────────── Selbsttest ─────────────────────────

def selftest(args):
    """Startet kurz eine Testinstanz mit Beispieldaten und prüft Anmeldung, Vorgänge und Systemlandschaft."""
    node = ensure_node()
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]
    tmp = Path(tempfile.mkdtemp(prefix="gft-selbsttest-"))
    env = build_env({"PORT": str(port), "HOST": "127.0.0.1", "APP_URL": f"http://127.0.0.1:{port}", "COMPANY_NAME": "Selbsttest"}, demo=True, data_dir=tmp)
    for k in ("TLS_PFX", "TLS_CERT", "TLS_KEY", "HTTP_REDIRECT_PORT"):
        env.pop(k, None)
    ready = threading.Event()
    proc = start_process(node, env, Log("selbsttest.log", console=False), lambda l: "GF Tracker läuft auf" in l and ready.set())
    base = f"http://127.0.0.1:{port}"
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), urllib.request.ProxyHandler({}))

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None
    bare = urllib.request.build_opener(NoRedirect, urllib.request.ProxyHandler({}))

    def get(path, o=opener, data=None):
        req = urllib.request.Request(base + path, data=json.dumps(data).encode() if data is not None else None,
                                     headers={"Content-Type": "application/json", "X-GFT": "1"})
        try:
            with o.open(req, timeout=20) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    results = []

    def check(name, ok):
        results.append(ok); say(f"  {'OK    ' if ok else 'FEHLER'}  {name}")
    try:
        say(f"Selbsttest mit Node.js {'.'.join(map(str, node_version(node)))} …")
        check("Server startet", ready.wait(60) and proc.poll() is None)
        st, body = get("/api/health"); check("Zustand /api/health", st == 200 and json.loads(body).get("ok"))
        check("Anmeldeseite", get("/login")[0] == 200)
        check("Ohne Anmeldung kein Zugriff", get("/landschaft", bare)[0] == 302)
        st, _ = get("/api/login", data={"email": DEMO_LOGIN[0], "password": DEMO_LOGIN[1]}); check("Anmeldung", st == 200)
        st, body = get("/api/state"); state = json.loads(body) if st == 200 else {}
        check(f"Vorgänge geladen ({len(state.get('issues', []))})", len(state.get("issues", [])) > 0)
        st, body = get("/api/landscape"); land = json.loads(body) if st == 200 else {}
        check(f"Daten für die Systemlandschaft ({len(land.get('projects', []))} Projekte)", st == 200 and len(land.get("projects", [])) > 0)
        st, body = get("/landschaft"); check("Systemlandschaft (3D) – Seite", st == 200 and b"/landschaft/world.js" in body)
        st, body = get("/landschaft/world.js"); check("Systemlandschaft (3D) – 3D-Welt", st == 200 and b"window.DW" in body)
        check("3D-Bibliothek (three.js)", get("/vendor/three/three.min.js")[0] == 200)
        check("Prozess-Level", get("/landschaft/level.js")[0] == 200)
    finally:
        stop_process(proc)
        shutil.rmtree(tmp, ignore_errors=True)
    ok = all(results)
    say("\nAlles in Ordnung – der Tracker ist einsatzbereit." if ok else f"\nEs gab Fehler. Protokoll: {LOGS / 'selbsttest.log'}")
    return 0 if ok else 1


# ───────────────────────── Dienst (Autostart) ─────────────────────────

SERVICE = "gf-tracker"


def service_install():
    py = Path(sys.executable)
    if IS_WIN:
        pyw = py.with_name("pythonw.exe")
        exe = pyw if pyw.exists() else py
        cmd = f'"{exe}" "{ROOT / "start.py"}" --dienst-modus'
        r = subprocess.run(["schtasks", "/Create", "/TN", "GF Tracker", "/TR", cmd, "/SC", "ONSTART", "/RU", "SYSTEM", "/RL", "HIGHEST", "/F"], capture_output=True, text=True)
        if r.returncode != 0:
            fail("Dienst konnte nicht eingerichtet werden – Eingabeaufforderung bitte „Als Administrator ausführen“.\n" + (r.stderr or r.stdout))
        subprocess.run(["schtasks", "/Run", "/TN", "GF Tracker"], capture_output=True)
        say("Eingerichtet: Aufgabe „GF Tracker“ startet beim Hochfahren des Servers (Aufgabenplanung).")
        say(f"Läuft jetzt im Hintergrund. Protokoll: {LOGS / 'tracker.log'}")
        say("Hinweis: Firewall-Port freigeben, z. B. (als Administrator):")
        say(f'  netsh advfirewall firewall add rule name="GF Tracker" dir=in action=allow protocol=TCP localport={read_env().get("PORT", "3000")}')
        return
    if sys.platform.startswith("linux"):
        if os.geteuid() != 0:
            fail("Bitte mit sudo ausführen: sudo python3 start.py --dienst-einrichten")
        import pwd
        owner = pwd.getpwuid(ROOT.stat().st_uid).pw_name
        port = int(read_env().get("PORT", "3000"))
        user = "root" if port < 1024 else owner
        unit = f"""[Unit]
Description=GF Tracker (Vorgänge, Service und Systemlandschaft)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={user}
WorkingDirectory={ROOT}
ExecStart={py} {ROOT / 'start.py'} --dienst-modus
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
        Path(f"/etc/systemd/system/{SERVICE}.service").write_text(unit)
        for c in (["systemctl", "daemon-reload"], ["systemctl", "enable", "--now", SERVICE]):
            subprocess.run(c, check=True)
        say(f"Eingerichtet: systemd-Dienst „{SERVICE}“ (läuft als {user}, startet beim Hochfahren).")
        say(f"Status: systemctl status {SERVICE}   Protokoll: {LOGS / 'tracker.log'}")
        return
    fail("Autostart wird hier nur für Windows und Linux eingerichtet.")


def service_remove():
    if IS_WIN:
        subprocess.run(["schtasks", "/End", "/TN", "GF Tracker"], capture_output=True)
        r = subprocess.run(["schtasks", "/Delete", "/TN", "GF Tracker", "/F"], capture_output=True, text=True)
        say("Autostart entfernt." if r.returncode == 0 else "Keine Aufgabe „GF Tracker“ gefunden (oder keine Administratorrechte).")
        return
    if sys.platform.startswith("linux"):
        if os.geteuid() != 0:
            fail("Bitte mit sudo ausführen: sudo python3 start.py --dienst-entfernen")
        subprocess.run(["systemctl", "disable", "--now", SERVICE])
        Path(f"/etc/systemd/system/{SERVICE}.service").unlink(missing_ok=True)
        subprocess.run(["systemctl", "daemon-reload"])
        say("Autostart entfernt.")


# ───────────────────────── Aufruf ─────────────────────────

def main():
    if sys.version_info < (3, 8):
        fail("Bitte Python 3.8 oder neuer verwenden.")
    ap = argparse.ArgumentParser(description="GF Tracker starten und einrichten", formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__.split("Aufrufe", 1)[1])
    ap.add_argument("--demo", action="store_true", help="mit Beispieldaten ausprobieren (eigener Ordner data-demo)")
    ap.add_argument("--selbsttest", action="store_true", help="prüfen, ob alles funktioniert")
    ap.add_argument("--einrichten", action="store_true", help="Einstellungen neu abfragen")
    ap.add_argument("--dienst-einrichten", action="store_true", help="Autostart beim Hochfahren einrichten")
    ap.add_argument("--dienst-entfernen", action="store_true", help="Autostart entfernen")
    ap.add_argument("--dienst-modus", action="store_true", help=argparse.SUPPRESS)
    ap.add_argument("--ohne-browser", action="store_true", help="Browser nicht automatisch öffnen")
    ap.add_argument("--ja", action="store_true", help="Einrichtung ohne Rückfragen (Vorschläge bzw. Angaben unten übernehmen)")
    ap.add_argument("--port", type=int, help="Port (Standard 3000, mit Zertifikat 443)")
    ap.add_argument("--adresse", help="Servername/DNS-Name für die Links, z. B. tracker.druckluft-chemnitz.de")
    ap.add_argument("--firma", help="Firmenname"); ap.add_argument("--admin-email"); ap.add_argument("--admin-name")
    ap.add_argument("--zertifikat", help=".pfx- oder .pem-Datei"); ap.add_argument("--schluessel", help="Schlüssel zur .pem-Datei")
    ap.add_argument("--zertifikat-kennwort", help="Kennwort der .pfx-Datei")
    args = ap.parse_args()
    os.chdir(ROOT)

    if args.selbsttest:
        sys.exit(selftest(args))
    if args.dienst_entfernen:
        return service_remove()
    if args.demo:
        port = args.port or 3100
        # nur auf diesem Rechner erreichbar, keine Verbindung zu anderen Programmen
        vals = {"PORT": str(port), "HOST": "127.0.0.1", "APP_URL": f"http://localhost:{port}", "COMPANY_NAME": "druckluft-technik Chemnitz GmbH (Beispieldaten)"}
        return run(args, vals)
    interactive = not (args.ja or args.dienst_modus) and sys.stdin.isatty()
    vals = read_env()
    if args.einrichten or not ENV_FILE.exists() or not vals.get("ADMIN_EMAIL"):
        if args.dienst_modus:
            fail(f"Noch nicht eingerichtet: zuerst einmal „python start.py“ ausführen ({ENV_FILE} fehlt).")
        vals = setup(args, interactive)
    if args.port:
        vals["PORT"] = str(args.port)
    if args.dienst_einrichten:
        ensure_node()
        return service_install()
    run(args, vals)


if __name__ == "__main__":
    main()
