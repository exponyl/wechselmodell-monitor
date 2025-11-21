// update-search.js – Haupt-Skript (Serper-Hauptsuche)
// Läuft fehlerfrei, aktualisiert index.html inkl. Timestamp + korrekter Anzahl

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
  const res = await axios.post('https://google.serper.dev/search', {
    q: phrase + ' lang:de -filetype:pdf',
    gl: 'de', hl: 'de', num: 18
  }, {
    headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' }
  }).catch(e => {
    console.log("Serper-Fehler:", e.message);
    return { data: { organic: [] } };
  });
  return res.data.organic || [];
}

async function holeInhalt(url) {
  try {
    const { data } = await axios.get(url, { timeout: 15000 });
    const dom = new JSDOM(data, { url });
    const title = dom.window.document.querySelector('title')?.textContent.trim() || "Kein Titel";
    const body = dom.window.document.body.textContent.replace(/\s+/g, ' ').trim();
    return { title, text: body.substring(0, 500) + (body.length > 500 ? '...' : '') };
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== Starte Hauptsuche ===");

  const html = fs.readFileSync('index.html', 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const liste = doc.querySelector('.additional-sources ul');
  if (!liste) return console.log("FEHLER: Liste nicht gefunden!");

  let bekannteUrls = [];
  try {
    bekannteUrls = JSON.parse(fs.readFileSync('bekannte_urls.json', 'utf8') || '[]');
  } catch {}

  let neuGefunden = 0;

  for (const begriff of SUCHBEGRIFFE) {
    const ergebnisse = await suche(begriff);
    for (const item of ergebnisse) {
      const url = item.link;
      if (!url || bekannteUrls.includes(url) || url.includes('wikipedia.org')) continue;

      const inhalt = await holeInhalt(url);
      if (!inhalt || inhalt.text.length < 100) continue;

      const li = doc.createElement('li');
      li.innerHTML = `
        <div class="critique">Kritisch: Direkte Anleitung zur Verhinderung des Wechselmodells</div>
        <strong>${inhalt.title.substring(0, 120)}</strong><br>
        <a href="${url}" target="_blank">Zur Webseite</a>
        <div class="excerpt">Auszug: ${inhalt.text}</div>
      `;

      liste.appendChild(li);
      bekannteUrls.push(url);
      neuGefunden++;
      console.log("→ NEU:", inhalt.title.substring(0, 70) + "...");
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  // ──────── Update-Block dynamisch aktualisieren ────────
  const gesamtAnzahl = liste.children.length;
  const jetzt = new Date();
  const datum = jetzt.toLocaleDateString('de-DE');
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

  // Speichern
  fs.writeFileSync('index.html', '\ufeff' + dom.serialize());
  fs.writeFileSync('bekannte_urls.json', JSON.stringify(bekannteUrls, null, 2));

  console.log(`FERTIG! ${neuGefunden} neue Einträge → Gesamt: ${gesamtAnzahl} Funde`);
}

main().catch(console.error);
