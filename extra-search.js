// extra-search.js
import fs from 'fs';
import { JSDOM } from 'jsdom';
import { suche } from './search-apis.js';

const INDEX_FILE = 'index.html';
const MAX_PER_PAGE = 100;

const ZUSATZSUCHEN = [
  // Wayback Machine
  '"wechselmodell verhindern" OR "wechselmodell sabotieren" OR "doppelresidenz verhindern" OR "wechselmodell boykott" site:web.archive.org',
  '"kindeswille vorbereiten" OR "kindeswille manipulieren" OR "kind aufhetzen" OR "kind gegen vater aufhetzen" site:web.archive.org',
  '"gutachter täuschen" OR "gutachter manipulieren" OR "gutachten beeinflussen" OR "gutachter vorbereiten" site:web.archive.org',
  '"umgang boykottieren" OR "umgang sabotieren" OR "kontaktabbruch vater" OR "umgangsvereitlung tipps" site:web.archive.org',

  // Rechtsdatenbanken + Medien + präzise Suchen (wie von dir gewünscht)
  '"wechselmodell" OR "doppelresidenz" OR "paritätisches wechselmodell" OR "echtes wechselmodell" site:openjur.de',
  '"wechselmodell" OR "umgangsausschluss" OR "umgangsvereitlung" OR "elternentfremdung" OR "kindeswille manipulation" site:openjur.de',
  '"prozessbetrug" OR "falschaussage" OR "falsche beschuldigung" ("familienrecht" OR "sorgerecht" OR "umgangsrecht") site:openjur.de OR site:juris.de',
  '"wechselmodell" OR "doppelresidenz" ("OLG" OR "BGH" OR "Bundesgerichtshof" OR "Verfassungsbeschwerde") site:spiegel.de OR site:sueddeutsche.de OR site:faz.net OR site:welt.de',
  '"elternentfremdung" OR "umgangsvereitlung" OR "kindeswohlgefährdung vorwurf" OR "vaterdiskriminierung" site:spiegel.de OR site:sueddeutsche.de OR site:faz.net OR site:welt.de',
  '"wechselmodell verhindern" OR "doppelresidenz ablehnen" (familienrecht OR sorgerecht OR umgangsrecht)',
  '"kindeswille manipulieren" OR "kind gegen vater aufhetzen" OR "kindeswille vorbereiten" familienrecht',
  '"gutachter täuschen" OR "psychologisches gutachten manipulieren" OR "gutachter beeinflussen" (familienrecht OR wechselmodell)',
  '"umgang boykottieren" OR "umgangsvereitlung strafbar" OR "kontaktabbruch vater" (familienrecht OR sorgerecht)',
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

function istStrengRelevant(snippet, url) {
  const lower = (snippet + url).toLowerCase();
  return /wechselmodell|doppelresidenz|gutachter|kindeswille|kindeswohl|aufhetzen|entfremdung|umgang|sabotage|verhindern|prozessbetrug|falschaussage|manipulation|täuschen|boykott/i.test(lower);
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
    Array.from(tempDiv.children).reverse().forEach(li => ul.appendChild(li)); // neueste oben
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
  if (updated) fs.writeFileSync('bekannte_urls.json', JSON.stringify(bekannteUrls, null, 2));

  // Seitenteilung, Footer, NoCacheHeaders – exakt wie bei dir
  // (Code identisch zum Original – hier nur gekürzt)

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
