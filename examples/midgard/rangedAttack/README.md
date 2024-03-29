# MMM-Angriffsskript (Fernkampf) für Midgard (5. Ausgabe)

Aktuelle Version: **1.15.0 vom 2022-02-06,** erfordert MMM 1.26.0+.

Das MMM-Fernkampfskript wickelt einen Fernkampfangriff ab. Es erwartet als Parameter (per [Konfigskript](#konfigskript)) die Angabe der Waffenbezeichnung entsprechend des Kampfblattes im Charakterbogen. Für Standardwaffen aus dem Kodex werden die weiteren Angaben automatisch ermittelt. Das funktioniert, soweit im Charakterbogen das Munitionsattribut standardgemäß gesetzt wurde ("`Pfeile`" für die Waffe "Bogen" usw.). Für besondere Waffen können zusätzliche Eigenschaften im Konfigskript übergeben werden, wie auch ein 3D-Würfelwurf und Text für die Geschichtenerzähler-Ausgabe.

Das Skript fragt übliche Gründe für Boni oder Mali ab und berücksichtigt vieles automatisch, z.B. Entfernungsmodifikatoren und die eigene Erschöpfung und die des Gegners (-4 bzw. +4 bei AP:0). Alle angewandten Boni und Mali werden in einer Tabelle für Spieler und Spielleiter dokumentiert und intern für das Abwehrskript gespeichert. Gewonnene Praxispunkte werden ggf. automatisch im Charakterbogen gespeichert.

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

### Unterschiedliche Waffen, Waffenfähigkeiten und Munitionstypen

Mindestens muss ein Konfigskript eine der vom Charakter geführten Waffen deklarieren, d.h. die Variable `cWeaponLabel` so setzen, dass der Wert exakt der Bezeichnung im Kampfblatt entspricht, z.B. so: `!mmm set cWeaponLabel = "Langbogen"`. Statt lauter Konfig-Skripte von Hand zu pflegen, übernimmt diese Aufgabe für Standardwaffen das Skript `weaponSelect`, das Menüs der Waffen des ausgewählten Tokens erzeugt.

Wer allerdings Unikate (z.B. magische Waffen) nutzt, muss pro Spezialwaffe ein Konfigskript anlegen und zum Angriff jeweils das gewünschte aufrufen. **Damit das automatisch von `weaponSelect` erzeugte Menü diese eigenen Konfigskripte im Menü verlinkt, müssen sie noch verknüpft werden:** das erledigt am einfachsten ein Aufruf von `%{MacroSheet|charCombatValidator}` (Token anklicken).

**Notwendig** sind für Spezialwaffen folgende Parameter:

- `cWeaponType`: Ein gültiger Midgard-5-Fernkampf-Waffentyp (z.B. Schleuder, Bogen, Kurzbogen, Langbogen, Kompositbogen, leichte Armbrust, schwere Armbrust, Wurfmesser).
- `cRangeUpperBoundClose`, `cRangeUpperBoundMid`, `cRangeUpperBoundFar`: Obergrenzen des jeweiligen Entfernungsbereichs in Metern.
- `cAmmoLabel`: Bezeichnung der Munition, die exakt dem Namen des Attributs im Charakterbogen entsprechen muss, in der die aktuelle und die Maximalanzahl der Munition steht.

*Optional* können zusätzlich folgende Parameter gesetzt werden:

- `cWeaponName`: Name (wird nur für die stimmungsvolle Ausgabe genutzt, keine technische Funktion).
- `cAmmoWarnThreshold` (Dezimalzahl wie `0.25`): ab diesem Anteil des Munitionsmaximums wird vor Munitionsmangel gewarnt.
- `cAmmoMagic = [true|false]` (Default: ''false'', ''true'' wenn magische Munition benutzt werden soll)
- `cAmmoMagicLabel` (wie `cAmmoLabel`, Bezeichnung besonderer magischer Munition und des Attributs im Charakterbogen)
- `cAmmoMagicSkillBonus` (Bonus/Malus für den Angriffswurf, numerisch)
- `cAmmoMagicDamage` (Roll20-Würfelformel für Zusatzschaden, z.B. "1d6+1" oder einfach "+1", in Anführungszeichen)

### Unterschiedliche Charaktere/NPCs

Das Skript operiert immer für den aktuell angeklickten Token; wenn kein Token angeklickt ist, für den Akteur, der im Chat-Dropdown steht. Wer davon unabhängig sein will, definiert ein Konfigskript und setzt dort `!mmm set cOwnID = "@{character_id}"`. 

### Geschichtenerzählerausgabe

`cVerbose = [true|false]` schaltet die Geschichtenerzählerausgabe an/ab. Nur wer `cVerbose = true` setzt, braucht sich über die `!mmm translate [...]: ...`-Zeilen Gedanken zu machen.

`!mmm translate [Attack...]:` Diese Zeilen definieren die unterschiedlichen Teile und Fälle der Angriffserzählung, die im Chat ausgegeben wird. Alle `translate`-Zeilen sind optional, denn es gibt für jedes Element auch eine halbwegs sinnvolle Default-Ausgabe. Welche Variablen in jeder Zeile zur Verfügung stehen, erfährt man am besten mit folgendem Kommando im Roll20-Chat:
```javascript
!mmm customize export to [Name des Makros, das angelegt werden soll, z.B. rangedAttackConfigSample]
%{MacroSheet|rangedAttack}
```

Weitere `translate`-Zeilen gibt es für "In-Game-Fehler", also technisch korrekte Angriffe auf Ziele, die z.B. zu weit entfernt sind.

Spezialfall für magische Munition: die Zeilen `AttackOpeningMagicDamage` und `AttackSuccessClosingMagic` werden beim Einsatz magischer Munition **statt** der normalen Start- und Schlusszeilen ausgegeben. Hier könnt ihr was Tolles erzählen oder mit einem GIF die besonderen Effekte der magischen Munition rüberbringen. 

Die letzte Zeile (z.B. `%{MacroSheet|rangedAttack}`) ruft das eigentliche Skript auf, das muss dann unter dem hier genannten Namen angelegt sein.


## Datenabfragen

Das Skript fragt bei jedem Start neben dem Ziel des Angriffs (auf gegnerisches Token klicken) eine Reihe von Daten zum Angriff ab, ob relevant oder nicht:
- *Standard-Abwehrmodifikatoren* werden in einem Baum abgefragt, der z.B. die Kombination von *spontan* (-4) oder *sorgfältig gezielt* (+4) mit *wehrloses Ziel* (+4) oder unterschiedlichen Größen des Ziels (-4..+4) ermöglicht.
- *Weitere spezielle Abwehrmodifikatoren:* Zahlenwert, nach Bedarf -- hier kann alles ergänzt werden, was der automatische Baum nicht bietet oder was der GM ändern möchte.


## Todo-Liste

- Lassen sich die Effekte von Angriffen ins Handgemenge besser automatisieren? Erstmal +4 auf Ziel im Handgemenge, aber es muss dann automatisch bestimmt werden, welche der Parteien im Handgemenge zufällig getroffen wurde. Lohnt das?
- Gezielte Angriffe auf Körperteile / Scharfschießen
- Kritische Fehler-/Erfolgsereignisse automatisch auswürfeln, ausgeben und soweit wie möglich umsetzen.


## Changelog

1.15.0 2022-02-06

- Waffenauswahl und die Eigenschaften von Standardwaffen integriert
- Fehlender Waffentyp von Standard-Angriffswaffen wird erraten
- Abwehrbuttons neu mit automatischer Auswahl verwendbarer Waffen & Erkennung ob NPC oder Spieler-Charakter
- Bugfix: Modifikatorenprotokoll wird auch für NPCs an den korrekten Spieler geschickt
- Bugfix: kritische Erfolge/Patzer beim Scharfschießen werden farbig umrandet
- Per Default werden nun die Attribute bar2/bar3 für AP/LP verwendet, damit ist der Default robuster

1.14.0 2022-01-27

- Praxispunkte werden nun automatisch gespeichert und geloggt

1.13.0 2022-01-13

- Buttons zum Aufruf des Abwehrskripts mit Defaulteinstellungen
- Interne Umbauten

1.12.0 2022-01-01

- Logik für magische Runenklinge Wasserläufer integriert
- Automatischer Angriffswurf intern (für den Spielleitermodus)

1.11.0 2021-12-18

- Stiller Modus für Spielleiter (keine sichtbaren Ausgaben von Würfen an die Spieler)
- Bugfix: keine negativen Schadenswürfe

1.10.0 2021-12-13 (MMM 1.20.0+)

- Automatische Datenablage in den `m3mgd_*`-Attributen eines Dummy-Charakterblattes, das als Datenverschiebebahnhof genutzt wird
- (Workaround) Wird das Skript von einem Benutzer aufgerufen, dem kein Charakter zugeordnet ist, gibt es den Namen des handelnden Tokens eingangs aus.
- Geisterwesen (unendliche LP) und Untote (unendliche AP) werden nun korrekt behandelt
- Finns neues Zauberschwert "Wirbelwind"
- Bugfix: Datenübersichten für NPCs werden nur noch dem Spielleiter geflüstert
- Bugfix: Zugriff auf Bezugstoken, nicht Bezugscharaktere (für NPCs wichtig)
- intern: obj.prop-Syntax, erfordert MMM 1.20.0+

1.9.0 (requires MMM 1.16.0 or higher)

- Bugfix: veraltete Version des Dropdown-Menü-Codes aktualisiert
- neu: Erkennung verheerender Treffer

1.8.9 & 1.8.10 (requires MMM 1.16.0 or higher)

- Hotfix & rollback (Roll20 hatte die Behandlung von Sonderzeichen in Dropdown-Menüs verändert)

1.8.8 2021-06-30 (requires MMM 1.16.0 or higher)

- Bugfix: Normale Angriffe war im Drop-Down falsch kodiert

1.8.7 2021-06-11 (requires MMM 1.16.0 or higher)

- Scharfschießen-Funktion ergänzt
- Ausgabe: einige nicht genutzte Variablen aus der ausführlichen Ausgabe entfernt

1.8.5 2021-05-19 (requires MMM 1.16.0 or higher)

- Ausgabe-Bugfix für #10, Hinweis auf PP entfernt, wenn Gegner erschöpft ist
- Ausgabe-Bugfix, Hinweis für den Angriff von hinten korrigiert
- Ausgabe: Diverse kleine Verbesserungen
- Versionscheck über Konfig-Variable `cCheckVersion` ergänzt

1.8.3 2021-04-27 (requires MMM 1.16.0 or higher)

- Modifikatoren-Log als Tooltip ergänzt
- Anpassbarkeit der Tabellenausgabe entfernt
- Unicode-Emojis für Erschöpfung ergänzt

1.8.0 2021-04-25 (requires MMM 1.16.0+)

- 3D-Würfel für den Erfolgswurf
- Intern: MMM-Versionscheck beim Start

1.7.0 2021-03-27

- Abstände werden nun zwischen Tokenrändern berechnet (statt zwischen Mittelpunkten; erfordert MMM 1.16.0 oder höher)
-  Optionale magische Munition mit Angriffsbonus und Zusatzschaden kann nun genutzt werden
-  Bugfix: negativer Schaden wird abgefangen

1.6beta 2021-03-14

-  MMM-Lokalisierung eingebaut
-  Senderunabhängigen Zugriff auf den angreifenden Charakter portiert
-  Bei kritischen Erfolgen gibt es den bestellten "BLING BLING Whisper" an GM und User 
-  Notation der Tooltips, Ausgabe der Schadensbestandteile ordentlicher (wie im Nahkampfskript)
-  Wenn die Default- oder konfigurierte Waffe nicht im Charakterbogen ist => Abbruch.
-  Zugriffsverweigerung auf Ziele wird nun korrekt abgefangen (erfordert MMM 1.15.0)
-  Intern: Präfixe für konfigurierbare Variablen eingeführt ("cFooBar")
-  Bugfix: Prüfung des Zugriffs auf den Charakterbogen verbessert
