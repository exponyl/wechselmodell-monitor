import fs from 'fs';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { suche } from './search-apis.js';

const MAX_PER_PAGE = 100;

const SUCHBEGRIFFE = [
  "Wechselmodell verhindern",
  "Doppelresidenz verhindern Anwalt",
  "Wechselmodell sabotieren",
  "Wechselmodell gegen Willen",
  "Residenzmodell durchsetzen",
  "Wechselmodell Kommunikation verweigern",
  "Wechselmodell Kindeswohl Argument ablehnen",
  "Wechselmodell Veto Elternteil",
  "paritätisches Wechselmodell verhindern",
  "Wechselmodell ablehnen Tipps"
];

function bestimmeKritischGrund(text) {
  const lower = text.toLowerCase();
  if (/(veto|ablehnen.*elternteil|verweigern.*kommunikation)/i.test(lower)) return "Kritisch: Impliziert Kommunikationssabotage als ‚Veto' gegen Wechselmodell – fördert Eskalation, Grenze zu § 235 StGB (Entfremdung).";
  if (/(kindeswohl|kindeswohl-argument|wohl des kindes)/i.test(lower)) return "Kritisch: Direkter Rat zur Verhinderung durch ‚Kindeswohl-Argumente' – impliziert selektive Darstellung, Grenze zu § 153 StGB.";
  if (/(triftige gründe|abänderung|änderung.*modell)/i.test(lower)) return "Kritisch: Fördert Abänderung durch ‚triftige Gründe' – oft Konfliktinszenierung, verletzt Kindeswohl (§ 1666 BGB).";
  if (/(ausweg|streit|distanz|eskalation|konflikt.*inszenierung)/i.test(lower)) return "Kritisch: Explizite ‚Auswege' zur Verhinderung durch Streit und Distanz – direkte Anleitung zu Eskalation, strafbar als Beihilfe (§ 27 StGB).";
  if (/(indirekt|versteckt|strategie|trick)/i.test(lower)) return "Kritisch: Indirekte Strategie gegen das Wechselmodell erkennbar.";
  return "Kritisch: Direkte Anleitung zur Verhinderung des Wechselmodells";
}

function kuerzeAuszug(text) {
  const max = 180;
  if (!text || text.length <= max) return text || "Kein Auszug verfügbar.";
  return text.slice(0, max).trim() + "…";
}

async function holeInhalt(url) {
  try {
    const { data } = await axios.get(url, { timeout: 15000 });
    const dom = new JSDOM(data, { url });
    const title = dom.window.document.querySelector('title')?.textContent.trim() || "Kein Titel";
    const bodyText = dom.window.document.body.textContent.replace(/\s+/g, ' ').trim();
    return { title, text: bodyText };
  } catch (err) {
    console.log("Fehler beim Laden von", url);
    return null;
  }
}

async function main() {
  console.log("=== Starte Hauptsuche (update-search.js) ===");

  const html = fs.readFileSync('index.html', 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const liste = doc.querySelector('.additional-sources ul');
  if (!liste) return console.log("FEHLER: .additional-sources ul nicht gefunden!");

  let bekannteUrls = [];
  try {
    bekannteUrls = JSON.parse(fs.readFileSync('bekannte_urls.json', 'utf8') || '[]');
  } catch {}

  let neuGefunden = 0;

  for (const begriff of SUCHBEGRIFFE) {
    console.log(`Suche nach: ${begriff}`);
    const ergebnisse = await suche(begriff, 18);
    for (const item of ergebnisse) {
      const url = item.link?.trim();
      if (!url || bekannteUrls.includes(url) || url.includes('wikipedia.org')) continue;

      const inhalt = await holeInhalt(url);
      if (!inhalt || inhalt.text.length < 150) continue;

      const kritik = bestimmeKritischGrund(inhalt.text);
      const auszug = kuerzeAuszug(inhalt.text);

      const li = doc.createElement('li');
      li.innerHTML = `
        <div class="critique">${kritik}</div>
        <strong>${inhalt.title.substring(0, 120)}</strong><br>
        <a href="${url}" target="_blank">Zur Webseite</a>
        <div class="excerpt">Auszug: ${auszug}</div>
      `;

      liste.appendChild(li);
      bekannteUrls.push(url);
      neuGefunden++;
      console.log("→ NEU:", inhalt.title.substring(0, 70) + "...");
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  const gesamtAnzahl = liste.children.length;

  // Alte "Weitere Ergebnisse"-Links auf Hauptseite entfernen
  doc.querySelectorAll('.additional-sources > p a[href^="quellen-seite"]').forEach(a => a.parentElement.remove());

  // Erweiterte Pagination: Alle Subseiten neu generieren, um alte Zahlen zu überschreiben
  if (gesamtAnzahl > MAX_PER_PAGE) {
    const seite = Math.ceil(gesamtAnzahl / MAX_PER_PAGE);
    const start = (seite - 1) * MAX_PER_PAGE;
    const ueberzaehlige = Array.from(liste.children).slice(start);

    // Für jede mögliche Subseite neu generieren (löscht alte und erstellt frisch)
    for (let s = 2; s <= seite; s++) {
      const seitenStart = (s - 1) * MAX_PER_PAGE;
      const seitenUeberzaehlige = Array.from(liste.children).slice(seitenStart, seitenStart + MAX_PER_PAGE);
      const seitenDatei = s === 2 ? 'quellen-seite-2.html' : `quellen-seite-${s}.html`;
      
      let neueSeiteHTML = html.replace(/<title>.*<\/title>/, `<title>Illegale Beratungen – Seite ${s}</title>`);
      const dom2 = new JSDOM(neueSeiteHTML);
      const ul2 = dom2.window.document.querySelector('.additional-sources ul');
      ul2.innerHTML = '';
      seitenUeberzaehlige.forEach(li => ul2.appendChild(li.cloneNode(true)));

      // Navigation auf jeder Subseite
      const nav = dom2.window.document.createElement('div');
      nav.style.textAlign = 'center'; nav.style.margin = '50px 0';
      let navHTML = `<p>`;
      if (s > 1) navHTML += `<a href="index.html">← Seite 1</a> | `;
      if (s > 2) navHTML += `<a href="quellen-seite-${s-1}.html">← Seite ${s-1}</a> | `;
      navHTML += `Seite ${s}`;
      if (s < seite) navHTML += ` | <a href="quellen-seite-${s+1}.html">Seite ${s+1} →</a>`;
      navHTML += `</p>`;
      nav.innerHTML = navHTML;
      dom2.window.document.querySelector('.additional-sources').appendChild(nav);

      // Alten Link auf Subseite entfernen (falls vorhanden)
      dom2.window.document.querySelectorAll('.additional-sources > p a[href^="quellen-seite"]').forEach(a => a.parentElement.remove());

      // Timestamp auch auf Subseiten aktualisieren
      const jetzt = new Date();
      const datum = jetzt.toLocaleDateString('de-DE');
      const uhrzeit = jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      let futureDiv2 = dom2.window.document.querySelector('.future-updates');
      if (!futureDiv2) { futureDiv2 = dom2.window.document.createElement('div'); futureDiv2.className = 'future-updates'; dom2.window.document.body.appendChild(futureDiv2); }
      futureDiv2.innerHTML = `
        <h2>Automatische Aktualisierung durch KI</h2>
        <p><strong>Letzte Aktualisierung: ${datum} um ${uhrzeit} Uhr – Gesamt: ${gesamtAnzahl} Funde</strong></p>
        <p>Die KI durchsucht täglich Google, Wayback Machine, Gerichtsurteile und Medien.</p>
      `;

      fs.writeFileSync(seitenDatei, '\ufeff' + dom2.serialize());
      console.log(`Subseite ${s} neu generiert: ${seitenUeberzaehlige.length} Einträge`);
    }

    // Hauptseite kürzen + neuer Link mit aktueller Zahl
    while (liste.children.length > MAX_PER_PAGE) liste.removeChild(liste.lastChild);

    const mehrLink = doc.createElement('p');
    mehrLink.style.textAlign = 'center'; mehrLink.style.margin = '50px 0';
    mehrLink.innerHTML = `<a href="quellen-seite-2.html" style="font-size:1.4em;color:#d9534f;font-weight:bold;">
      → Weitere Ergebnisse (Seite 2 ff.) – insgesamt ${gesamtAnzahl} Funde
    </a>`;
    doc.querySelector('.additional-sources').appendChild(mehrLink);
  }

  // Timestamp auf Hauptseite
  const jetzt = new Date();
  const datum = jetzt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const uhrzeit = jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  let futureDiv = doc.querySelector('.future-updates');
  if (!futureDiv) {
    futureDiv = doc.createElement('div');
    futureDiv.className = 'future-updates';
    doc.body.appendChild(futureDiv);
  }
  futureDiv.innerHTML = `
    <h2>Automatische Aktualisierung durch KI</h2>
    <p><strong>Letzte Aktualisierung: ${datum} um ${uhrzeit} Uhr – ${neuGefunden} neue Funde heute (Gesamt: ${gesamtAnzahl})</strong></p>
    <p>Die KI durchsucht täglich Google, Wayback Machine, Gerichtsurteile und Medien.</p>
  `;

  fs.writeFileSync('index.html', '\ufeff' + dom.serialize());
  fs.writeFileSync('bekannte_urls.json', JSON.stringify(bekannteUrls, null, 2));

  console.log(`update-search fertig → ${neuGefunden} neue | Gesamt: ${gesamtAnzahl}`);
}

main().catch(console.error);
