# ki-node

Gemeinsamer Projekt-Hub für das Web unter `https://ki-node.github.io/` und die native
Capacitor-iPhone-App. Die Oberfläche basiert auf Vite, TypeScript und Vanilla DOM. Capacitor bindet
denselben Build lokal in die iOS-App ein; es wird keine externe Server-URL verwendet.

Der aktuelle Projektkatalog enthält Portfolio, Poster und Blackbox. Portfolio ist in der nativen
App als versionsfixierter Offline-Build integriert; Poster und Blackbox verwenden weiterhin ihre
lokalen Mock-Projekte. Die Architekturentscheidung ist unter
[`docs/architecture.md`](docs/architecture.md) dokumentiert.

## Voraussetzungen

- Node.js 22 oder neuer
- npm
- macOS mit Xcode 26.6 für den nativen Build

## Lokale Entwicklung

> [!IMPORTANT]
> Nach einem frischen Clone muss zwingend zuerst `npm ci` ausgeführt werden, bevor das
> Xcode-Projekt geöffnet oder gebaut wird. Das lokale Swift-Paket in
> `ios/App/CapApp-SPM/Package.swift` verweist auf lokale Capacitor-Pakete unter `node_modules`,
> darunter Haptics, App Launcher und Splash Screen. Ohne
> installierte npm-Abhängigkeiten kann Xcode dieses Paket nicht auflösen.

```bash
npm ci
npm run sync:projects
npm run check
npm run build
npx cap sync ios
npx cap open ios
```

`npm run dev` startet dieselbe Hub-Oberfläche im Browser. Native Haptik wird dort zentral als nicht
verfügbar behandelt und erzeugt keinen Fehler.

## Eingebettete Projektversionen

[`projects.lock.json`](projects.lock.json) ist die zentrale, maschinenlesbare
Versionsfixierung für lokale Projekt-Builds. Portfolio ist derzeit auf folgenden
Stand festgeschrieben:

```text
Repository:    ki-node/portfolio
Commit:        25b8cebe32421c774dbad64f140196599c94d4b5
Build-Befehl:  npm run build:embedded
Ziel:          public/projects/portfolio/
```

`npm run sync:projects` liest ausschließlich diese Lock-Datei, legt außerhalb des
Repositories einen temporären Checkout des exakten Commits an, führt dort `npm ci`
und `npm run build:embedded` aus und validiert alle aktiven Asset-Referenzen. Erst
nach erfolgreicher Prüfung ersetzt das Skript den bisherigen Zielordner vollständig.
Temporäre Quellen und `node_modules` werden anschließend entfernt und nie in den Hub
übernommen.

Der erzeugte Inhalt unter `public/projects/portfolio/` ist bewusst eingecheckt. Er
gehört zum nativen App-Bundle, muss nach der Installation ohne Netzwerk verfügbar
sein und wird von Vite unverändert nach `dist/projects/portfolio/` kopiert. Eine
zusätzliche `ki-node-project.json` im Build dokumentiert Repository, Commit und
Build-Befehl direkt am Artefakt.

Im nativen Capacitor-Kontext löst die zentrale Runtime Portfolio als
`./projects/portfolio/index.html` auf. Der Web-Hub verwendet dagegen weiterhin
`https://ki-node.github.io/portfolio/`. Poster und Blackbox bleiben in beiden
Laufzeiten auf ihren bisherigen Mock-URLs.

### Portfolio aktualisieren

Eine neue Version wird niemals automatisch von `main` übernommen. Für ein bewusstes
Update:

1. vollständigen Commit-SHA in `projects.lock.json` ändern,
2. `npm run sync:projects` ausführen,
3. erzeugte Änderungen unter `public/projects/portfolio/` prüfen,
4. `npm run check`, `npm run build` und `npx cap sync ios` ausführen und gemeinsam
   mit der Lock-Datei committen.

CI erzeugt den Build erneut und schlägt fehl, sobald Lock-Datei, Provenienz oder
eingechecktes Artefakt voneinander abweichen.

Der aktuell festgeschriebene SHA gehört zum Draft-Feature-Branch des Portfolio-
Folge-PRs. Nach dessen Merge muss dieser Hub-Branch vor dem Merge noch einmal auf
den endgültigen Squash-Merge-Commit umgestellt und vollständig synchronisiert
werden.

## Native Projekt-Bridge und Kaltstart

Der lokale Portfolio-Build meldet ausschließlich `mailto:`- und externe
`https:`-Links über ein versioniertes `postMessage`-Schema. Der Hub akzeptiert
diese Nachrichten nur vom aktuell aktiven Portfolio-iframe und öffnet die URL im
nativen Kontext mit dem offiziellen Capacitor-App-Launcher. Projektkennung,
Protokollversion, Nachrichtentyp und URL-Scheme werden vor jedem nativen Aufruf
validiert; die iframe-Sandbox erhält keine Top-Navigationsrechte.

Ein statischer dunkelvioletter ki-node-Launchscreen überbrückt den beobachteten
kalten Start des WKWebView-Prozesses. Er wird nach Hub-Initialisierung und zwei
Animation Frames über `@capacitor/splash-screen` ausgeblendet. Die native
Konfiguration besitzt zusätzlich eine automatische Obergrenze von 15 Sekunden;
die statische Web-Schicht fällt nach 16 Sekunden zurück. Das verdeckt die
beobachtete Wartezeit visuell, beschleunigt den WKWebView-Kaltstart aber nicht.

## Veröffentlichung

Pull Requests bauen und prüfen den Hub über `.github/workflows/ci.yml`, veröffentlichen ihn aber
nicht. Nur ein erfolgreicher Push auf `main` startet `.github/workflows/deploy.yml` und überträgt
das erzeugte `dist`-Artefakt zu GitHub Pages.

## iOS-Projekt

Die iOS-Plattform nutzt Swift Package Manager. Das Xcode-Projekt liegt unter:

```text
ios/App/App.xcodeproj
```

### Lokale Codesignierung

Die persönliche Apple-Team-ID bleibt ausschließlich in einer ignorierten lokalen
xcconfig-Datei. Nach einem frischen Clone:

```bash
cp ios/signing.local.xcconfig.example ios/signing.local.xcconfig
```

Anschließend in `ios/signing.local.xcconfig` den Platzhalter durch die eigene
Apple-Team-ID ersetzen:

```xcconfig
DEVELOPMENT_TEAM = YOUR_APPLE_TEAM_ID
```

Danach `ios/App/App.xcodeproj` in Xcode öffnen und normal für ein Gerät bauen.
Debug- und Release-Konfigurationen laden die lokale Datei optional, sodass Xcode
die Signierung verwenden kann, ohne `DEVELOPMENT_TEAM` in
`project.pbxproj` einzutragen. Fehlt die lokale Datei, funktionieren Web-Build,
Capacitor-Sync und CI weiterhin ohne persönliche Signierungsdaten.

`git update-index --skip-worktree` wird hierfür bewusst nicht verwendet: Das
könnte echte spätere Änderungen an der Xcode-Projektdatei lokal verbergen.

Capacitor verwaltet die Abhängigkeiten in `ios/App/CapApp-SPM`. Dieser Ordner sollte nicht manuell
bearbeitet werden. Apple Watch und Apple TV sind noch nicht Teil dieses Grundgerüsts; spätere
native Begleit-Targets können im bestehenden Xcode-Projekt ergänzt werden.
