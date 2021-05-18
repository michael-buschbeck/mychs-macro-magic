# MMM-Wahrnehmungsskript für Midgard (5. Ausgabe)

Aktuelle Version: **1.1.0 vom 2021-05-18,** erfordert MMM 1.19.1+.

Aufruf: 
- Hauptspiel ("Midgard"): ``#Die_Sinne`` 
- Testspiel ("TEST"): ``#senseMenu``

Das MMM-basierte Midgard-Wahrnehmungsskript wickelt Wahrnehmungswürfe ab. Mittels Konfigskripten lassen sich unterschiedliche Sinne, unterschiedliche Auswahlmöglichkeiten (z.B. nur ein Spielercharakter, eine Gruppe von bis zu sechs Charakteren, oder alle aus einer Liste von bis zu sechs voreingestellten Charakteren) und situationsabhängige oder standardisierte Nachrichten für Erfolg, Misserfolg und kritischen Misserfolg nutzen. 

### Inhalt

- [Features & Anwendung](#features--anwendung)
- [What's new?](#changelog)


## Features & Anwendung

`cSense = "Sehen"` definiert den genutzten Sinn, der exakt einem Wert in der Spalte `Fertigkeit2` der Tabelle `sinne` im Charakterbogen entsprechen muss ("Sehen", "Hören", "Riechen/Schmecken" ist in Midgard nur *ein Sinn*, "Nachtsicht", "Sechster Sinn").

`cSenseModifier = 0` ist der Modifikator für den Wahrnehmungswurf. Er kann in Konfigskripten für die einzelnen Sinne und Modi hartkodiert, per Dropdown auswählbar gemacht oder per Dialogfeld manuell angefordert werden.

`cSuccessMessage`, `cRegularFailureMessage` und `cCriticalFailureMessage` definieren die Nachrichten (als Zeichenketten), die Spieler im Erfolgs-, Misserfolgs- und Patzerfall vom GM geflüstert bekommen. Ausnahme ist der Sechste Sinn, hier werden nur im Erfolgsfall Nachrichten geflüstert. Diese Nachrichten können in Konfigskripten für die einzelnen Sinne und Modi hartkodiert, per Dropdown auswählbar gemacht oder per Dialogfeld manuell definiert werden.

`cTokenList` erwartet eine oder mehrere (als MMM-Liste) Roll20-Token-IDs als Zeichenketten. Mehrere werden einfach als kommagetrennte Liste gesetzt: `set cTokenList = "-Msdjfhjsdf...", "-Msdfjhe34"`.


## Changelog

1.1.0 2021-05-18 (erfordert MMM 1.19.1)
- Umfangreicher Umbau: Auswahl einer flexiblen Zahl von Tokens, keine limitierten Modi mehr
- Bugfix: Tooltip am Würfelergebnis
- Arbeitet jetzt mit Token IDs statt Character IDs, funktioniert damit auch für generische NPCs

1.0.0-beta 2021-05-03
- Erste vollständige Testversion