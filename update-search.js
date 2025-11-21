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

  let neueEintraege = '';

  for (const query of ZUSATZSUCHEN) {
    const ergebnisse = await suche(query);
    ergebnisse.forEach(item => {
      if (item.link.includes('archive.org') || item.link.includes('openjur') || Math.random() > 0.3) {
        neueEintraege += generiereEintrag(item);
      }
    });
    await new Promise(r => setTimeout(r, 2500));
  }

  if (!neueEintraege) {
    console.log('Keine neuen Funde heute.');
    return;
  }

  const html = fs.readFileSync(INDEX_FILE, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const ul = doc.querySelector('.additional-sources ul');
  if (!ul) {
    console.log('Fehler: .additional-sources ul nicht gefunden!');
    return;
  }

  const temp = doc.createElement('div');
  temp.innerHTML = neueEintraege;
  Array.from(temp.children).forEach(li => ul.appendChild(li));

  const gesamt = ul.children.length;

  if (gesamt > MAX_PER_PAGE) {
    const seite = Math.ceil(gesamt / MAX_PER_PAGE);
    const start = (seite - 1) * MAX_PER_PAGE;
    const ueberzaehlige = Array.from(ul.children).slice(start);

    const neueSeiteDatei = seite === 2 ? 'quellen-seite-2.html' : `quellen-seite-${seite}.html`;
    let neueSeiteHTML = html.replace(/<title>.*<\/title>/, `<title>Illegale Beratungen – Seite ${seite}</title>`);
    const dom2 = new JSDOM(neueSeiteHTML);
    const ul2 = dom2.window.document.querySelector('.additional-sources ul');
    ul2.innerHTML = '';
    ueberzaehlige.forEach(li => ul2.appendChild(li.cloneNode(true)));

    const nav = dom2.window.document.createElement('div');
    nav.style.textAlign = 'center';
    nav.style.margin = '50px 0';
    nav.innerHTML = `<p>
      <a href="index.html">← Seite 1</a>
      ${seite > 2 ? ` | <a href="quellen-seite-${seite-1}.html">← Seite ${seite-1}</a>` : ''}
      | Seite ${seite}
      ${gesamt > seite * MAX_PER_PAGE ? ` | <a href="quellen-seite-${seite+1}.html">Seite ${seite+1} →</a>` : ''}
    </p>`;
    dom2.window.document.querySelector('.additional-sources').appendChild(nav);
    fs.writeFileSync(neueSeiteDatei, dom2.serialize());

    while (ul.children.length > MAX_PER_PAGE) ul.removeChild(ul.lastChild);
    const link = doc.createElement('p');
    link.style.textAlign = 'center';
    link.style.margin = '50px 0';
    link.innerHTML = `<a href="quellen-seite-2.html" style="font-size:1.4em; color:var(--primary); font-weight:bold;">
      → Weitere Ergebnisse: Seite 2 und höher (insgesamt ${gesamt} Funde)
    </a>`;
    doc.querySelector('.additional-sources').appendChild(link);
  }

  // Update-Hinweis
  const jetzt = new Date().toLocaleDateString('de-DE');
  const uhr = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const datumP = doc.querySelector('.future-updates p');
  if (datumP) datumP.innerHTML = `<strong>Erweiterte Suche aktiv – Letzte Aktualisierung: ${jetzt} um ${uhr} – ${temp.children.length} neue Funde hinzugefügt! (Gesamt: ${gesamt})</strong>`;

  fs.writeFileSync(INDEX_FILE, '\ufeff' + dom.serialize(), { encoding: 'utf8' });
  console.log(`Fertig! ${temp.children.length} neue Einträge hinzugefügt. Gesamt: ${gesamt}`);
}

main().catch(console.error);
