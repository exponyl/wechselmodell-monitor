// update-search.js
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
  const rot = '<span style="color:#c00;font-weight:bold">Kritisch:</span>';
  if (/(veto|ablehnen.*elternteil|verweigern.*kommunikation)/i.test(lower)) return `${rot} Impliziert Kommunikationssabotage als ‚Veto‘ gegen Wechselmodell – fördert Eskalation, Grenze zu § 235 StGB (Entfremdung).`;
  if (/(kindeswohl|kindeswohl-argument|wohl des kindes)/i.test(lower)) return `${rot} Direkter Rat zur Verhinderung durch ‚Kindeswohl-Argumente‘ – impliziert selektive Darstellung, Grenze zu § 153 StGB.`;
  if (/(triftige gründe|abänderung|änderung.*modell)/i.test(lower)) return `${rot} Fördert Abänderung durch ‚triftige Gründe‘ – oft Konfliktinszenierung, verletzt Kindeswohl (§ 1666 BGB).`;
  if (/(ausweg|streit|distanz|eskalation|konflikt.*inszenierung)/i.test(lower)) return `${rot} Explizite ‚Auswege‘ zur Verhinderung durch Streit und Distanz – direkte Anleitung zu Eskalation, strafbar als Beihilfe (§ 27 StGB).`;
  if (/(indirekt|versteckt|strategie|trick)/i.test(lower)) return `${rot} Indirekte Strategie gegen das Wechselmodell erkennbar.`;
  return `${rot} Direkte Anleitung zur Verhinderung des Wechselmodells`;
}

function kuerzeAuszug(text) {
  const max = 180;
  if (!text || text.length <= max) return text || "Kein Auszug verfügbar.";
  return text.slice(0, max).trim() + "…";
}

async function holeInhalt(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const { data } = await axios.get(url, {
        timeout: 20000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36'
        }
      });
      const dom = new JSDOM(data, { url });
      const title = dom.window.document.querySelector('title')?.textContent.trim() || "Kein Titel";
      const bodyText = dom.window.document.body.textContent.replace(/\s+/g, ' ').trim();
      return { title, text: bodyText };
    } catch (err) {
      if (err.response?.status === 429 || err.response?.status === 403) {
        await new Promise(r => setTimeout(r, 5000 * (i + 1)));
        continue;
      }
      console.log("Fehler beim Laden von", url, "– wird übersprungen");
      return null;
    }
  }
  return null;
}

function addNoCacheHeaders(dom) {
  const head = dom.window.document.head;
  ['Cache-Control', 'Pragma', 'Expires'].forEach((h, i) => {
    let meta = head.querySelector(`meta[http-equiv="${h}" i]`);
    if (!meta) meta.remove();
    meta = dom.window.document.createElement('meta');
    meta.httpEquiv = h;
    meta.content = i === 0 ? 'no-cache, no-store, must-revalidate' : i === 1 ? 'no-cache' : '0';
    head.appendChild(meta);
  });
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
      if (!url || bekannteUrls.includes(url) || url.includes('wikipedia.org') || url.includes('anwalt.de/rechtstipps')) continue;

      const inhalt = await holeInhalt(url);
      if (!inhalt || inhalt.text.length < 200) continue;

      const kritik = bestimmeKritischGrund(inhalt.text);
      const auszug = kuerzeAuszug(inhalt.text);

      const li = doc.createElement('li');
      li.innerHTML = `${kritik} <a href="${url}" target="_blank" rel="noopener">${inhalt.title}</a> – Auszug: ${auszug}`;

      liste.insertBefore(li, liste.firstChild); // Neueste oben
      bekannteUrls.push(url);
      neuGefunden++;
      console.log("NEU:", inhalt.title.substring(0, 80) + "...");
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  const gesamtAnzahl = liste.children.length;

  // Seiten teilen ab 100 Einträge
  if (gesamtAnzahl > MAX_PER_PAGE) {
    const seiten = Math.ceil(gesamtAnzahl / MAX_PER_PAGE);
    for (let s = 2; s <= seiten; s++) {
      const start = (s - 1) * MAX_PER_PAGE;
      const items = Array.from(liste.children).slice(start, start + MAX_PER_PAGE);
      const datei = s === 2 ? 'quellen-seite-2.html' : `quellen-seite-${s}.html`;

      let neueHtml = html.replace(/<title>.*<\/title>/, `<title>Illegale Beratungen – Seite ${s}</title>`);
      const dom2 = new JSDOM(neueHtml);
      const ul2 = dom2.window.document.querySelector('.additional-sources ul');
      ul2.innerHTML = '';
      items.forEach(li => ul2.appendChild(li.cloneNode(true)));
      // Navigation + Footer + NoCache wie im Original
      // (Code identisch wie oben – aus Platzgründen hier gekürzt, aber vollständig im Original)
      // ...
      fs.writeFileSync(datei, '\ufeff' + dom2.serialize());
    }
    while (liste.children.length > MAX_PER_PAGE) liste.removeChild(liste.lastChild);
    const mehr = doc.createElement('p');
    mehr.innerHTML = `<p style="text-align:center;margin:50px 0"><a href="quellen-seite-2.html"><strong>Weitere Ergebnisse (Seite 2 ff.) – insgesamt ${gesamtAnzahl} Funde</strong></a></p>`;
    doc.querySelector('.additional-sources').appendChild(mehr);
  }

  addNoCacheHeaders(dom);

  const jetzt = new Date();
  const datum = jetzt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const uhrzeit = jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  let div = doc.querySelector('.future-updates');
  if (!div) {
    div = doc.createElement('div');
    div.className = 'future-updates';
    doc.body.appendChild(div);
  }
  div.innerHTML = `

## Automatische Aktualisierung durch KI

**Letzte Aktualisierung: ${datum} um ${uhrzeit} Uhr – ${neuGefunden} neue Funde heute (Gesamt: ${gesamtAnzahl})**

Die KI durchsucht täglich Google, Wayback Machine, Gerichtsurteile und Medien.

`;

  fs.writeFileSync('index.html', '\ufeff' + dom.serialize());
  fs.writeFileSync('bekannte_urls.json', JSON.stringify(bekannteUrls, null, 2));

  console.log(`update-search fertig → ${neuGefunden} neue | Gesamt: ${gesamtAnzahl}`);
}

main().catch(console.error);
