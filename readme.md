# TheraFinder

TheraFinder ist eine statische SharePoint-App, mit der Ärzte und Therapeuten passende ambulante Kinder-Physios finden können. Die Suche funktioniert über Ort/PLZ oder Spezialisierung und zeigt Ergebnisse als Liste mit allen CSV-Spalten (ohne `lat`/`lon`).

## CSV-Quelle

* Standard-Link in `app.js` ersetzen: `<<<HIER DEIN LINK>>>`.
* Das CSV benötigt diese Spalten:
  * Therapiestelle
  * Kanton
  * Ort
  * PLZ
  * Tel.
  * E-Mail
  * Homepage
  * Spezialisierung
  * lat
  * lon

## Admin-Ansicht

Admin-Elemente (CSV-Link/FIle-Upload) sind standardmäßig verborgen. Mit `?admin=1` werden sie sichtbar und erlauben das Laden eines neuen CSV-Links oder einer Datei.

## Nutzung

1. `index.html` in SharePoint einbinden.
2. CSV-Link hinterlegen.
3. Ort/PLZ oder Spezialisierung eingeben.

## Distanzberechnung

Bei fehlender exakter Ort/PLZ-Übereinstimmung wird der eingegebene Ort/PLZ über Nominatim (OpenStreetMap) geocodiert. Anschließend werden alle Therapieorte im Umkreis von 20 km angezeigt (auf Basis der `lat`/`lon`-Spalten).

## Google Maps

Pro Treffer gibt es einen Button, der eine Route von der eingegebenen PLZ/Ort zum Therapie-Standort öffnet.
.
