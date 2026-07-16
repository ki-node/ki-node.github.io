# Orbit

Orbit ist der gemeinsame Projekt-Hub für das Web unter `https://ki-node.github.io/` und die native
Capacitor-iPhone-App. Die Oberfläche basiert auf Vite, TypeScript und Vanilla DOM. Capacitor bindet
denselben Build lokal in die iOS-App ein; es wird keine externe Server-URL verwendet.

`ki-node` bleibt der technische Organisations-, Repository- und Hosting-Kontext. Der sichtbare
Produktname im Web und auf iOS ist ausschließlich Orbit.

Der aktuelle Projektkatalog enthält Portfolio, Poster und Blackbox. Alle drei Projekte sind in
der nativen App als versionsfixierte Offline-Builds integriert und auf ihre endgültigen
Squash-Merge-Commits festgeschrieben. Die Architekturentscheidung ist unter
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

## Branding

Der sichtbare Produktname lautet **Orbit**. Bundle-ID, GitHub-Organisation, Repository-Namen,
Hosting-URLs und interne Bridge-Bezeichner behalten ihren technischen `ki-node`-Kontext.

Das finale iOS-Marketing- und Homescreen-Icon liegt als opake 1024×1024-PNG unter
`ios/App/App/Assets.xcassets/AppIcon.appiconset/Orbit-AppIcon-1024.png`. Der native Launchscreen
verwendet die zugehörigen skalierten Assets aus `OrbitLaunchMark.imageset`; die Web-Hülle nutzt
`public/orbit-app-icon.png`. Die Dateien in `Splash.imageset` verwenden dieselbe Orbit-Bildmarke
auf dem durchgängigen tiefblauen Hintergrund.

## Eingebettete Projektversionen

[`projects.lock.json`](projects.lock.json) ist die zentrale, maschinenlesbare
Versionsfixierung für lokale Projekt-Builds:

```text
Portfolio: ki-node/portfolio@07c6b7eb09bd3d0577d49df657fed2d58097f018
           npm run build:embedded → public/projects/portfolio/
Poster:    ki-node/poster@755de154b6426c912d7af0caab9e45c75aa4fc7b
           npm run build:embedded → public/projects/poster/
Blackbox:  ki-node/blackbox@50c7dfbb79704e1d422bc739d49cbb28cfd21640
           npm run build:embedded → public/projects/blackbox/
```

`npm run sync:projects` liest ausschließlich diese Lock-Datei, legt je Projekt außerhalb des
Repositories einen temporären Checkout des exakten Commits an, führt dort `npm ci`
und `npm run build:embedded` aus und validiert alle aktiven Asset-Referenzen. Erst
nach erfolgreicher Prüfung ersetzt das Skript den jeweiligen Zielordner vollständig.
Temporäre Quellen und `node_modules` werden anschließend entfernt und nie in den Hub
übernommen.

Die Projekte können auch unabhängig synchronisiert werden, etwa mit
`npm run sync:projects -- poster`. Der erzeugte Inhalt unter `public/projects/<id>/` ist bewusst
eingecheckt. Er gehört zum nativen App-Bundle, muss nach der Installation ohne Netzwerk verfügbar
sein und wird von Vite unverändert nach `dist/projects/<id>/` kopiert. Eine zusätzliche
`ki-node-project.json` dokumentiert Repository, Commit und Build-Befehl direkt am Artefakt.

Im nativen Capacitor-Kontext löst die zentrale Runtime alle drei Projekte als
`./projects/<id>/index.html` auf. Der Web-Hub verwendet dagegen weiterhin
`https://ki-node.github.io/portfolio/`, `https://ki-node.github.io/poster/` beziehungsweise
`https://ki-node.github.io/blackbox/`.

### Eingebettetes Projekt aktualisieren

Eine neue Version wird niemals automatisch von `main` übernommen. Für ein bewusstes
Update:

1. vollständigen Commit-SHA in `projects.lock.json` ändern,
2. `npm run sync:projects` ausführen,
3. erzeugte Änderungen unter `public/projects/<id>/` prüfen,
4. `npm run check`, `npm run build` und `npx cap sync ios` ausführen und gemeinsam
   mit der Lock-Datei committen.

CI erzeugt den Build erneut und schlägt fehl, sobald Lock-Datei, Provenienz oder
eingechecktes Artefakt voneinander abweichen.

Portfolio, Poster und Blackbox sind jeweils auf ihren endgültigen Squash-Merge-Commit
festgeschrieben. Blackbox verwendet
`50c7dfbb79704e1d422bc739d49cbb28cfd21640` aus dem gemergten
[Blackbox-PR #17](https://github.com/ki-node/blackbox/pull/17). Der zuvor gepinnte Feature-Stand
wurde auf einem iPhone 17 Pro mit iOS 26.5.2 vollständig erfolgreich getestet; der finale
Squash-Commit besitzt denselben Quellbaum und erzeugt abgesehen vom Provenienz-SHA denselben Build.

## Native Projekt-Bridge und Kaltstart

Der lokale Portfolio-Build meldet ausschließlich `mailto:`- und externe
`https:`-Links über ein versioniertes `postMessage`-Schema. Der Hub akzeptiert
diese Nachrichten nur vom aktuell aktiven Portfolio-iframe und öffnet die URL im
nativen Kontext mit dem offiziellen Capacitor-App-Launcher. Projektkennung,
Protokollversion, Nachrichtentyp und URL-Scheme werden vor jedem nativen Aufruf
validiert; die iframe-Sandbox erhält keine Top-Navigationsrechte.

Poster übergibt im nativen Embedded-Kontext ausschließlich validierte PNG-Daten als strukturiert geklonten
`ArrayBuffer` über die versionierte Bridge. Orbit akzeptiert nur das aktive Poster-iframe, Version
1, MIME-Typ `image/png`, eine korrekte PNG-Signatur und höchstens 48 MiB. Der Hub bereinigt den
Dateinamen, schreibt eine hostgenerierte temporäre Cache-Datei, öffnet genau einmal das iOS-
Share-Sheet und entfernt die Datei anschließend. Abbruch ist ein kontrolliertes Ergebnis.

Blackbox sendet semantische Haptik über einen getrennten Kanal. Orbit akzeptiert ausschließlich
Nachrichten des aktuell aktiven Blackbox-iframe in diesem Format:

```json
{
    "channel": "ki-node.project-bridge",
    "type": "haptic",
    "protocolVersion": 1,
    "project": "blackbox",
    "event": "light | medium | heavy | success | warning | error"
}
```

`light`, `medium` und `heavy` werden auf die offiziellen Capacitor-Impact-Typen abgebildet;
`success`, `warning` und `error` verwenden die entsprechenden Notification-Typen. Fremde oder
alte iframe-Quellen, zusätzliche Parameter und ungültige Datentypen werden verworfen. Beim Öffnen
oder Laden entsteht keine Blackbox-Haptik, und Fehler des nativen Plugins bleiben sichere No-ops.
Blackbox erhält weder Downloads, Clipboard noch andere zusätzliche iframe-Berechtigungen. Der
Spielstand bleibt ausschließlich im Projekt unter `black-box-progress-v2`; Orbit liest oder
löscht ihn nicht.

Im Web-Hub bleibt `allow-downloads` projektspezifisch für Posters normalen Browser-Download aktiv.
Der native Poster-iframe benötigt dieses Recht nicht mehr und kann deshalb nicht zur Blob-Grafik
navigieren. `clipboard-write` bleibt ausschließlich bei Poster für Seed und Konfigurationslink;
Clipboard wurde nicht in die Datei-Bridge einbezogen. Portfolio und Blackbox erhalten diese Rechte
nicht, und die Sandbox wird nicht global aufgeweicht.

Ein statischer dunkelvioletter Orbit-Launchscreen überbrückt den beobachteten
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
