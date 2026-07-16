# Architekturentscheidung: gemeinsamer Web- und App-Hub

## Entscheidung

Orbit ist die gemeinsame Produkthülle und der Einstiegspunkt für den Web-Hub unter
`https://ki-node.github.io/` und die native Capacitor-iPhone-App. Beide Varianten werden aus
derselben Vite-/TypeScript-Quellbasis gebaut und verwenden dieselbe Oberfläche, denselben
typisierten Projektkatalog und denselben iframe-Lifecycle.

`ki-node` bezeichnet weiterhin ausschließlich die technische GitHub-Organisation, Repository-
Struktur und Hosting-Domain. Sichtbare Produkt-, Launch- und Accessibility-Namen verwenden Orbit.

Der Katalog enthält je Projekt getrennte Quellen. Eine zentrale Laufzeitabstraktion erkennt Web
oder Capacitor und löst ausschließlich dort die passende URL auf:

- Die native App lädt lokale Embedded-Builds aus dem App-Bundle.
- Der Web-Hub lädt die öffentlichen GitHub-Pages-Versionen.

Portfolio und Poster sind als echte Projekte integriert. Ihre nativen Katalogeinträge zeigen auf
die eingecheckten Offline-Builds unter `public/projects/<id>/`, während die Web-Einträge weiterhin
`https://ki-node.github.io/portfolio/` und `https://ki-node.github.io/poster/` verwenden. Blackbox
verweist unverändert auf das lokale Mock-Projekt.

## Versionsfixierung und Lieferkette

`projects.lock.json` beschreibt eingebettete Projekte mit Repository, vollständigem Commit-SHA,
erlaubtem Build-Befehl, Build-Ausgabe und lokalem Zielpfad. Die Builds stammen exakt aus:

- `ki-node/portfolio@07c6b7eb09bd3d0577d49df657fed2d58097f018`
- `ki-node/poster@7950f07528334ee674c1e8fe4aa2133ae2338819`

`npm run sync:projects` checkt diesen Commit in einem Betriebssystem-Temp-Verzeichnis aus, führt
im isolierten Checkout `npm ci` und `npm run build:embedded` aus und ersetzt das Hub-Artefakt erst
nach erfolgreicher Offline-Prüfung. Lock-Werte werden validiert und nicht zu frei ausführbaren
Shell-Befehlen zusammengesetzt. Das Skript entfernt alte Zieldateien sowie temporäre Quellen und
schreibt eine deterministische `ki-node-project.json` als Provenienz in den Build.

Die kompilierten Dateien sind ausnahmsweise eingecheckt, weil sie ein versionsfixierter Bestandteil
des nativen App-Bundles sind. Vite kopiert sie unverändert nach `dist/projects/<id>/`, danach
übernimmt Capacitor sie in `ios/App/App/public/projects/<id>/`. Der App-Start hängt weder vom
GitHub-Netzwerk noch vom aktuellen Stand der Projekt-Repositories ab. Projekte können gemeinsam
oder gezielt per ID synchronisiert werden. Updates erfolgen nur über eine bewusste Änderung des
vollständigen SHA plus erneute Synchronisation; CI baut alle Lock-Versionen nach und verlangt einen
diff-freien Arbeitsbaum.

## Isolation und native Fähigkeiten

Projekte laufen in genau einem bildschirmfüllenden iframe. Das isoliert ihr HTML, CSS und
JavaScript von der Hub-Oberfläche. Der Hub greift nicht auf `contentDocument` oder andere interne
iframe-Dokumentstrukturen zu. Externe Navigation kann wegen der iframe- und Sandbox-Grenze nicht
unkontrolliert die Produkthülle ersetzen.

Kommunikation erfolgt ausschließlich über eine versionierte Nachrichtenbrücke. Das Portfolio
sendet vollständige `mailto:`- oder externe `https:`-URLs zusammen mit Projektkennung,
Protokollversion und Nachrichtentyp. Der Hub akzeptiert nur Nachrichten des aktuell aktiven
Portfolio-iframe, validiert das Schema und übergibt erlaubte Links im nativen Kontext an den
offiziellen Capacitor-App-Launcher. Fremde Fenster, Projekte, Versionen, Nachrichtentypen und
Schemes werden verworfen; beim Entfernen des iframe wird auch der Listener entfernt. Die Sandbox
erhält keine allgemeine Top-Navigation. Native Haptik für die Hub-Oberfläche bleibt zentral.

Poster besitzt eine getrennte Export-Bridge auf Kanal `orbit-project-bridge`, Version 1. Ein Export
enthält Projektkennung, Request-ID, bereinigbaren Dateinamen, MIME-Typ `image/png`, Bytezahl und
einen strukturiert geklonten `ArrayBuffer`. Der Hub akzeptiert nur das aktuell aktive Poster-iframe, prüft
PNG-Signatur und die dokumentierte Obergrenze von 48 MiB und verhindert Request-Replays. Er wandelt
die Binärdaten erst an der nativen Filesystem-Grenze in Base64 um, schreibt sie unter einem
hostgenerierten Cache-Pfad, öffnet das offizielle Share-Sheet und löscht die temporäre Datei in
jedem Abschlussfall.

`allow-downloads` bleibt nur im Web-Hub für den öffentlichen Browser-Download aktiv; im nativen
iframe wird nie zur Blob-Datei navigiert. Die Permissions Policy `clipboard-write` bleibt
projektspezifisch bei Poster. Clipboard ist absichtlich nicht Teil der Export-Bridge und verwendet
weiterhin seinen kontrollierten Browser-Fallback. Portfolio und Blackbox erhalten keine dieser
zusätzlichen Rechte.

## Launchscreen und WKWebView-Kaltstart

Der erste physische Gerätetest zeigte bei einem kalten WKWebView-Prozess ungefähr zehn Sekunden
schwarze Fläche. Ein markenkonformer nativer Launchscreen und eine identische statische Web-Schicht
decken diesen Zeitraum ab. Der Hub blendet den offiziellen Capacitor-Splash erst aus, nachdem der
Controller initialisiert wurde und zwei Animation Frames möglich waren. `launchAutoHide` bleibt mit
einer 15-Sekunden-Obergrenze aktiv; damit blockiert ein früher JavaScriptfehler den nativen Splash
nicht unbegrenzt. Diese Maßnahme verbessert die visuelle Kontinuität, behauptet aber keine
Beschleunigung des zugrunde liegenden WKWebView-Kaltstarts.

Der fünfte physische Test bestätigte Layout, Touch-Reticle, Menü-Scroll-Lock, Link-Bridge,
Offline-Betrieb und Kaltstartdarstellung erfolgreich. Der Lock-SHA verweist auf den endgültigen
Squash-Merge-Commit des Portfolio-Folge-PRs. Die Poster-Integration benötigt nach den automatischen
Prüfungen einen eigenen physischen Test im Orbit-iframe auf dem iPhone.

## Warum die native App keine Projekte live von GitHub Pages lädt

Lokale Embedded-Builds machen den nativen Start reproduzierbar und offlinefähig. Sie vermeiden
Netzabhängigkeit, Cross-Origin-Grenzen und überraschende Projektänderungen ohne neues App-Bundle.
Der Web-Hub darf dagegen bewusst die aktuellen öffentlichen Projektversionen laden. Die getrennten
Katalogquellen halten diese Entscheidung an einer Stelle und verhindern Laufzeitprüfungen in den
UI-Komponenten.

Die Asset-Prüfung folgt aktiven HTML- und CSS-Referenzen einschließlich verschachtelter relativer
Pfade, lehnt Netzwerkressourcen, fehlende Dateien, Symlinks und absolute lokale Pfade ab und prüft
JavaScript auf direkte Netzwerk-API-Aufrufe. Öffentliche Canonical- und Social-Metadaten bleiben
zulässig, weil sie beim Laden keine Ressource abrufen.
