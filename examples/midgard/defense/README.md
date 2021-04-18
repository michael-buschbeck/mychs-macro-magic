# MMM-Abwehrskript für Midgard (5. Ausgabe)

Aktuelle Version: **1.2.1 vom 2021-04-14,** erfordert MMM 1.16.0+, ist in unserem Midgard-Spiel installiert (`#defend`).

Das MMM-basierte Midgard-Abwehrskript führt die Abwehr von Angriffen durch. Dabei werden die eigene Erschöpfung (-4 bei AP:0) und die eingestellte Rüstung automatisch und weitere Modifikatoren nach Benutzerauswahl und -eingabe berücksichtigt, und die Konsequenzen umgesetzt (Abzüge AP und LP, ggf. Ausgabe der Folgen). Optional lassen sich in einem kurzen Konfigurationsskript die Auswahl der Abwehrwaffe (Schild/Parierwaffe) und die Textausgaben anpassen.

### Inhalt

- [Features & Anwendung](#features--anwendung)
- [Todo-Liste](#todo-liste)
- [Beispiel-Konfiguration](#beispiel-konfiguration)
- [What's new?](#changelog)


## Features & Anwendung

Das Skript fragt zunächst alle wichtigen Daten über den Angriff vom Benutzer ab, berechnet die Ergebnisse des Abwehrversuchs und gibt sie aus. Ein Aufruf muss sich auf genau eine Abwehrtechnik (Standardwaffe/waffenlos/eine bestimmte Abwehrwaffe) beziehen. All diese Optionen können per [Konfigskripts](#konfig-skript-optional) genutzt werden, das Abwehrskript funktioniert aber auch ohne Konfigskript und wendet dann die Standardabwehrtechnik des Charakterbogens an.

### Konfig-Skript (optional)

#### Unterschiedliche Abwehrwaffen

Wer nicht nur "Abwehr ohne Schild" kann, muss das Konfigskript benutzen und zumindest die Zeile `!mmm set cWeaponLabel = "Kleiner Schild"` mit dem Namen der benutzten Abwehrwaffe aus dem Abwehrblock des Kampfblatts setzen. Hierdurch erhält das Skript Zugriff auf die nötigen Fähigkeitswerte und Schadensmodifikatoren. Wer unterschiedliche Abwehrwaffen/Schilde nutzt, muss mehrere Konfigskripte anlegen und jeweils das gewünschte aufrufen (z.B. per Chatmenü, wie rechts im Screenshot oben abgebildet).

#### Unterschiedliche Charaktere/NPCs

Wer das Skript z.B. als Spielleiter nicht immer für den Charakter aufruft, der als Absender im Chatfenster steht, kann für seine Charaktere das Konfigskript jeweils als Ability anlegen und darin `!mmm set cOwnID = "@{character_id}"` setzen. Damit wird der Bezugscharakter jeweils korrekt gesetzt, egal wer gerade im Chat als Absender steht.

#### Geschichtenerzählerausgabe

`cVerbose = [true|false]` schaltet die Geschichtenerzählerausgabe an/ab. Nur wer `cVerbose = true` setzt, braucht sich über die `!mmm translate [...]: ...`-Zeilen Gedanken zu machen.

Die letzte Zeile `#defend` ruft das eigentliche Skript auf, das muss dann unter dem hier genannten Namen angelegt sein (entweder beim Charakter oder beim GM).

![Screenshot](mmm-defense-1.1-mit-chatmenue.png)
![Screenshot](mmm-defense-1.1-plattenruestung-neu.png)

### Datenabfragen

Das Skript fragt bei jedem Start eine Reihe von Daten zum Angriff ab, ob relevant oder nicht:
- *Angriffswert:* `EW:Angriff`, gegen den die Abwehr gelingen soll.
- *Kritischer Erfolg beim Angriff:* Ja/Nein.
- *Schaden laut Angreifer:* Ergebnis des Schadenswurfs, der abgewehrt oder durch Rüstungsschutz reduziert werden soll.
- *Angriff mit schweren, scharfen Geschossen:* Ja/Nein. (Für den Sonderfall, dass Plattenrüstungen gegen solche Geschosse nur bis max. 3 Punkte schützen.)
- *Angriff mit Schild oder Parierwaffe parierbar:* Ja/Nein. (Wenn nein, können keine Schilde oder Parierwaffen benutzt werden. Waffenspezifische Regeln siehe *Kodex: 70*).
- *Standard-Abwehrmodifikatoren:*
  -  keine: *Normale Abwehr +/-0*
  - *Konzentrierte Abwehr +4*
  - *Ich greife überstürzt an -2*
  - *Ich bin überrascht -4*
- *Weitere spezielle Abwehrmodifikatoren:* Zahlenwert, nach Bedarf.

## Todo-Liste

- Sobald MMM Zugriff und Verarbeitung von Tabellen erlaubt, könnte das Skript alle verfügbaren Abwehrwaffen und Schilde zur Auswahl anbieten und, falls nur eine vorhanden ist, als Default komplett auf die Definition in einem Konfigurationsskript verzichten.
- Die weiteren Konsequenzen schwerer Verwundungen könnten automatisch umgesetzt werden (reduzierte AP und Bewegungsweite wegen niedriger LP).
- Ein Heilungsskript wäre gut, das die ganzen Zustandsmarker (rot, gelb, grün, Totenkopf) wieder automatisch entfernt und zeitweilige Einschränkungen von AP oder Bewegung rückgängig macht.
- Es gibt noch zwei Sonderfälle für [Abwehrmodifikatoren](https://midgard.alienn.net/doku.php?id=abwehr_nahkampf_boni_und_malusse), die -- samt der dann notwendigen Verschachtelung unterschiedlicher Kombinationen -- noch nicht eingebaut sind (schwere Beinverletzung und vollständige Dunkelheit).

## Beispiel-Konfiguration

Beispiel für einen Parierdolch, ohne die Erzählerei zu verändern (Voraussetzung ist, dass das Hauptskript als Makro `defend` angelegt ist, bzw. der Name des Makros in der letzten Zeile angepasst wird -- Aufruf mit # für Makros, % für Abilities):

```javascript
!mmm customize
!mmm    set cVerbose = true
!mmm    set cWeaponLabel = "Parierdolch"
!mmm    set cOwnID = "@{character_id}"
!mmm end customize
#defend
```

## Changelog

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
