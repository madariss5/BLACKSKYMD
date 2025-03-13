# Heroku Deployment Guide for BLACKSKY-MD

Diese Anleitung erklärt, wie du deinen BLACKSKY-MD WhatsApp Bot auf Heroku bereitstellen kannst, mit besonderem Fokus auf die Session-Verwaltung für eine stabile Verbindung.

## Methode 1: Deploy mit dem Deploy-Button

1. Klicke auf den "Deploy to Heroku" Button:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/madariss5/BLACKSKY)

2. Fülle die erforderlichen Umgebungsvariablen aus:
   - `OWNER_NUMBER`: Deine WhatsApp-Nummer mit Ländercode (z.B. 491234567890)
   - `PREFIX`: Das Befehlspräfix (Standard: `.`)
   - Alle anderen Variablen sind optional und können später hinzugefügt werden

3. Klicke auf "Deploy App" und warte, bis die Bereitstellung abgeschlossen ist

4. Nach der Bereitstellung klicke auf "View" oder "Open App", um zur Bot-Web-Oberfläche zu gelangen

## Methode 2: Manuelle Bereitstellung

1. Klone das Repository:
   ```bash
   git clone https://github.com/madariss5/BLACKSKY.git
   cd BLACKSKY
   ```

2. Verwende die spezielle Heroku-package.json:
   ```bash
   # Wichtig: Ersetze die standard package.json mit der Heroku-Version
   mv heroku-package.json package.json
   ```

3. Logge dich in Heroku ein und erstelle eine neue App:
   ```bash
   heroku login
   heroku create dein-bot-name
   ```

4. Füge die erforderlichen Buildpacks hinzu:
   ```bash
   heroku buildpacks:add heroku/nodejs
   heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git
   heroku buildpacks:add https://github.com/clhuang/heroku-buildpack-webp-binaries.git
   ```

5. Konfiguriere die Umgebungsvariablen:
   ```bash
   heroku config:set OWNER_NUMBER=491234567890
   heroku config:set PREFIX=.
   # Weitere Variablen nach Bedarf hinzufügen
   ```

6. Pushe den Code zu Heroku:
   ```bash
   git push heroku main
   ```

7. Öffne die App im Browser:
   ```bash
   heroku open
   ```

## Session-Verwaltung bei Heroku

### Erster Start und QR-Code-Scan

Beim ersten Start des Bots auf Heroku:

1. Öffne die Web-Oberfläche deiner App (Tab "QR Code Method")
2. Scanne den QR-Code mit deinem WhatsApp-Telefon
3. Nach erfolgreicher Verbindung wird ein **Session String** angezeigt
4. **WICHTIG**: Kopiere diesen Session String und speichere ihn sicher!

### Persistente Session für zukünftige Neustarts

Um zu verhindern, dass du bei jedem Neustart oder Dyno-Wechsel erneut scannen musst:

1. Gehe zu den Heroku App-Einstellungen > "Config Vars"
2. Füge eine neue Konfigurationsvariable hinzu:
   - Key: `SESSION_STRING`
   - Value: *Dein kopierter Session String*
3. Klicke auf "Add" und starte deine App neu

### Alternative Methode über die Web-Oberfläche

Du kannst die Session auch über die Web-Oberfläche wiederherstellen:

1. Öffne die Bot-Web-Oberfläche
2. Wechsle zum Tab "Session String Method"
3. Füge deinen zuvor gespeicherten Session String ein
4. Klicke auf "Authenticate with Session String"

## Tipps für eine stabile Heroku-Bereitstellung

1. **Verwende einen permanent laufenden Dyno:**
   - Wechsle von Free zu Basic/Eco oder höheren Plänen
   - Dies verhindert, dass dein Bot inaktiv wird

2. **Sichere deinen Session String:**
   - Speichere ihn an einem sicheren Ort
   - Er ist dein Schlüssel, um ohne QR-Scan wieder zu verbinden

3. **Einrichtung von Monitoring:**
   - Verwende New Relic oder einen anderen Monitoring-Dienst
   - Konfiguriere Warnungen bei Ausfällen

4. **Automatisches Neustarten:**
   - Nutze einen Service wie UptimeRobot, um deine App zu pingen
   - Dies hält den Dyno aktiv und kann automatisch neustarten

## Fehlerbehebung

### Bot verbindet nicht nach Neustart

- Überprüfe, ob die `SESSION_STRING` korrekt in den Config Vars eingestellt ist
- Versuche, den Session String über die Web-Oberfläche einzugeben

### Verbindung bricht regelmäßig ab

- Prüfe das Aktivitätslimit deines Dyno-Plans
- Stelle sicher, dass deine App nicht durch Inaktivität schläft

### Session wird nicht erkannt

- Erzeuge einen neuen QR-Code und scanne ihn
- Speichere den neuen Session String in den Config Vars

### "Push rejected, failed to compile Node.js app"

- Stelle sicher, dass du die package.json-Datei mit heroku-package.json ersetzt hast
- Überprüfe, ob das Procfile korrekt ist und auf `heroku-deploy.js` verweist
- Führe folgende Befehle aus, um das Deployment zu korrigieren:
  ```bash
  mv heroku-package.json package.json
  git add package.json Procfile
  git commit -m "Fix Heroku deployment issues"
  git push heroku main
  ```

### Probleme mit Heroku Stack-Kompatibilität

Wenn du weiterhin Probleme mit dem Deployment hast, versuche einen anderen Heroku-Stack:

```bash
heroku stack:set heroku-20 -a deine-app-name
git commit --allow-empty -m "Trigger rebuild"
git push heroku main
```

Alternativ kannst du auch den neuesten Stack ausprobieren:

```bash
heroku stack:set heroku-22 -a deine-app-name
git commit --allow-empty -m "Trigger rebuild"
git push heroku main
```