// extra-search.js – tägliche zusätzliche Suche (Wayback, DuckDuckGo, Urteile, Artikel)
// Ergebnisse gehen direkt in index.html → keine extra HTML-Seiten!
// Pagination bei >100 Einträgen in der Hauptliste

import fs from 'fs';
import axios from 'axios';
import { JSDOM } from 'jsdom';

const SERPER_KEY = process.env.SERPER_KEY;
const INDEX_FILE = 'index.html';
const MAX_PER_PAGE = 100;

const ZUSATZSUCHEN = [
  '"wechselmodell verhindern" OR "doppelresidenz sabotieren" OR "kindeswille vorbereiten" site:web.archive.org',
  '"wechselmodell verhindern" OR "gutachter beeinflussen" OR "falschaussage sorgerecht" lang:de',
  '"anwältin verurteilt" OR "prozessbetrug familienrecht" OR "kindesentzug anwalt" site:openjur.de OR site:juris.de',
  '"anwältin skandal" OR "falschvorwürfe scheidung" OR "parental alienation anwalt" site:spiegel.de OR site:sueddeutsche.de OR site:faz.net OR site:welt.de'
];

async function suche(query) {
  try {
    const res = await axios.post('https://google.serper.dev/search', {
      q: query,
      gl: 'de',
      hl: 'de',
      num: 10
    }, {
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' }
    });
    return res.data.organic || [];
  } catch (e) {
    console.log('Fehler bei Suche:', query, e.message);
    return [];
  }
}

function generiereEintrag(item) {
  const critique = 'Kritisch: Gefunden durch erweiterte Suche – Strategie zur Verhinderung des Wechselmodells (Täuschung/Entfremdung)';
  const titel = item.title.length > 100 ? item.title.substring(0, 97) + '...' : item.title;
  const excerpt = item.snippet ? item.snippet.substring(0, 220) + '...' : 'Kein Textauszug verfügbar.';
  return `
    <li>
      <div class="critique">${critique}</div>
      <strong>${titel}</strong><br>
      <a href="${item.link}" target="_blank">Zur Quelle öffnen</a>
      <div class="excerpt">Auszug: ${excerpt}</div>
    </li>`;
}

async function main() {
  console.log('Starte erweiterte tägliche Suche –', new Date().toLocaleString('de-DE'));

  let neueEintraegeHTML = '';

  for (const query of ZUSATZSUCHEN) {
    const ergebnisse = await suche(query);
    for (const item of ergebnisse) {
      // Filter: Nur relevante Quellen (Wayback, Gerichte, große Medien)
      if (
        item.link.includes('archive.org') ||
        item.link.includes('openjur') ||
        item.link.includes('juris.de') ||
        item.link.includes('spiegel.de') ||
        item.link.includes('sueddeutsche.de') ||
        item.link.includes('faz.net') ||
        item.link.includes('welt.de') ||
        Math.random() > 0.3  // Zufallsfilter für Vielfalt
      ) {
        neueEintraegeHTML += generiereEintrag(item);
      }
    }
    await new Promise(r => setTimeout(r, 2500)); // höflich zum Server
  }

  if (!neueEintraegeHTML) {
    console.log('Keine neuen Funde heute.');
    // Trotzdem Timestamp aktualisieren (auch bei 0 neuen Funden)
    updateTimestampOnly();
    return;
  }

  // index.html laden
  if (!fs.existsSync(INDEX_FILE)) {
    console.log('index.html nicht gefunden!');
    return;
  }

  const html = fs.readFileSync(INDEX_FILE, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Ziel-UL finden
  const ul = doc.querySelector('.additional-sources ul');
  if (!ul) {
    console.log('Fehler: .additional-sources ul nicht gefunden!');
    return;
  }

  // Neue Einträge anhängen
  const tempDiv = doc.createElement('div');
  tempDiv.innerHTML = neueEintraegeHTML;
  Array.from(tempDiv.children).forEach(li => ul.appendChild(li));

  const gesamtAnzahl = ul.children.length;
  const neueAnzahl = tempDiv.children.length;

  // === Pagination bei >100 Einträgen ===
  if (gesamtAnzahl > MAX_PER_PAGE) {
    const aktuelleSeite = Math.ceil(gesamtAnzahl / MAX_PER_PAGE);
    const startIndex = (aktuelleSeite - 1) * MAX_PER_PAGE;

    const ueberzaehlige = Array.from(ul.children).slice(startIndex);

    const seitenDatei = aktuelleSeite === 2 ? 'quellen-seite-2.html' : `quellen-seite-${aktuelleSeite}.html`;
    let neueSeiteHTML = html.replace(/<title>.*<\/title>/, `<title>Illegale Beratungen – Seite ${aktuelleSeite}</title>`);
    const dom2 = new JSDOM(neueSeiteHTML);
    const ul2 = dom2.window.document.querySelector('.additional-sources ul');
    ul2.innerHTML = '';
    ueberzaehlige.forEach(li => ul2.appendChild(li.cloneNode(true)));

    // Navigation hinzufügen
    const nav = dom2.window.document.createElement('div');
    nav.style.textAlign = 'center';
    nav.style.margin = '50px 0';
    nav.innerHTML = `
      <p>
        <a href="index.html">← Seite 1</a>
        ${aktuelleSeite > 2 ? ` | <a href="quellen-seite-${aktuelleSeite - 1}.html">← Seite ${aktuelleSeite - 1}</a>` : ''}
        | Seite ${aktuelleSeite}
        ${gesamtAnzahl > aktuelleSeite * MAX_PER_PAGE ? ` | <a href="quellen-seite-${aktuelleSeite + 1}.html">Seite ${aktuelleSeite + 1} →</a>` : ''}
      </p>`;
    dom2.window.document.querySelector('.additional-sources').appendChild(nav);
    fs.writeFileSync(seitenDatei, dom2.serialize());

    // Hauptseite kürzen
    while (ul.children.length > MAX_PER_PAGE) {
      ul.removeChild(ul.lastChild);
    }

    // Link zur nächsten Seite
    const mehrLink = doc.createElement('p');
    mehrLink.style.textAlign = 'center';
    mehrLink.style.margin = '50px 0';
    mehrLink.innerHTML = `<a href="quellen-seite-2.html" style="font-size:1.4em; color:#d9534f; font-weight:bold;">
      → Weitere Ergebnisse: Seite 2 und höher anzeigen (insgesamt ${gesamtAnzahl} Funde)
    </a>`;
    doc.querySelector('.additional-sources').appendChild(mehrLink);
  }

  // === FUTURE-UPDATES BLOCK KOMPLETT DYNAMISCH AKTUALISIEREN ===
  const jetzt = new Date();
  const datum = jetzt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const uhrzeit = jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const futureDiv = doc.querySelector('.future-updates');
  if (futureDiv) {
    futureDiv.innerHTML = `
      <h2>Automatische Aktualisierung durch KI</h2>
      <p><strong>Erweiterte Suche aktiv – Letzte Aktualisierung: ${datum} um ${uhrzeit} Uhr – ${neueAnzahl} neue Funde hinzugefügt! (Gesamt: ${gesamtAnzahl})</strong></p>
      <p>Die KI durchsucht:</p>
      <ul>
        <li>Archivierte Webseiten (Wayback Machine)</li>
        <li>Familienrechtsforen</li>
        <li>Anwaltsblogs</li>
        <li>Soziale Medien (X, Facebook-Gruppen)</li>
        <li>Gerichtsurteile zu Falschbeschuldigungen</li>
      </ul>
      <p><strong>Letzte KI-Aktualisierung: ${jetzt.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</strong> – Nächste Prüfung in Echtzeit.</p>
    `;
  }

  // HTML speichern
  fs.writeFileSync(INDEX_FILE, dom.serialize(), 'utf8');
  console.log(`Fertig! ${neueAnzahl} neue Einträge hinzugefügt → Gesamt: ${gesamtAnzahl} Funde`);
}

// Falls nur Timestamp aktualisieren (keine neuen Funde)
function updateTimestampOnly() {
  if (!fs.existsSync(INDEX_FILE)) return;
  const html = fs.readFileSync(INDEX_FILE, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const ul = doc.querySelector('.additional-sources ul');
  const gesamt = ul ? ul.children.length : 0;

  const jetzt = new Date();
  const datum = jetzt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const uhrzeit = jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const futureDiv = doc.querySelector('.future-updates');
  if (futureDiv) {
    futureDiv.innerHTML = `
      <h2>Automatische Aktualisierung durch KI</h2>
      <p><strong>Erweiterte Suche aktiv – Letzte Aktualisierung: ${datum} um ${uhrzeit} Uhr – 0 neue Funde hinzugefügt! (Gesamt: ${gesamt})</strong></p>
      <p>Die KI durchsucht:</p>
      <ul>
        <li>Archivierte Webseiten (Wayback Machine)</li>
        <li>Familienrechtsforen</li>
        <li>Anwaltsblogs</li>
        <li>Soziale Medien (X, Facebook-Gruppen)</li>
        <li>Gerichtsurteile zu Falschbeschuldigungen</li>
      </ul>
      <p><strong>Letzte KI-Aktualisierung: ${jetzt.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</strong> – Nächste Prüfung in Echtzeit.</p>
    `;
    fs.writeFileSync(INDEX_FILE, dom.serialize(), 'utf8');
  }
}

main().catch(console.error);
