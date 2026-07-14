# ki-node

Gemeinsamer Projekt-Hub für das Web unter `https://ki-node.github.io/` und die native
Capacitor-iPhone-App. Die Oberfläche basiert auf Vite, TypeScript und Vanilla DOM. Capacitor bindet
denselben Build lokal in die iOS-App ein; es wird keine externe Server-URL verwendet.

Der aktuelle Projektkatalog enthält Portfolio, Poster und Blackbox. Beide Laufzeiten verwenden in
diesem Stand noch ein lokales Mock-Projekt, damit Oberfläche, iframe-Lifecycle und Navigation vor
der Einbindung der echten Projekte geprüft werden können. Die Architekturentscheidung ist unter
[`docs/architecture.md`](docs/architecture.md) dokumentiert.

## Voraussetzungen

- Node.js 22 oder neuer
- npm
- macOS mit Xcode 26.6 für den nativen Build

## Lokale Entwicklung

> [!IMPORTANT]
> Nach einem frischen Clone muss zwingend zuerst `npm ci` ausgeführt werden, bevor das
> Xcode-Projekt geöffnet oder gebaut wird. Das lokale Swift-Paket in
> `ios/App/CapApp-SPM/Package.swift` verweist auf `node_modules/@capacitor/haptics`. Ohne
> installierte npm-Abhängigkeiten kann Xcode dieses Paket nicht auflösen.

```bash
npm ci
npm run check
npm run build
npx cap sync ios
npx cap open ios
```

`npm run dev` startet dieselbe Hub-Oberfläche im Browser. Native Haptik wird dort zentral als nicht
verfügbar behandelt und erzeugt keinen Fehler.

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
