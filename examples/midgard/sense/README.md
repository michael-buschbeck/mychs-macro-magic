# MMM-Wahrnehmungsskript für Midgard (5. Ausgabe)

Aktuelle Version: **1.0.0-beta vom 2021-05-03,** erfordert MMM 1.14.0+.

Aufruf: 
- Hauptspiel ("Midgard"): ``#Die_Sinne`` 
- Testspiel ("TEST"): ``#senseMenu``

Das MMM-basierte Midgard-Wahrnehmungsskript wickelt Wahrnehmungswürfe ab. Mittels Konfigskripten lassen sich unterschiedliche Sinne, unterschiedliche Auswahlmöglichkeiten (z.B. nur ein Spielercharakter, eine Gruppe von bis zu sechs Charakteren, oder alle aus einer Liste von bis zu sechs voreingestellten Charakteren) und situationsabhängige oder standardisierte Nachrichten für Erfolg, Misserfolg und kritischen Misserfolg nutzen. 

### Inhalt

- [Features & Anwendung](#features--anwendung)
- [What's new?](#changelog)


## Features & Anwendung

Das Skript kennt zwei Arbeitsmodi. Pro Aufruf muss einer davon im Konfigskript in der Variable `cSenseMode` gesetzt sein:

1. `cSenseMode = "single"` führt den Wahrnehmungswurf für nur einen Charakter durch, dessen ID in `cChar1ID` erwartet wird.
2. `cSenseMode = "group"` führt den Wahrnehmungswurf für ein bis sechs Charaktere durch, deren IDs in `cChar1ID..cChar6ID` erwartet werden.

`cSense = "Sehen"` definiert den genutzten Sinn, der exakt einem Wert in der Spalte `Fertigkeit2` der Tabelle `sinne` im Charakterbogen entsprechen muss ("Sehen", "Hören", "Riechen/Schmecken" ist in Midgard nur *ein Sinn*, "Nachtsicht", "Sechster Sinn").

`cSenseModifier = 0` ist der Modifikator für den Wahrnehmungswurf. Er kann in Konfigskripten für die einzelnen Sinne und Modi hartkodiert, per Dropdown auswählbar gemacht oder per Dialogfeld manuell angefordert werden.

`cSuccessMessage`, `cRegularFailureMessage` und `cCriticalFailureMessage` definieren die Nachrichten (als Zeichenketten), die Spieler im Erfolgs-, Misserfolgs- und Patzerfall vom GM geflüstert bekommen. Ausnahme ist der Sechste Sinn, hier werden nur im Erfolgsfall Nachrichten geflüstert. Diese Nachrichten können in Konfigskripten für die einzelnen Sinne und Modi hartkodiert, per Dropdown auswählbar gemacht oder per Dialogfeld manuell definiert werden.

`char1ID` usw. erwarten Roll20-Character-IDs als Zeichenketten.


## Changelog

1.0.0-beta 2021-05-03
- Erste vollständige Testversion