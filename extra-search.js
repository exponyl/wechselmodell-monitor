import fs from 'fs';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { suche } from './search-apis.js';

const INDEX_FILE = 'index.html';
const MAX_PER_PAGE = 100;

const ZUSATZSUCHEN = [
  // Wayback Machine (Foren, alte Blogs etc.)
  '"wechselmodell verhindern" OR "wechselmodell sabotieren" OR "doppelresidenz verhindern" OR "wechselmodell boykott" site:web.archive.org',
  '"kindeswille vorbereiten" OR "kindeswille manipulieren" OR "kind aufhetzen" OR "kind gegen vater aufhetzen" site:web.archive.org',
  '"gutachter täuschen" OR "gutachter manipulieren" OR "gutachten beeinflussen" OR "gutachter vorbereiten" site:web.archive.org',
  '"umgang boykottieren" OR "umgang sabotieren" OR "kontaktabbruch vater" OR "umgangsvereitlung tipps" site:web.archive.org',

  // Rechtsdatenbanken
  '"wechselmodell" OR "doppelresidenz" OR "paritätisches wechselmodell" OR "echtes wechselmodell" site:openjur.de',
  '"wechselmodell" OR "umgangsausschluss" OR "umgangsvereitlung" OR "elternentfremdung" OR "kindeswille manipulation" site:openjur.de',
  '"prozessbetrug" OR "falschaussage" OR "falsche beschuldigung" AND ("familienrecht" OR "sorgerecht" OR "umgangsrecht") site:openjur.de OR site:juris.de',

  // Große Medien (nur mit klarem Familienrechts-Bezug)
  '"wechselmodell" OR "doppelresidenz" AND ("gericht" OR "olG" OR "bundesgerichtshof" OR "verfassungsbeschwerde") site:spiegel.de OR site:sueddeutsche.de OR site:faz.net OR site:welt.de',
  '"elternentfremdung" OR "umgangsvereitlung" OR "kindeswohlgefährdung vorwurf" OR "vaterdiskriminierung" site:spiegel.de OR site:sueddeutsche.de OR site:faz.net OR site:welt.de',

  // Allgemeine Google-Suchen – stark eingeschränkt und familienrechtlich präzisiert
  '"wechselmodell verhindern" OR "doppelresidenz ablehnen" familienrecht OR sorgerecht OR umgangsrecht',
  '"kindeswille manipulieren" OR "kind gegen vater aufhetzen" OR "kindeswille vorbereiten" familienrecht',
  '"gutachter täuschen" OR "psychologisches gutachten manipulieren" OR "gutachter beeinflussen" familienrecht OR wechselmodell',
  '"umgang boykottieren" OR "umgangsvereitlung strafbar" OR "kontaktabbruch vater" familienrecht OR sorgerecht',
  '"elternentfremdung tipps" OR "kind entfremden" OR "vater kind beziehung zerstören" -forum -reddit',
  '"falschvorwürfe familienrecht" OR "falsche gewaltvorwürfe scheidung" OR "prozessbetrug sorgerecht"',
  '"kommunikation verweigern sorgerecht" OR "nachrichten blockieren wechselmodell" OR "appartementmethode" familienrecht'
];

function bestimmeKritischGrund(text = '') {
  const lower = text.toLowerCase();
  const rot = '<span style="color:#c00;font-weight:bold">Kritisch:</span> ';
  if (/(veto|ablehnen.*elternteil|verweigern.*kommunikation)/i.test(lower)) return `${rot}Impliziert Kommunikationssabotage als ‚Veto' gegen Wechselmodell – fördert Eskalation, Grenze zu § 235 StGB (Entfremdung).`;
  if (/(kindeswohl|kindeswohl-argument|wohl des kindes)/i.test(lower)) return `${rot}Direkter Rat zur Verhinderung durch ‚Kindeswohl-Argumente' – impliziert selektive Darstellung, Grenze zu § 153 StGB.`;
  if (/(triftige gründe|abänderung|änderung.*modell)/i.test(lower)) return `${rot}Fördert Abänderung durch ‚triftige Gründe' – oft Konfliktinszenierung, verletzt Kindeswohl (§ 1666 BGB).`;
  if (/(ausweg|streit|distanz|eskalation|konflikt.*inszenierung|falschaussage|gutachter.*(täuschen|beeinflussen|manipulieren)|kindeswille.*(vorbereiten|manipulieren)|kind.*aufhetzen|umgang.*(boykott|sabotieren)|prozessbetrug|lügen.*gericht)/i.test(lower)) return `${rot}Explizite Anleitung zu Prozessbetrug, Gutachtertäuschung, Kindeswillensmanipulation oder Umgangssabotage – strafbar als Beihilfe (§§ 153, 235, 27 StGB).`;
  if (/(indirekt|versteckt|strategie|trick|täuschung|entfremdung)/i.test(lower)) return `${rot}Indirekte Strategie gegen das Wechselmodell / Elternentfremdung erkennbar.`;
  return `${rot}Quelle zu Manipulations- oder Sabotagestrategien im Familienrecht (Archiv/Medium/Gericht).`;
}

function kuerzeAuszug(text) {
  const max = 180;
  if (!text) return "Kein Textauszug verfügbar.";
  return text.length > max ? text.trim().substring(0, max) + "…" : text.trim();
}

function addNoCacheHeaders(dom) {
  const head = dom.window.document.head;
  ['Cache-Control', 'Pragma', 'Expires'].forEach((h, i) => {
    let meta = head.querySelector(`meta[http-equiv="${h}"]`);
    if (!meta) {
      meta = dom.window.document.createElement('meta');
      meta.httpEquiv = h;
      meta.content = i === 0 ? 'no-cache, no-store, must-revalidate, max-age=0' : i === 1 ? 'no-cache' : '0';
      head.appendChild(meta);
    }
  });
}

// Strenger Relevanzfilter – Zufall komplett raus, nur harte Keywords
function istStrengRelevant(snippet, url) {
  const lower = (snippet + url).toLowerCase();
  const mustHave = /wechselmodell|doppelresidenz|residenzmodell|gutachter|kindeswille|kindeswohl|aufhetzen|entfremdung|umgang|sabotage|sabotieren|verhindern|prozessbetrug|falschaussage|manipulation|manipulieren|täuschen|boykott|lügen.*gericht|kommunikation.*verweigern/i;
  return mustHave.test(lower);
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
    const ergebnisse = await suche(query, 15);
    for (const item of ergebnisse) {
      const url = item.link?.trim();
      if (!url) continue;

      const snippet = (item.snippet || item.title || '');
      
      // NUR wenn streng relevant → rein
      if (!istStrengRelevant(snippet, url)) continue;

      const grund = bestimmeKritischGrund(snippet + ' ' + (item.title || ''));
      const li = doc.createElement('li');
      li.innerHTML = `${grund} <a href="${url}" target="_blank" rel="noopener">Zur Quelle öffnen</a> Auszug: ${kuerzeAuszug(snippet)}`;

      tempDiv.appendChild(li);
      neueEintraege++;
    }
    await new Promise(r => setTimeout(r, 2800));
  }

  if (neueEintraege > 0) {
    Array.from(tempDiv.children).forEach(li => ul.appendChild(li));
  }

  const gesamtAnzahl = ul.children.length;

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
  if (updated) fs.writeFileSync('bekannte_urls.json', JSON.stringify(bekannteUrls, null, 2));

  doc.querySelectorAll('.additional-sources > p').forEach(p => {
    if (p.innerHTML.includes('quellen-seite') || p.textContent.includes('Weitere Ergebnisse') || p.textContent.includes('Seite ')) {
      p.remove();
    }
  });

  if (gesamtAnzahl > MAX_PER_PAGE) {
    const seite = Math.ceil(gesamtAnzahl / MAX_PER_PAGE);

    for (let s = 2; s <= seite; s++) {
      const seitenStart = (s - 1) * MAX_PER_PAGE;
      const seitenItems = Array.from(ul.children).slice(seitenStart, seitenStart + MAX_PER_PAGE);
      const seitenDatei = s === 2 ? 'quellen-seite-2.html' : `quellen-seite-${s}.html`;
      
      let neueHTML = html.replace(/<title>.*<\/title>/, `<title>Illegale Beratungen – Seite ${s}</title>`);
      const dom2 = new JSDOM(neueHTML);
      const ul2 = dom2.window.document.querySelector('.additional-sources ul');
      ul2.innerHTML = '';
      seitenItems.forEach(li => ul2.appendChild(li.cloneNode(true)));

      dom2.window.document.querySelectorAll('.additional-sources > p').forEach(p => {
        if (p.innerHTML.includes('quellen-seite') || p.textContent.includes('Weitere Ergebnisse') || p.textContent.includes('Seite ')) p.remove();
      });

      const nav = dom2.window.document.createElement('p');
      nav.style.textAlign = 'center';
      nav.style.fontSize = '1.1em';
      nav.style.margin = '40px 0';

      if (s > 1) { const a = dom2.window.document.createElement('a'); a.href = 'index.html'; a.textContent = 'Seite 1'; nav.appendChild(a); nav.appendChild(dom2.window.document.createTextNode(' | ')); }
      if (s > 2) { const a = dom2.window.document.createElement('a'); a.href = `quellen-seite-${s-1}.html`; a.textContent = `Seite ${s-1}`; nav.appendChild(a); nav.appendChild(dom2.window.document.createTextNode(' | ')); }
      const span = dom2.window.document.createElement('span'); span.textContent = `Seite ${s}`; nav.appendChild(span);
      if (s < seite) { nav.appendChild(dom2.window.document.createTextNode(' | ')); const a = dom2.window.document.createElement('a'); a.href = `quellen-seite-${s+1}.html`; a.textContent = `Seite ${s+1}`; nav.appendChild(a); }

      dom2.window.document.querySelector('.additional-sources').appendChild(nav);

      addNoCacheHeaders(dom2);

      const jetzt = new Date();
      const datum = jetzt.toLocaleDateString('de-DE');
      const uhrzeit = jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

      let futureDiv2 = dom2.window.document.querySelector('.future-updates');
      if (!futureDiv2) {
        futureDiv2 = dom2.window.document.createElement('div');
        futureDiv2.className = 'future-updates';
        dom2.window.document.body.appendChild(futureDiv2);
      }

      futureDiv2.innerHTML = `

## Automatische Aktualisierung durch KI

**Letzte Aktualisierung: ${datum} um ${uhrzeit} Uhr – Gesamt: ${gesamtAnzahl} Funde**

Die KI durchsucht täglich Google, Wayback Machine, Gerichtsurteile und Medien.

`;

      fs.writeFileSync(seitenDatei, '\ufeff' + dom2.serialize());
    }

    while (ul.children.length > MAX_PER_PAGE) ul.removeChild(ul.lastChild);

    const mehrLink = doc.createElement('p');
    mehrLink.style.textAlign = 'center';
    mehrLink.style.margin = '50px 0';
    const a = doc.createElement('a');
    a.href = 'quellen-seite-2.html';
    a.innerHTML = `<strong>Weitere Ergebnisse (Seite 2 ff.) – insgesamt ${gesamtAnzahl} Funde</strong>`;
    a.style.fontSize = '1.15em';
    mehrLink.appendChild(a);
    doc.querySelector('.additional-sources').appendChild(mehrLink);
  }

  addNoCacheHeaders(dom);

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

## Automatische Aktualisierung durch KI

**Letzte Aktualisierung: ${datum} um ${uhr} Uhr – ${neueEintraege} neue Funde heute (Gesamt: ${gesamtAnzahl})**

Die KI durchsucht täglich Google, Wayback Machine, Gerichtsurteile und Medien.

`;

  fs.writeFileSync(INDEX_FILE, '\ufeff' + dom.serialize());

  console.log(`extra-search fertig → ${neueEintraege} neue | Gesamt: ${gesamtAnzahl}`);
}

main().catch(console.error);
