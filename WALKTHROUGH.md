# ClearFlow Hamburg — Demo-Walkthrough
## Präsentation bei Dirk Grah · 28. April 2026

**Gesamtdauer: ca. 25 Minuten**
URL: `clearflow.poeticte.ch` · Fallback Demo-Modus: URL + `?demo=true`

---

> **Aussprache-Guide** (einmal laut üben):
> - „Netting" → sprich **„Verrechnung"** (nicht „Netting" — zu technisch)
> - „LP-optimal" → sprich **„optimale Verrechnung"** oder **„mathematisch optimiert"**
> - „bilateral" → sprich **„gegenseitig"** oder **„zwischen zwei Partnern"**
> - „multilateral" → sprich **„im gesamten Netzwerk"**

---

> ## ★ 3 ZAHLEN, DIE ELA AUSWENDIG KENNEN MUSS ★
>
> | Zahl | Bedeutung | Wo zu sehen |
> |------|-----------|-------------|
> | **42 %** | Liquiditätsentlastung im letzten Clearing-Zyklus | Übersicht → Clearing-Verlauf, letzter Balken |
> | **294.805 €** | Freigesetzte Liquidität im letzten Clearing | Übersicht → grünes Banner „freigesetzt" |
> | **1.251.265 €** | Zusätzliche Einsparung durch optimale Verrechnung (vs. einfaches Netzwerk) | Vergleich → grüne ★-Box |

---

<div style="page-break-after: always;"></div>

---

# ACT 1 — Das Netzwerk · 5 Minuten

**Seite:** Klick auf **◈ Übersicht** (erster Tab, links oben)

## Was zu sagen:

> „Das hier ist ClearFlow Hamburg — eine Plattform, die GLS Bank nutzt, um die Liquidität im Hamburger Handelsnetzwerk freizusetzen."

**Zeigen: KPI-Kacheln (obere Reihe)**

> „Aktuell sind **50 Unternehmen** im Netzwerk — Hafenbetriebe, Lebensmittelproduzenten, Erneuerbare-Energie-Firmen. Zusammen haben sie **312 offene Rechnungen**."

**Zeigen: Grünes Banner (Mitte der Seite)**

> „Beim letzten Clearing-Lauf hat das Netzwerk **294.805 € Liquidität freigesetzt** — das sind 35 % aller Bruttoverpflichtungen, die nicht mehr einzeln bezahlt werden mussten."

**Zeigen: Netzwerkgraph (untere Hälfte)**

> „Dieser Graph zeigt, wer mit wem handelt. Die **größeren, vollflächigen Knoten** sind GLS-Mitglieder. Die Farben zeigen Branchen: Grün = Hafen/Logistik, Orange = Lebensmittel, Blau = Erneuerbare."

**GLS-Kunden hervorheben:**

> „Alle farblich vollgesättigten Knoten — Hamburger Hafen GmbH, Elbe Spedition, Windkraft Nordsee, Elbe Bäckerei — sind GLS-Mitglieder. Sie profitieren direkt vom Clearing."

**Drauf zeigen:** Kreis mit Label „Hamb" (Hamburger Hafen GmbH) — größter GLS-Knoten im Port/Logistik-Cluster.

---

**⚠ Fallback:** Backend nicht verbunden → klein-kursiver Hinweis „Demo-Daten" erscheint. Alle Zahlen und der Graph funktionieren trotzdem vollständig. Keine Aktion nötig.

---

<div style="page-break-after: always;"></div>

---

# ACT 2 — Die Rechnungen · 3 Minuten

**Seite:** Klick auf **≡ Rechnungen** (zweiter Tab)

## Was zu sagen:

> „Hier sieht man alle offenen Rechnungen im Netzwerk. Jede Rechnung ist einem Absender und einem Empfänger zugeordnet."

**Zeigen: Rechnungsliste**

> „Wir filtern jetzt auf ein konkretes Beispiel, das Dirk gut kennen wird: zwei Partner, die **gegenseitig Rechnungen aneinander** haben."

**Hervorheben: Elbe Bäckerei Verwaltungs GmbH ↔ Biokontor Hamburg eG**

> „Elbe Bäckerei schuldet Biokontor **3.400 €** für Biomehl — gleichzeitig schuldet Biokontor Elbe Bäckerei **1.900 €** für Verpackungsmaterial."
>
> „Ohne ClearFlow: beide müssen zahlen, Liquidität fließt hin und her. Mit ClearFlow: nur die Differenz — **1.500 € netto** — wird bezahlt. **1.900 € werden einfach verrechnet.**"

---

**⚠ Fallback:** Falls Filter nicht reagiert → manuell auf die erste Rechnung in der Liste zeigen und das Prinzip erläutern (gleiche Aussage, andere Zahlen).

---

<div style="page-break-after: always;"></div>

---

<div style="page-break-after: always;"></div>

---

# ACT 2b — Die Bäckerei-Perspektive · 3 Minuten

**Seite:** Klick auf **⊞ GLS Admin** (fünfter Tab) — Netzwerkgraph sichtbar

## Was zu sagen:

> „Die bisherige Ansicht war die der GLS Bank — das Gesamtnetzwerk aus Bankperspektive. Jetzt machen wir etwas, das ich sehr gerne zeige: **Wir wechseln die Perspektive.**"

**Demo-Moment: Auf den Knoten „Elbe Bäckerei" im Netzwerkgraph klicken**

> „Ich klicke hier auf Elbe Bäckerei Verwaltungs GmbH — einen GLS-Kunden im Lebensmittelsektor."

*→ Die Oberfläche wechselt in den SME-Modus: Header wird warm-dunkel, Avatar erscheint rechts oben, Navigation wechselt auf 4 Tabs.*

> „Sehen Sie? Die gesamte Oberfläche passt sich an. Wir sehen jetzt dieselbe Plattform — aber aus der Sicht der Bäckerei."

**Zeigen: Übersicht-Tab (SME)**

> „Elbe Bäckerei sieht ihre **eigenen** Rechnungen, ihre **eigene** Clearing-Ersparnis, ihre direkten Handelspartner."

**Zeigen: KPI-Kacheln**

> „Sie hat derzeit **2 offene Rechnungen**, **1.500 € Nettoverpflichtung** nach Clearing — und eine Einsparung von **20 %** gegenüber der Brutto-Zahlung."

**Zeigen: Clearing-Tab (SME)**

> „Im Clearing-Tab sieht die Bäckerei genau, wie ihre Position im Netzwerk aussieht. **Kein Bankkonto, kein Telefon** — die Transparenz ist direkt in der Plattform."

**Zurückwechseln:** Klick auf „⊞ GLS-Ansicht" im Segmentpicker (links oben im Header)

> „Und mit einem Klick kommen wir zurück — die Bank behält die Kontrolle über das gesamte Netzwerk."

---

**⚠ Fallback:** Falls der Klick auf den Knoten nicht reagiert → manuell auf „◈ Unternehmen" im Header-Picker klicken und Elbe Bäckerei aus dem Dropdown wählen. Gleicher Effekt.

---

<div style="page-break-after: always;"></div>

---

# ACT 3 — Das Clearing · 7 Minuten

**Seite:** Klick auf **→ Vergleich** (vierter Tab — „Netting-Vergleich")

## Was zu sagen:

> „Jetzt zeige ich, was passiert, wenn wir nicht nur zwei Unternehmen verrechnen, sondern das **gesamte Netzwerk** gleichzeitig optimieren."

**Zeigen: Blaues Banner oben (Gesamteinsparung)**

> „Das Ergebnis: Aus **16,4 Mio. € Bruttoverpflichtungen** werden nach optimaler Verrechnung nur noch **4,5 Mio. € netto** — eine Reduktion um **72,5 %**."

**Zeigen: Die 4 Stufen-Kacheln (Waterfall)**

Kacheln von links nach rechts durchgehen:

1. **≡ Bruttoverpflichtungen** (orange): „Das ist der Ausgangspunkt — alles, was alle schulden: 16,4 Mio. €"
2. **⇄ Nach bilateraler Verrechnung** (blau): „Gegenseitige Rechnungen werden direkt verrechnet → 7,1 Mio. € übrig. **56 % weg.**"
3. **⬡ Nach Netzwerk-Verrechnung** (hellgrün): „Ketten von Verpflichtungen werden aufgelöst — z.B. A zahlt B, B zahlt C, C zahlt A → einfach streichen → 5,7 Mio. € übrig."
4. **★ Nach optimaler Verrechnung** (dunkelgrün, OPTIMAL-Badge): „Hier kommt die Mathematik: Ein Optimierungsalgorithmus findet **alle** möglichen Verrechnungen gleichzeitig → 4,5 Mio. €."

**Zeigen: Grüne ★-Box „Zusätzliche Einsparung durch Optimierung"**

> „Das ist der entscheidende Unterschied zu anderen Systemen: **1.251.265 € zusätzlich** — nur durch den Optimierungsalgorithmus, den ClearFlow entwickelt hat."

**UnternehmensVergleich (scrollen nach unten)**

> „Wer profitiert am meisten? Windkraft Nordsee GmbH spart **735.000 €** — das sind **43,8 %** ihrer Verpflichtungen."

**Drauf zeigen:** Zeile #1 in der Tabelle mit „Top-Sparer"-Badge neben „Windkraft Nordsee GmbH".

---

**⚠ Fallback:** Falls die Waterfall-Kacheln nicht laden → `?demo=true` an URL anhängen. Mock-Daten sind identisch mit den obigen Zahlen.

---

<div style="page-break-after: always;"></div>

---

# ACT 4 — Das Wachstum · 5 Minuten

**Seite:** Klick auf **⊙ Entdecken** (letzter Tab)

## Was zu sagen:

> „ClearFlow zeigt nicht nur, was heute im Netzwerk passiert — es zeigt auch, **wo das Netzwerk wachsen kann**."

**Zeigen: KPI-Bar oben (3 Kacheln)**

> „Aktuell gibt es **5 potenzielle neue Verbindungen** — Unternehmen, die im selben Sektor arbeiten, aber noch nicht miteinander verrechnen. Geschätztes Jahresvolumen: **13,65 Mio. €**."
> „Und **2 Onboarding-Kandidaten** — Nicht-GLS-Mitglieder, bei denen eine Einladung sinnvoll wäre."

**Zeigen: Potenzielle Verbindungen — Karte #1**

> „Hier: Nordsee Zolldienstleister ↔ Hamburger Hafen. Ähnlichkeit 94. Geschätztes Volumen: **3,8 Mio. € pro Jahr**. Beide arbeiten im Hafencluster — aber haben bisher nie direkt abgerechnet."

**Zeigen: Karte #4 (Solar HH Technik ↔ Windkraft Nordsee)**

> „Und hier zwei, die schon handeln — Solar schuldet Windkraft 21.000 € — aber einseitig. Mit einem zweiten Partner im Netzwerk würde das zum Clearing-Fall."

**Zeigen: Finanzierungslücken (scrollen nach unten)**

> „GLS kann nicht nur verrechnen — GLS kann auch **finanzieren**. Diese drei Rechnungen sind kandidaten für Factoring oder Lieferantenfinanzierung. Zusammen: **4,21 Mio. €** Volumen."

---

**⚠ Fallback (NetzwerkWachstum-Simulator noch in Entwicklung):**
Falls Dirk nach einer interaktiven Simulation fragt: „Den Simulator für neue Netzwerkmitglieder arbeiten wir gerade aus — die Grunddaten sehen Sie hier. Wir können das gerne in einer Follow-up-Demo vertiefen."

---

<div style="page-break-after: always;"></div>

---

# ACT 5 — Der Verlauf · 3 Minuten

**Seite:** Zurück zu **◈ Übersicht** — nach unten scrollen zum **Clearing-Verlauf**-Diagramm

## Was zu sagen:

> „Zum Abschluss: Das ist die **Geschichte des Netzwerks** — 8 Monate Clearing-Daten."

**Zeigen: Balkendiagramm (ClearingVerlauf)**

> „September 2025: **28 %** Einsparung. April 2026 — letzten Monat: **42 %**. Das ist kein Zufall."

**Auf den orangefarbenen Trend-Pfeil (gestrichelte Linie) zeigen:**

> „Der Trend ist klar aufwärts. Aber schauen Sie auf **März und April 2026** — da ist der Sprung am deutlichsten."

**Auf die letzten zwei Balken zeigen (Mär 41,5 %, Apr 42,0 %)**

> „In February haben wir auf **optimale Verrechnung** umgestellt. Der Algorithmus lernt nicht — er *optimiert*. Aber das Netzwerk wächst: mehr Unternehmen, mehr Rechnungen, mehr Verrechnungspotenzial."

**Auf einen Balken klicken (z.B. April 2026)**

Detail-Panel erscheint:
> „312 Rechnungen, 50 Unternehmen, **42 % Liquiditätsentlastung**. Das ist der Stand heute."

---

**⚠ Fallback:** Falls Balken nicht klickbar → Zahlen aus Kopf nennen (die 3 Zahlen oben).

---

<div style="page-break-after: always;"></div>

---

# CLOSING — Offene Frage an Dirk · 2 Minuten

**Seite:** Diagramm lassen, Blick zu Dirk

## Was zu sagen:

> „Was Sie hier sehen, basiert auf synthetischen Daten, die das Handelsnetzwerk Ihrer Hamburger Kunden modellieren. Die Branchen, die Größenordnungen, die Verflechtungen — das entspricht dem, was wir über den Markt wissen. Im Pilotprojekt würden wir mit echten Rechnungsdaten arbeiten."
>
> „Meine Frage an Sie: **Welche Ihrer Kunden würden als nächste von diesem Netzwerk profitieren?** Und: Was müsste ClearFlow zeigen, damit Sie es als GLS-Standard-Tool sehen?"

**Pause. Dirk sprechen lassen.**

---

**Backup-Fragen, falls Stille:**
- „Welche Branche außer Hafen und Lebensmittel sehen Sie als nächsten Cluster?"
- „Wie wichtig ist Ihnen der Schritt von bilateral zu optimal — oder ist bilateral für die meisten Kunden bereits ausreichend?"
- „Hätten Sie Interesse an einem Piloten mit 5 konkreten Unternehmen aus Ihrem Bestand?"

---

## Notizen nach dem Gespräch

```
Datum: 28.04.2026
Anwesend:
Dirks Feedback:
Nächste Schritte:
Follow-up bis:
```

---

*ClearFlow Hamburg Sprint · April 2026*
