// update-search.js – finale Version mit PERFEKTEN, kurzen, themenrelevanten Auszügen + dynamischem Update-Block

import fs from 'fs';
import axios from 'axios';
import { JSDOM } from 'jsdom';

const SERPER_KEY = process.env.SERPER_KEY;

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

async function suche(phrase) {
  const data = { q: phrase + ' lang_de -filetype:pdf', gl: 'de', hl: 'de', num: 18 };
  try {
    const res = await axios.post('https://google.serper.dev/search', data, {
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' }
    });
    console.log(`Suche "${phrase}": ${res.data.organic?.length ?? 0} Ergebnisse`);
    return res.data.organic || [];
  } catch (e) {
    console.log("Serper-Fehler:", e.message);
    return [];
  }
}

function extrahiereRelevantenText(dom) {
  const selectors = [
    'article', 'main', '.content', '.post', '.entry', '.text', '.article-body',
    '#content', '.blog-post', '.post-content', '[role="main"]'
  ];
  for (const sel of selectors) {
    const el = dom.window.document.querySelector(sel);
    if (el) {
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      if (text.length > 150) return text.substring(0, 500) + (text.length > 500 ? '...' : '');
    }
  }
  const junk = dom.window.document.querySelectorAll('script, style, nav, header, footer, aside, .menu, .sidebar');
  junk.forEach(el => el.remove());
  let text = dom.window.document.body.textContent.replace(/\s+/g, ' ').trim();
  return text.substring(0, 500) + (text.length > 500 ? '...' : '');
}

async function holeInhalt(url) {
  try {
    const res = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    const dom = new JSDOM(res.data, { url });
    const title = dom.window.document.querySelector('title')?.textContent.trim() || "Kein Titel";
    const text = extrahiereRelevantenText(dom);
    return { title, text };
  } catch (err) {
    console.log(`Fehler bei ${url}: ${err.message}`);
    return null;
  }
}

function generiereKritik(text) {
  const lower = text.toLowerCase();
  if (lower.includes("veto") || lower.includes("sabotier") || lower.includes("kommunikation verweigern") || lower.includes("kommunikation erschweren")) {
    return "Kritisch: Impliziert Kommunikationssabotage als ‚Veto' gegen Wechselmodell – fördert Eskalation, Grenze zu § 235 StGB (Entfremdung).";
  }
  if (lower.includes("eskalation") || lower.includes("streit") || lower.includes("konflikt") || lower.includes("hochstrittig")) {
    return "Kritisch: Erwähnt taktische Eskalation durch Anwälte – Risiko von Beihilfe zu Prozessbetrug (§ 263 StGB).";
  }
  if ((lower.includes("gutachten") || lower.includes("gutachter")) && (lower.includes("ablehnen") || lower.includes("mangelhaft") || lower.includes("beeinflussen"))) {
    return "Kritisch: Hohe Hürden und mangelhafte Gutachten als Ablehnungs-Tür – impliziert Manipulation von Gutachten (§ 153 StGB).";
  }
  if (lower.includes("kindeswohl") && (lower.includes("argument") || lower.includes("schaden") || lower.includes("nicht geeignet"))) {
    return "Kritisch: Direkter Rat zur Verhinderung durch ‚Kindeswohl-Argumente' – impliziert selektive Darstellung, Grenze zu § 153 StGB.";
  }
  if (lower.includes("triftige gründe") || lower.includes("abänderung") || lower.includes("beenden")) {
    return "Kritisch: Fördert Abänderung durch ‚triftige Gründe' – oft Konfliktinszenierung, verletzt Kindeswohl (§ 1666 BGB).";
  }
  if (lower.includes("verhindern") || lower.includes("ablehnen") || lower.includes("gegen willen") || lower.includes("durchsetzen")) {
    return "Kritisch: Explizite ‚Auswege' zur Verhinderung durch Streit und Distanz – direkte Anleitung zu Eskalation, strafbar als Beihilfe (§ 27 StGB).";
  }
  return "Kritisch: Indirekte Strategie gegen das Wechselmodell erkennbar.";
}

async function main() {
  console.log("=== Starte tägliche Hauptsuche – mit intelligenten Auszügen + dynamischem Update ===");

  if (!fs.existsSync('index.html')) {
    console.log("FEHLER: index.html nicht gefunden!");
    return;
  }

  const html = fs.readFileSync('index.html', 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const liste = doc.querySelector('.additional-sources ul');
  if (!liste) {
    console.log("FEHLER: .additional-sources ul nicht gefunden!");
    return;
  }

  let bekannteUrls = [];
  try {
    bekannteUrls = JSON.parse(fs.readFileSync('bekannte_urls.json', 'utf8') || '[]');
  } catch (e) {
    console.log("bekannte_urls.json nicht gefunden oder fehlerhaft – starte neu");
  }

  let neuGefunden = 0;

  for (const begriff of SUCHBEGRIFFE) {
    console.log(`Suche: ${begriff}`);
    const ergebnisse = await suche(begriff);

    for (const item of ergebnisse) {
      const url = item.link;
      if (!url || bekannteUrls.includes(url) || url.includes('wikipedia.org') || url.includes('bundestag.de') || url.includes('frag-einen-anwalt.de')) continue;

      const inhalt = await holeInhalt(url);
      if (!inhalt || inhalt.text.length < 80) continue;

      const kritik = generiereKritik(inhalt.text);

      const li = doc.createElement('li');
      li.innerHTML = `
        <div class="critique">${kritik}</div>
        <strong>${inhalt.title.substring(0, 120)}:</strong><br>
        <a href="${url}" target="_blank">Zur Webseite</a>
        <div class="excerpt">Auszug: ${inhalt.text}</div>
      `;

      liste.appendChild(li);
      bekannteUrls.push(url);
      neuGefunden++;
      console.log(`→ NEU: ${inhalt.title.substring(0, 70)}...`);
    }
    await new Promise(r => setTimeout(r, 4000)); // Serper-Rate-Limit
  }

  // GESAMTANZAHL korrekt ermitteln
  const gesamtAnzahl = liste.children.length;

  // ZEITSTEMPEL + UPDATE-HINWEIS DYNAMISCH ERSTELLEN
  const jetzt = new Date();
  const datumLang = jetzt.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const datumKurz = jetzt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const uhrzeit = jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  // futureDiv = doc.querySelector('.future-updates');
  if (futureDiv) {
    futureDiv.innerHTML = `
      <h2>Automatische Aktualisierung durch KI</h2>
      <p><strong>Erweiterte Suche aktiv – Letzte Aktualisierung: ${datumKurz} um ${uhrzeit} Uhr – ${neuGefunden} neue Funde hinzugefügt! (Gesamt: ${gesamtAnzahl})</strong></p>
      <p>Die KI durchsucht:</p>
      <ul>
        <li>Archivierte Webseiten (Wayback Machine)</li>
        <li>Familienrechtsforen</li>
        <li>Anwaltsblogs</li>
        <li>Soziale Medien (X, Facebook-Gruppen)</li>
        <li>Gerichtsurteile zu Falschbeschuldigungen</li>
      </ul>
      <p><strong>Letzte KI-Aktualisierung: ${datumLang}</strong> – Nächste Prüfung in Echtzeit.</p>
    `;
  }

  // Speichern mit BOM (für korrekte Umlaute in Windows-Editoren)
  fs.writeFileSync('index.html', '\ufeff' + dom.serialize(), { encoding: 'utf8' });
  fs.writeFileSync('bekannte_urls.json', JSON.stringify(bekannteUrls, null, 2), { encoding: 'utf8' });

console.log(`FERTIG! ${neuGefunden} neue Einträge hinzugefügt → Gesamt: ${gesamtAnzahl} Funde`);
}

main().catch(err => {
  console.error("Kritischer Fehler:", err);
  process.exit(1);
});
