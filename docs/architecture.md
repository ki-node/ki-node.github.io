# Architekturentscheidung: gemeinsamer Web- und App-Hub

## Entscheidung

`ki-node` ist die gemeinsame Produkthülle und der Einstiegspunkt für den Web-Hub unter
`https://ki-node.github.io/` und die native Capacitor-iPhone-App. Beide Varianten werden aus
derselben Vite-/TypeScript-Quellbasis gebaut und verwenden dieselbe Oberfläche, denselben
typisierten Projektkatalog und denselben iframe-Lifecycle.

Der Katalog enthält je Projekt getrennte Quellen. Eine zentrale Laufzeitabstraktion erkennt Web
oder Capacitor und löst ausschließlich dort die passende URL auf:

- Die native App lädt lokale Embedded-Builds aus dem App-Bundle.
- Der Web-Hub lädt die öffentlichen GitHub-Pages-Versionen.

Portfolio ist als erstes echtes Projekt integriert. Der native Katalogeintrag zeigt auf den
eingecheckten Offline-Build unter `public/projects/portfolio/`, während der Web-Eintrag weiterhin
`https://ki-node.github.io/portfolio/` verwendet. Poster und Blackbox verweisen unverändert auf
das lokale Mock-Projekt.

## Versionsfixierung und Lieferkette

`projects.lock.json` beschreibt eingebettete Projekte mit Repository, vollständigem Commit-SHA,
erlaubtem Build-Befehl, Build-Ausgabe und lokalem Zielpfad. Der Portfolio-Build stammt exakt aus
`ki-node/portfolio@62259d04a7293eff3fbb349bc16fc987de117fea`.

`npm run sync:projects` checkt diesen Commit in einem Betriebssystem-Temp-Verzeichnis aus, führt
im isolierten Checkout `npm ci` und `npm run build:embedded` aus und ersetzt das Hub-Artefakt erst
nach erfolgreicher Offline-Prüfung. Lock-Werte werden validiert und nicht zu frei ausführbaren
Shell-Befehlen zusammengesetzt. Das Skript entfernt alte Zieldateien sowie temporäre Quellen und
schreibt eine deterministische `ki-node-project.json` als Provenienz in den Build.

Die kompilierten Dateien sind ausnahmsweise eingecheckt, weil sie ein versionsfixierter Bestandteil
des nativen App-Bundles sind. Vite kopiert sie unverändert nach `dist/projects/portfolio/`, danach
übernimmt Capacitor sie in `ios/App/App/public/projects/portfolio/`. Der App-Start hängt weder vom
GitHub-Netzwerk noch vom aktuellen Stand des Portfolio-Repositories ab. Updates erfolgen nur über
eine bewusste Änderung des vollständigen SHA plus erneute Synchronisation; CI baut die Lock-Version
nach und verlangt einen diff-freien Arbeitsbaum.

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
erhält keine allgemeine Top-Navigation. Native Haptik für die Hub-Oberfläche bleibt zentral;
Clipboard, Share und Dateien sind weiterhin nicht implementiert.

## Launchscreen und WKWebView-Kaltstart

Der erste physische Gerätetest zeigte bei einem kalten WKWebView-Prozess ungefähr zehn Sekunden
schwarze Fläche. Ein markenkonformer nativer Launchscreen und eine identische statische Web-Schicht
decken diesen Zeitraum ab. Der Hub blendet den offiziellen Capacitor-Splash erst aus, nachdem der
Controller initialisiert wurde und zwei Animation Frames möglich waren. `launchAutoHide` bleibt mit
einer 15-Sekunden-Obergrenze aktiv; damit blockiert ein früher JavaScriptfehler den nativen Splash
nicht unbegrenzt. Diese Maßnahme verbessert die visuelle Kontinuität, behauptet aber keine
Beschleunigung des zugrunde liegenden WKWebView-Kaltstarts.

Der erste physische Test gilt weiterhin als fehlgeschlagen. Hub-PR #4 bleibt Draft, bis Layout,
Touch-Reticle, Link-Bridge und Kaltstartdarstellung erneut auf dem physischen iPhone erfolgreich
geprüft wurden. Nach dem Merge des Portfolio-Folge-PRs muss der Lock-SHA außerdem auf dessen
endgültigen Squash-Merge-Commit aktualisiert werden.

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
