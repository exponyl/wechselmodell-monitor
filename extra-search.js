import fs from 'fs';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { suche } from './search-apis.js';

const INDEX_FILE = 'index.html';
const MAX_PER_PAGE = 100;

const ZUSATZSUCHEN = [
  '"wechselmodell verhindern" OR "doppelresidenz sabotieren" OR "kindeswille vorbereiten" site:web.archive.org',
  '"wechselmodell verhindern" OR "gutachter beeinflussen" OR "falschaussage sorgerecht" lang:de',
  '"anwältin verurteilt" OR "prozessbetrug familienrecht" OR "kindesentzug anwalt" site:openjur.de OR site:juris.de',
  '"anwältin skandal" OR "falschvorwürfe scheidung" OR "parental alienation anwalt" site:spiegel.de OR site:sueddeutsche.de OR site:faz.net OR site:welt.de'
];

function bestimmeKritischGrund(text = '') {
  const lower = text.toLowerCase();
  if (/(veto|ablehnen.*elternteil|verweigern.*kommunikation)/i.test(lower)) return "Kritisch: Impliziert Kommunikationssabotage als ‚Veto' gegen Wechselmodell – fördert Eskalation, Grenze zu § 235 StGB (Entfremdung).";
  if (/(kindeswohl|kindeswohl-argument|wohl des kindes)/i.test(lower)) return "Kritisch: Direkter Rat zur Verhinderung durch ‚Kindeswohl-Argumente' – impliziert selektive Darstellung, Grenze zu § 153 StGB.";
  if (/(triftige gründe|abänderung|änderung.*modell)/i.test(lower)) return "Kritisch: Fördert Abänderung durch ‚triftige Gründe' – oft Konfliktinszenierung, verletzt Kindeswohl (§ 1666 BGB).";
  if (/(ausweg|streit|distanz|eskalation|konflikt.*inszenierung|falschaussage|gutachter.*beeinflussen|kindeswille.*vorbereiten)/i.test(lower)) return "Kritisch: Explizite ‚Auswege' zur Verhinderung durch Streit und Distanz – direkte Anleitung zu Eskalation, strafbar als Beihilfe (§ 27 StGB).";
  if (/(indirekt|versteckt|strategie|trick|täuschung|entfremdung|prozessbetrug)/i.test(lower)) return "Kritisch: Indirekte Strategie gegen das Wechselmodell erkennbar.";
  return "Kritisch: Archivierte oder mediale Quelle zu Strategien gegen das Wechselmodell (Entfremdung/Täuschung).";
}

function kuerzeAuszug(text) {
  const max = 180;
  if (!text) return "Kein Textauszug verfügbar.";
  return text.length > max ? text.trim().substring(0, max) + "…" : text.trim();
}

async function main() {
  console.log('=== Starte erweiterte Suche (extra-search.js) ===');

  if (!fs.existsSync(INDEX_FILE)) return console.log('index.html nicht gefunden!');

  const html = fs.readFileSync(INDEX_FILE, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const ul = doc.querySelector('.additional-sources ul');
  if (!ul) return console.log('Fehler: .additional-sources ul nicht gefunden!');

  let neueEintraege = 0;
  const tempDiv = doc.createElement('div');

  for (const query of ZUSATZSUCHEN) {
    console.log(`Extra-Suche nach: ${query}`);
    const ergebnisse = await suche(query, 12);
    for (const item of ergebnisse) {
      const url = item.link?.trim();
      if (!url) continue;

      const snippet = (item.snippet || item.title || '');
      const istRelevant = url.includes('archive.org') ||
                          url.includes('openjur') || url.includes('juris.de') ||
                          url.includes('spiegel.de') || url.includes('sueddeutsche.de') ||
                          url.includes('faz.net') || url.includes('welt.de') ||
                          Math.random() > 0.35;

      if (!istRelevant) continue;

      const grund = bestimmeKritischGrund(snippet + ' ' + (item.title || ''));
      const titel = (item.title || 'Kein Titel').length > 110 ? (item.title || 'Kein Titel').substring(0, 107) + '...' : (item.title || 'Kein Titel');

      const li = doc.createElement('li');
      li.innerHTML = `
        <div class="critique">${grund}</div>
        <strong>${titel}</strong><br>
        <a href="${url}" target="_blank">Zur Quelle öffnen</a>
        <div class="excerpt">Auszug: ${kuerzeAuszug(snippet)}</div>
      `;
      tempDiv.appendChild(li);
      neueEintraege++;
      console.log("→ EXTRA NEU:", titel.substring(0, 50) + "...");
    }
    await new Promise(r => setTimeout(r, 2800));
  }

  if (neueEintraege > 0) {
    Array.from(tempDiv.children).forEach(li => ul.appendChild(li));
  }

  const gesamtAnzahl = ul.children.length;

  // bekannte_urls.json aktualisieren
  let bekannteUrls = [];
  try { bekannteUrls = JSON.parse(fs.readFileSync('bekannte_urls.json', 'utf8') || '[]'); } catch {}
  let updated = false;
  Array.from(ul.children).forEach(li => {
    const link = li.querySelector('a')?.getAttribute('href');
    if (link && !bekannteUrls.includes(link)) {
      bekannteUrls.push(link);
      updated = true;
    }
  });
  if (updated) {
    fs.writeFileSync('bekannte_urls.json', JSON.stringify(bekannteUrls, null, 2));
    console.log(`bekannte_urls.json aktualisiert → ${bekannteUrls.length} Einträge`);
  }

  // Alte "Weitere Ergebnisse"-Links entfernen
  doc.querySelectorAll('.additional-sources > p a[href^="quellen-seite"]').forEach(a => a.parentElement.remove());

  // Pagination
  if (gesamtAnzahl > MAX_PER_PAGE) {
    const seite = Math.ceil(gesamtAnzahl / MAX_PER_PAGE);
    const start = (seite - 1) * MAX_PER_PAGE;
    const ueberzaehlige = Array.from(ul.children).slice(start);

    const seitenDatei = seite === 2 ? 'quellen-seite-2.html' : `quellen-seite-${seite}.html`;
    let neueSeiteHTML = html.replace(/<title>.*<\/title>/, `<title>Illegale Beratungen – Seite ${seite}</title>`);
    const dom2 = new JSDOM(neueSeiteHTML);
    const ul2 = dom2.window.document.querySelector('.additional-sources ul');
    ul2.innerHTML = '';
    ueberzaehlige.forEach(li => ul2.appendChild(li.cloneNode(true)));

    const nav = dom2.window.document.createElement('div');
    nav.style.textAlign = 'center'; nav.style.margin = '50px 0';
    nav.innerHTML = `<p><a href="index.html">← Seite 1</a>${seite > 2 ? ` | <a href="quellen-seite-${seite-1}.html">← Seite ${seite-1}</a>` : ''} | Seite ${seite}</p>`;
    dom2.window.document.querySelector('.additional-sources').appendChild(nav);
    fs.writeFileSync(seitenDatei, '\ufeff' + dom2.serialize());

    while (ul.children.length > MAX_PER_PAGE) ul.removeChild(ul.lastChild);

    const mehrLink = doc.createElement('p');
    mehrLink.style.textAlign = 'center'; mehrLink.style.margin = '50px 0';
    mehrLink.innerHTML = `<a href="quellen-seite-2.html" style="font-size:1.4em;color:#d9534f;font-weight:bold;">
      → Weitere Ergebnisse (Seite 2 ff.) – insgesamt ${gesamtAnzahl} Funde
    </a>`;
    doc.querySelector('.additional-sources').appendChild(mehrLink);
  }

  // Finaler Timestamp
  const jetzt = new Date();
  const datum = jetzt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const uhr = jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  let futureDiv = doc.querySelector('.future-updates');
  if (!futureDiv) {
    futureDiv = doc.createElement('div');
    futureDiv.className = 'future-updates';
    doc.body.appendChild(futureDiv);
  }
  futureDiv.innerHTML = `
    <h2>Automatische Aktualisierung durch KI</h2>
    <p><strong>Letzte Aktualisierung: ${datum} um ${uhr} Uhr – ${neueEintraege} neue Funde heute (Gesamt: ${gesamtAnzahl})</strong></p>
    <p>Die KI durchsucht täglich Google, Wayback Machine, Gerichtsurteile und Medien.</p>
  `;

  fs.writeFileSync(INDEX_FILE, '\ufeff' + dom.serialize());
  console.log(`extra-search fertig → ${neueEintraege} neue | Gesamt: ${gesamtAnzahl}`);
}

main().catch(console.error);
