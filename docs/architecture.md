# Architekturentscheidung: gemeinsamer Web- und App-Hub

## Entscheidung

`ki-node` ist die gemeinsame Produkthülle und der Einstiegspunkt für den Web-Hub unter
`https://ki-node.github.io/` und die native Capacitor-iPhone-App. Beide Varianten werden aus
derselben Vite-/TypeScript-Quellbasis gebaut und verwenden dieselbe Oberfläche, denselben
typisierten Projektkatalog und denselben iframe-Lifecycle.

Der Katalog enthält je Projekt getrennte Quellen. Eine zentrale Laufzeitabstraktion erkennt Web
oder Capacitor und löst ausschließlich dort die passende URL auf:

- Die native App lädt später lokale Embedded-Builds aus dem App-Bundle.
- Der Web-Hub lädt später die öffentlichen GitHub-Pages-Versionen.

In diesem ersten Pull Request verweisen beide Quellen aller Katalogeinträge bewusst auf dasselbe
lokale Mock-Projekt. Echte Projekte werden noch nicht eingebunden.

## Isolation und native Fähigkeiten

Projekte laufen in genau einem bildschirmfüllenden iframe. Das isoliert ihr HTML, CSS und
JavaScript von der Hub-Oberfläche. Der Hub greift nicht auf `contentDocument` oder andere interne
iframe-Dokumentstrukturen zu. Externe Navigation kann wegen der iframe- und Sandbox-Grenze nicht
unkontrolliert die Produkthülle ersetzen.

Spätere Kommunikation erfolgt ausschließlich über eine versionierte Nachrichtenbrücke. Ein
Protokollname und eine erste Versionsnummer sind bereits als Vertrag reserviert; Nachrichten- und
Capability-Handler sind noch nicht implementiert. Native Haptik für die Hub-Oberfläche bleibt
zentral im Hub. Clipboard, Share, Dateien und externe Links sind nicht Teil dieses Schritts.

## Warum die native App keine Projekte live von GitHub Pages lädt

Lokale Embedded-Builds machen den nativen Start reproduzierbar und offlinefähig. Sie vermeiden
Netzabhängigkeit, Cross-Origin-Grenzen und überraschende Projektänderungen ohne neues App-Bundle.
Der Web-Hub darf dagegen bewusst die aktuellen öffentlichen Projektversionen laden. Die getrennten
Katalogquellen halten diese Entscheidung an einer Stelle und verhindern Laufzeitprüfungen in den
UI-Komponenten.
