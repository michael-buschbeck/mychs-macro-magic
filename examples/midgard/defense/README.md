# MMM-Abwehrskript für Midgard (5. Ausgabe)

Aktuelle Version: **1.14.0 vom 2022-01-27,** erfordert MMM 1.26.0+.

Das MMM-Abwehrskript wickelt die Abwehr eines Angriffs ab. Es erhält die Angriffsdaten automatisch; wenn sie fehlen, wird der Spieler zur Eingabe aufgefordert. Die üblichen Regeln werden automatisch angewendet. Optional lassen sich in einem kurzen [Konfigskript](#konfigskript) die Auswahl der Abwehrwaffe (Schild/Parierwaffe) und die Textausgaben anpassen. 

Die Folgen für Ausdauer und Gesundheit werden direkt umgesetzt und im Chat dokumentiert. Für generische NPCs werden automatisch die Token-Balken benutzt. Gewonnene Praxispunkte für Schilde oder Parierwaffen werden ggf. automatisch im Charakterbogen gespeichert.

### Inhalt

- [Konfigskript](#konfigskript)
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

### Unterschiedliche Abwehrwaffen

Wer nicht nur "Abwehr ohne Schild" kann und mehr als eine Abwehrfertigkeit nutzt, erhält von den Angriffsskripten automatisch ein Menü im Chat, das alle **für den Typ der Angriffswaffe anwendbaren (!)** Abwehroptionen zur Auswahl anbietet. Hier wird z.B. ein Parierdolch aussortiert, wenn der Angriff mit einer Fernkampfwaffe oder einer Streitaxt erfolgt. Standard-Abwehrwaffen werden automatisch erkannt und verarbeitet.

Besondere Abwehrwaffen können bei gleichem Namen andere Werte haben als üblich. Vollkommen neue Abwehrwaffen müssten im Verhältnis zu den Angriffswaffen, gegen die sie verwendbar sind, in den spielglobalen Variablen in `initGameGlobals` ergänzt werden, um als gültig erkannt zur werden.

Unterschiedliche Rüstungen werden so behandelt wie im Charakterblatt: es zählt die Rüstung, die gerade als "getragen" markiert ist.

### Unterschiedliche Charaktere/NPCs

Das Skript operiert immer für den aktuell angeklickten Token; wenn kein Token angeklickt ist, für den Akteur, der im Chat-Dropdown steht oder der zuletzt angegriffen wurde (wenn der ausführende Spieler auf dieses Token Zugriff hat). Wer davon unabhängig sein will, definiert ein Konfigskript und setzt dort `!mmm set cOwnID = "@{character_id}"`. 

### Geschichtenerzählerausgabe

`cVerbose = [true|false]` schaltet die Geschichtenerzählerausgabe an/ab. Nur wer `cVerbose = true` setzt, braucht sich über die `!mmm translate [...]: ...`-Zeilen Gedanken zu machen.

Die letzte Zeile ruft das eigentliche Skript auf, das muss dann unter dem hier genannten Namen angelegt sein.


## Datenabfragen

Das Skript bekommt die Eckdaten das Angriffs intern übergeben und fragt nur noch Abwehrmodifikatoren ab:
- *Standard-Abwehrmodifikatoren:*
  -  keine: *Normale Abwehr +/-0*
  - *Konzentrierte Abwehr +4*
  - *Ich greife überstürzt an -2*
  - *Ich bin überrascht -4*
- *Weitere spezielle Abwehrmodifikatoren:* Zahlenwert, nach Bedarf.


## Todo-Liste

- Es gibt noch zwei Sonderfälle für [Abwehrmodifikatoren](https://midgard.alienn.net/doku.php?id=abwehr_nahkampf_boni_und_malusse), die -- samt der dann notwendigen Verschachtelung unterschiedlicher Kombinationen -- nicht eingebaut sind (schwere Beinverletzung und vollständige Dunkelheit).


## Changelog

1.14.0 2022-01-29

- Waffenauswahl und die Eigenschaften von Standardwaffen integriert

1.13.0 2022-01-27

- Praxispunkte werden nun automatisch gespeichert und geloggt

(...)

1.7.1 2021-12-20

- Bugfix: Kritische Treffer werden wieder korrekt erkannt

1.7.0 2021-12-19

- Parierwaffen und Schilde werden automatisch auf Anwendbarkeit gegenüber der Angriffswaffe überprüft

1.6.0 2021-12-18

- Stiller Spielleiter-Modus ganz ohne Ausgaben und 3D-Würfel
- Chatausgaben erscheinen nun im Namen des handelnden Tokens, auch bei NPCs

1.5.0 2021-12-13

- Automatische Datenübernahme aus den `m3mgd_*`-Attributen eines Dummy-Charakterblattes, das als Datenverschiebebahnhof genutzt wird
- Erfahrungspunkte aus jedem Angriff werden automatisch berechnet und gutgeschrieben
- (Workaround) Wird das Skript von einem Benutzer aufgerufen, dem kein Charakter zugeordnet ist, gibt es den Namen des handelnden Tokens eingangs aus.
- Geisterwesen (unendliche LP) und Untote (unendliche AP) werden nun korrekt behandelt
- Ausgabe: Tokenmarker für Erschöpfung, (schwere) Verletzungen und Tod in der Chat-Ausgabe ergänzt (als eine Art Legende für den Token)
- Bugfix: normale schwere Treffer werden nicht mehr fälschlich als schwere kritische Treffer ausgegeben
- Bugfix: Datenübersichten für NPCs werden nur noch dem Spielleiter geflüstert

1.4.0 2021-07-08

- Auch für generische NPCs nutzbar (erfordert MMM 1.20.0)

1.3.1 2021-04-27

- Modifikatoren-Log als Tooltip ergänzt

1.3.0 2021-04-18

- Visuelle Effekte für leichte, schwere und kritische Treffer ergänzt (erfordert MMM 1.17.0)

1.2.1 2021-04-14

- #2: Integration des animierten Würfels für den Abwehrwurf (eleganter als in 1.2)

1.1.1 2021-03-29

- Bugfix: Angriffsschaden = 0 wird nicht mehr abgefangen.

1.1 2021-03-14

- Modifikatoren der LP/AP-Verluste (Rüstung, Parierwaffen) werden jetzt auch privat an GM & Spieler dokumentiert
- Bugfix: Fehlende Tooltips für gute AP/LP-Level ergänzt
- Bugfix: Überstürzten eigenen Angriff (-2) ins modifierLog ergänzt
- Bugfix: Prüfung des Zugriffs auf den Charakterbogen verbessert
- Bugfix: Vorzeichenfehler/Die AP-Vorteile von Parierwaffen und Schilden sind als Minuszahlen gespeichert
- Bugfix: Variablennotation der customizable chat-Zeilen repariert

1.0 2021-03-13

- Bezeichnung und Schutzwert der getragenen Rüstung werden nun automatisch aus dem Charakterbogen gezogen
- Konzentrierte Abwehr (+4) und überraschender Angriff (-4) können ausgewählt werden
- Statusmarker für alle schweren Verletzungen, samt Erinnerung an die Konsequenzen, GIFs für die Todeszone
- Sonderfall abgefangen: "in der Todeszone gelingt eine Abwehr" -> Status bleibt schwerstverwundet ohne Countdown
- Abwehrwaffen eingebaut, samt PP-Chance + nur bei AP>0
- Lokalisierung eingebaut
- Bugfix: Vorzeichenfehler bei der Berechnung der Zeit bis zum Tod
- Bugfix: Angriffe mit 0 Schaden müssen nicht ausgespielt werden
- Bugfix: neue Verwundungen mit effektivem LP-Schaden 0 wegen Rüstung lösen keinen neuen Todescountdown mehr aus
- Intern: konfigurierbare Variablen umbenannt
