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
  if (/(veto|ablehnen.*elternteil|verweigern.*kommunikation)/i.test(lower)) return "Kritisch: Impliziert Kommunikationssabotage als ‚Veto‘ gegen Wechselmodell – fördert Eskalation, Grenze zu § 235 StGB (Entfremdung).";
  if (/(kindeswohl|kindeswohl-argument|wohl des kindes)/i.test(lower)) return "Kritisch: Direkter Rat zur Verhinderung durch ‚Kindeswohl-Argumente‘ – impliziert selektive Darstellung, Grenze zu § 153 StGB.";
  if (/(triftige gründe|abänderung|änderung.*modell)/i.test(lower)) return "Kritisch: Fördert Abänderung durch ‚triftige Gründe‘ – oft Konfliktinszenierung, verletzt Kindeswohl (§ 1666 BGB).";
  if (/(ausweg|streit|distanz|eskalation|konflikt.*inszenierung)/i.test(lower)) return "Kritisch: Explizite ‚Auswege‘ zur Verhinderung durch Streit und Distanz – direkte Anleitung zu Eskalation, strafbar als Beihilfe (§ 27 StGB).";
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
  try { bekannteUrls = JSON.parse(fs.readFileSync('bekannte_urls.json', 'utf8') || '[]'); } catch {}

  let neuGefunden = 0;

  for (const begriff of SUCHBEGRIFFE) {
    const ergebnisse = await suche(begriff, 18);
    for (const item of ergebnisse) {
      const url = item.link?.trim();
      if (!url || bekannteUrls.includes(url) || url.includes('wikipedia.org')) continue;

      const inhalt = await holeInhalt(url);
      if (!inhalt || inhalt.text.length < 150) continue;

      const li = doc.createElement('li');
      li.innerHTML = `
        <div class="critique">${bestimmeKritischGrund(inhalt.text)}</div>
        <strong>${inhalt.title.substring(0, 120)}</strong><br>
        <a href="${url}" target="_blank">Zur Webseite</a>
        <div class="excerpt">Auszug: ${kuerzeAuszug(inhalt.text)}</div>
      `;

      liste.appendChild(li);
      bekannteUrls.push(url);
      neuGefunden++;
      console.log("→ NEU:", inhalt.title.substring(0, 70) + "...");
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  const gesamtAnzahl = liste.children.length;

  doc.querySelectorAll('.additional-sources > p a[href^="quellen-seite"]').forEach(a => a.parentElement?.remove());

  if (gesamtAnzahl > MAX_PER_PAGE) {
    const seite = Math.ceil(gesamtAnzahl / MAX_PER_PAGE);
    const start = (seite - 1) * MAX_PER_PAGE;
    const ueberzaehlige = Array.from(liste.children).slice(start);

    const seitenDatei = seite === 2 ? 'quellen-seite-2.html' : `quellen-seite-${seite}.html`;
    let neueHTML = html.replace(/<title>.*<\/title>/, `<title>Illegale Beratungen – Seite ${seite}</title>`);
    const dom2 = new JSDOM(neueHTML);
    const ul2 = dom2.window.document.querySelector('.additional-sources ul');
    ul2.innerHTML = '';
    ueberzaehlige.forEach(li => ul2.appendChild(li.cloneNode(true)));

    const nav = dom2.window.document.createElement('div');
    nav.style.textAlign = 'center'; nav.style.margin = '50px 0';
    nav.innerHTML = `<p><a href="index.html">← Seite 1</a>${seite > 2 ? ` | <a href="quellen-seite-${seite-1}.html">← Seite ${seite-1}</a>` : ''} | Seite ${seite}</p>`;
    dom2.window.document.querySelector('.additional-sources').appendChild(nav);
    fs.writeFileSync(seitenDatei, '\ufeff' + dom2.serialize());

    while (liste.children.length > MAX_PER_PAGE) liste.removeChild(liste.lastChild);

    const mehrLink = doc.createElement('p');
    mehrLink.style.textAlign = 'center'; mehrLink.style.margin = '50px 0';
    mehrLink.innerHTML = `<a href="quellen-seite-2.html" style="font-size:1.4em;color:#d9534f;font-weight:bold;">
      → Weitere Ergebnisse (Seite 2 ff.) – insgesamt ${gesamtAnzahl} Funde
    </a>`;
    doc.querySelector('.additional-sources').appendChild(mehrLink);
  }

  const jetzt = new Date();
  const datum = jetzt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const uhr = jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  let futureDiv = doc.querySelector('.future-updates');
  if (!futureDiv) { futureDiv = doc.createElement('div'); futureDiv.className = 'future-updates'; doc.body.appendChild(futureDiv); }

  futureDiv.innerHTML = `
    <h2>Automatische Aktualisierung durch KI</h2>
    <p><strong>Letzte Aktualisierung: ${datum} um ${uhr} Uhr – ${neuGefunden} neue Funde heute (Gesamt: ${gesamtAnzahl})</strong></p>
    <p>Die KI durchsucht täglich Google, Wayback Machine, Gerichtsurteile und Medien.</p>
  `;

  fs.writeFileSync('index.html', '\ufeff' + dom.serialize());
  fs.writeFileSync('bekannte_urls.json', JSON.stringify(bekannteUrls, null, 2));

  console.log(`update-search fertig → ${neuGefunden} neue | Gesamt: ${gesamtAnzahl}`);
}

main().catch(console.error);
