# MMM-Angriffsskript (Nahkampf) für Midgard (5. Ausgabe)

Aktuelle Version: **1.15.0 vom 2022-01-29,** erfordert MMM 1.26.0+.

Das MMM-Nahkampfskript wickelt einen Nahkampfangriff ab. Es erwartet als Parameter (per [Konfigskript](#konfigskript)) die Angabe der Waffenbezeichnung entsprechend des Kampfblattes im Charakterbogen. Für Standardwaffen aus dem Kodex wird der Waffentyp automatisch ermittelt. Für besondere Waffen können zusätzliche Eigenschaften im Konfigskript übergeben werden, wie auch ein 3D-Würfelwurf und Text für die Geschichtenerzähler-Ausgabe.

Das Skript fragt übliche Gründe für Boni oder Mali ab und berücksichtigt vieles automatisch, z.B. die eigene Erschöpfung und die des Gegners (-4 bzw. +4 bei AP:0) sowie die Effekte der relativen Position zum Gegner (Angriff von hinten, oder kein Angriff möglich). Alle angewandten Boni und Mali werden in einer Tabelle für Spieler und Spielleiter dokumentiert und intern für das Abwehrskript gespeichert. Gewonnene Praxispunkte werden ggf. automatisch im Charakterbogen gespeichert.


### Inhalt

- [Konfigskript](#konfigskript)
- [Datenabfragen](#datenabfragen)
- [Todo-Liste](#todo-liste)
- [What's new?](#changelog)


## Konfigskript

Ein MMM-Konfigskript hat grundsätzlich die Form

```javascript
!mmm customize
!mmm   set myParameter = "value"
!mmm end customize
call_to_script
```

### Unterschiedliche Waffen und Waffenfähigkeiten

Mindestens muss ein Konfigskript eine der vom Charakter geführten Waffen deklarieren, d.h. die Variable `cWeaponLabel` so setzen, dass der Wert exakt der Bezeichnung im Kampfblatt entspricht, z.B. so: `!mmm set cWeaponLabel = "Langschwert"`. Statt lauter Konfig-Skripte von Hand zu pflegen, übernimmt diese Aufgabe für Standardwaffen das Skript `weaponSelect`, das Menüs der Waffen des ausgewählten Tokens erzeugt.

Wer allerdings Unikate (z.B. magische Waffen) nutzt, muss pro Spezialwaffe ein Konfigskript anlegen und zum Angriff jeweils das gewünschte aufrufen. **Damit das automatisch von `weaponSelect` erzeugte Menü diese eigenen Konfigskripte im Menü verlinkt, müssen sie noch verknüpft werden:** das erledigt am einfachsten ein Aufruf von `%{MacroSheet|charCombatValidator}` (Token anklicken).

**Notwendig** ist für Spezialwaffen nur der Parameter

- `cWeaponType`: Ein gültiger Midgard-5-Nahkampf-Waffentyp (z.B. Stichwaffe, Einhandschwert, Zweihandschwert).

*Optional* können zusätzlich folgende Parameter gesetzt werden:

- `cWeaponName`: Name (wird nur für die stimmungsvolle Ausgabe genutzt, keine technische Funktion).

Während **magische Waffen** seit v1.6 automatisch anhand des Angriffs- oder Schadensbonus im Charakterbogen erkannt werden, unterstützt das Skript *optional* als Spezialfall magischer Waffen auch **aktivierbare magische Waffen**, die im aktivierten Zustand zusätzlichen und ggf. besonderen Schaden anrichten: 
```javascript
!mmm customize
(...)
!mmm set cMagicExtraDamageMarker = "[MMM-Token-Marker*]"
!mmm set cMagicExtraDamage = "[Würfelwurf, z.B. 1d+1]"
!mmm set cMagicExtraDamageLabel = "[Ausgabelabel für die Art des magischen Schadens, bei magischem Feuer z.B. ✨🔥]" 
(...)
```
*) "MMM-Token-Marker" bezieht sich auf einen gültigen Namen für einen Roll20-Token-Marker in der [MMM-Notation](https://github.com/michael-buschbeck/mychs-macro-magic#attributes), wie z.B. ''status_all_for_one''.

### Unterschiedliche Charaktere/NPCs

Das Skript operiert immer für den aktuell angeklickten Token; wenn kein Token angeklickt ist, für den Akteur, der im Chat-Dropdown steht. Wer davon unabhängig sein will, definiert ein Konfigskript und setzt dort `!mmm set cOwnID = "@{character_id}"`. 

### Geschichtenerzählerausgabe

`cVerbose = [true|false]` schaltet die Geschichtenerzählerausgabe an/ab. Nur wer `cVerbose = true` setzt, braucht sich über die `!mmm translate [...]: ...`-Zeilen Gedanken zu machen.

`!mmm translate [Attack...]:` Diese Zeilen definieren die unterschiedlichen Teile und Fälle der Angriffserzählung, die im Chat ausgegeben wird. Alle `translate`-Zeilen sind optional, denn es gibt für jedes Element auch eine halbwegs sinnvolle Default-Ausgabe. Welche Variablen in jeder Zeile zur Verfügung stehen, erfährt man am besten mit folgendem Kommando im Roll20-Chat:
```javascript
!mmm customize export to [Name des Makros, das angelegt werden soll, z.B. meleeConfigSample]
%{MacroSheet|meleeAttack} [oder wo das Skript eben installiert ist im Spiel]
```

Weitere `translate`-Zeilen gibt es für "In-Game-Fehler", also technisch korrekte Angriffe auf Ziele, die z.B. zu weit entfernt sind.

Spezialfall für magische Waffen mit Zusatzschaden: die Zeile `AttackOpeningMagicDamage` wird beim Einsatz aktivierter magischer Waffen **statt** der normalen Startzeile ausgegeben. 

Die letzte Zeile `%{MacroSheet|meleeAttack}` ruft das eigentliche Skript auf, das muss dann unter dem hier genannten Namen angelegt sein.

## Datenabfragen

Das Skript fragt bei jedem Start neben dem Ziel des Angriffs (auf gegnerisches Token klicken) eine Reihe von Daten zum Angriff ab, ob relevant oder nicht:
- *Standard-Abwehrmodifikatoren* werden in einem Baum abgefragt, der z.B. die Kombination von *spontan* (-4) oder *überstürzt* (-6) mit *wehrloses Ziel* (+4) oder *Angriff von oben* (+2) ermöglicht.
- *Weitere spezielle Abwehrmodifikatoren:* Zahlenwert, nach Bedarf -- hier kann alles ergänzt werden, was der automatische Baum nicht bietet oder was der GM ändern möchte.


## Todo-Liste

- An waffenlose Kampftechniken und Handgemenge anpassen. Zurückdrängen und ähnliche Manöver einbauen.
- Gezielte Angriffe auf Körperteile einbauen.
- Kritische Fehler-/Erfolgsereignisse automatisch auswürfeln, ausgeben und soweit wie möglich umsetzen.


## Changelog

1.15.0 2022-01-29

- Waffenauswahl und die Eigenschaften von Standardwaffen integriert
- Abwehrbuttons neu mit automatischer Auswahl verwendbarer Waffen & Erkennung ob NPC oder Spieler-Charakter

1.14.0 2022-01-27

- Praxispunkte werden nun automatisch gespeichert und geloggt

1.13.0 2022-01-13

- Buttons zum Aufruf des Abwehrskripts mit Defaulteinstellungen
- Interne Umbauten

1.12.0 2021-12-31

- Waffen-Default-Auswahl, wenn Charakter nur eine Nahkampfwaffe hat

1.11.0 2021-12-18

- Stiller Modus für Spielleiter (keine sichtbaren Ausgaben von Würfen an die Spieler)
- Bugfix: keine negativen Schadenswürfe

1.10.0 2021-12-13

- Automatische Datenablage in den `m3mgd_*`-Attributen eines Dummy-Charakterblattes, das als Datenverschiebebahnhof genutzt wird
- (Workaround) Wird das Skript von einem Benutzer aufgerufen, dem kein Charakter zugeordnet ist, gibt es den Namen des handelnden Tokens eingangs aus.
- Geisterwesen (unendliche LP) und Untote (unendliche AP) werden nun korrekt behandelt
- Finns neues Zauberschwert "Wirbelwind"
- Bugfix: Datenübersichten für NPCs werden nur noch dem Spielleiter geflüstert
- Bugfix: Zugriff auf Bezugstoken, nicht Bezugscharaktere (für NPCs wichtig)
- intern: obj.prop-Syntax, erfordert MMM 1.20.0+

1.9.0 2021-11-18 (requires MMM 1.18.0+)

- Neu: Erkennung "verheerender Angriffe" 

(...)

1.8.1 2021-05-19 (requires MMM 1.18.0+)

- Ausgabe: Bugfix #10, Hinweis auf PP entfernt wenn Gegner erschöpft

1.8.0 2021-05-13 (requires MMM 1.18.0+)

- Ausgabe: Boni/Mali als "info" (grau) statt "default" (gelb) markiert
- Ausgabe: Schadenstooltip für magischen Zusatzschaden repariert
- Ausgabe: Symbol für Erschöpfung grau statt gelb markiert
- Ausgabe: Eingeklammerter AP-Wert hinter "Ziel erschöpft" entfernt
- Ausgabe: Schaden von magischer Waffe knapper formuliert
- Intern: zur Schadensausgabe neue Funktion highlight(roll, default, tooltip) genutzt

1.7.3 2021-04-27 (requires MMM 1.16.0+)

- Modifikatoren-Log als Tooltip ergänzt
- Anpassbarkeit der Tabellenausgabe entfernt
- Unicode-Emojis für Erschöpfung ergänzt

1.7.0 2021-04-25 (requires MMM 1.16.0+)

- 3D-Würfel für den Erfolgswurf
- Intern: MMM-Versionscheck beim Start

1.6.0 2021-03-27 (requires MMM 1.16.0+)

- Sonderfunktion magischer Zusatzschaden aufgeräumt: ES FÄLLT WEG: cWeaponMagic, magische Waffen werden nun automatisch aus dem Charakterbogen erkannt. INKOMPATIBEL: cWeaponMagicMarker & cWeaponMagicDamage sowie die Chat-Zeile AttackOpeningMagicDamage fallen auch weg, neu dafür: cMagicExtraDamageMarker, cMagicExtraDamage, cMagicExtraDamageLabel sowie die Chat-Zeilen AttackOpeningExtraMagicDamage und AttackSuccessClosingExtraMagicDamage
- Dropdown-Modifikatoren werden nun einzeln dokumentiert, und weitere Kombinationen ergänzt
- Verbose=true: Schwere des Schadens wird nun verbal dargestellt, Nullschaden wie eine 1 beim Schadenswurf.

1.5.1 2021-03-25

-  Abstände werden nun zwischen Tokenrändern berechnet (statt zwischen Mittelpunkten; erfordert MMM 1.16.0 oder höher)
-  Erfolg/Fehlschlag des Angriffs ist nun auf den ersten Blick in der Tabelle ersichtlich (zweite Zeile)
-  Magischer Sonderschaden wird nur bei erfolgreichen Angriffen an GM und Spieler ausgegeben
-  Cleanup: Fehler "WeaponNotFound" wird nicht mehr als Spielausgabe sondern als Konfigurationsfehler behandelt

1.5.0 2021-03-14

-  Ausgabe und Code für Schadensbestandteile optimiert
-  Zugriffsverweigerung auf Ziele wird nun korrekt abgefangen (erfordert MMM 1.15.0+)
-  Fehler-Chatzeilen OutsideFieldOfVision, OutsideStrikeDistance: Zusätzliche Daten übergeben
-  Verbose-Chatzeilen geben weniger Daten aus, damit die Default-Ausgabe lesbarer ist
-  Optional: Funktionalität für aktivierungsabhängigen magischen Zusatzschaden ergänzt
-  Bugfix: Wenn die Waffe keinen Namen hat, wird ein sinnvolles Label ausgegeben
-  Bugfix: Negative Schadensergebnisse auf 0 normalisiert
-  Bugfix: Prüfung des Zugriffs auf den Charakterbogen verbessert

