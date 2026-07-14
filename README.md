# ki-node

Technisches Grundgerüst für den nativen ki-node Hub auf dem iPhone. Die
Web-Oberfläche basiert auf Vite, TypeScript und Vanilla DOM. Capacitor bindet
sie als lokale iOS-App ein; es wird keine externe Server-URL verwendet.

## Voraussetzungen

- Node.js 22 oder neuer
- npm
- macOS mit Xcode 26.6 für den nativen Build

## Lokale Entwicklung

> [!IMPORTANT]
> Nach einem frischen Clone muss zwingend zuerst `npm ci` ausgeführt werden,
> bevor das Xcode-Projekt geöffnet oder gebaut wird. Das lokale Swift-Paket in
> `ios/App/CapApp-SPM/Package.swift` verweist auf
> `node_modules/@capacitor/haptics`. Ohne installierte npm-Abhängigkeiten kann
> Xcode dieses Paket nicht auflösen.

```bash
npm ci
npm run check
npm run build
npx cap sync ios
npx cap open ios
```

`npm run dev` startet den Vite-Entwicklungsserver für die Browser-Ansicht.
Die Haptik-Schaltfläche bleibt dort ohne native Wirkung und erzeugt keinen
Fehler.

## iOS-Projekt

Die iOS-Plattform nutzt Swift Package Manager. Das Xcode-Projekt liegt unter:

```text
ios/App/App.xcodeproj
```

Capacitor verwaltet die Abhängigkeiten in `ios/App/CapApp-SPM`. Dieser Ordner
sollte nicht manuell bearbeitet werden.

Apple Watch und Apple TV sind noch nicht Teil dieses Grundgerüsts. Spätere
native Begleit-Targets können im bestehenden Xcode-Projekt ergänzt werden.
