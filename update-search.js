// update-search.js – finale Version mit korrektem UTF-8 (BOM) → keine "V�ternotruf" mehr!
// Läuft perfekt mit "type": "module" in package.json

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
  const data = {
    q: phrase + ' lang_de -filetype:pdf',
    gl: 'de',
    hl: 'de',
    num: 18
  };

  try {
    const res = await axios.post('https://google.serper.dev/search', data, {
      headers: {
        'X-API-KEY': SERPER_KEY,
        'Content-Type': 'application/json'
      }
    });
    console.log(`Suche "${phrase}": ${res.data.organic?.length ?? 0} Ergebnisse`);
    return res.data.organic || [];
  } catch (e) {
    console.log("Serper-Fehler:", e.message);
    return [];
  }
}

async function holeInhalt(url) {
  try {
    const res = await axios.get(url, { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const dom = new JSDOM(res.data);
    const text = dom.window.document.body.textContent.replace(/\s+/g, ' ').substring(0, 1400);
    const title = dom.window.document.querySelector('title')?.textContent.trim() || "Kein Titel";
    return { title, text };
  } catch (err) {
    console.log(`Fehler beim Laden von ${url}: ${err.message}`);
    return null;
  }
}

function generiereKritik(text) {
  const lower = text.toLowerCase();

  if (lower.includes("veto") || lower.includes("sabotier") || lower.includes("kommunikation verweigern") || lower.includes("kommunikation erschweren") || lower.includes("kooperation verweigern")) {
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
  if (lower.includes("triftige gründe") || lower.includes("abänderung") || lower.includes("beenden") || lower.includes("zurücknehmen")) {
    return "Kritisch: Fördert Abänderung durch ‚triftige Gründe' – oft Konfliktinszenierung, verletzt Kindeswohl (§ 1666 BGB).";
  }
  if (lower.includes("verhindern") || lower.includes("ablehnen") || lower.includes("gegen willen") || lower.includes("durchsetzen")) {
    return "Kritisch: Explizite ‚Auswege' zur Verhinderung durch Streit und Distanz – direkte Anleitung zu Eskalation, strafbar als Beihilfe (§ 27 StGB).";
  }
  return "Kritisch: Indirekte Strategie gegen das Wechselmodell erkennbar.";
}

async function main() {
  console.log("=== Starte tägliche automatische Suche (UTF-8 fixiert) ===");

  const html = fs.readFileSync('index.html', 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const liste = doc.querySelector('.additional-sources ul');
  if (!liste) {
    console.log("FEHLER: .additional-sources ul nicht gefunden!");
    return;
  }

  let bekannt = [];
  try {
    const data = fs.readFileSync('bekannte_urls.json', 'utf8');
    bekannt = JSON.parse(data);
  } catch (e) {
    bekannt = [];
  }

  let neuGefunden = 0;

  for (const begriff of SUCHBEGRIFFE) {
    console.log(`Suche: ${begriff}`);
    const ergebnisse = await suche(begriff);

    for (const item of ergebnisse) {
      const url = item.link;
      if (!url || bekannt.includes(url) || url.includes('wikipedia.org') || url.includes('bundestag.de') || url.includes('frag-einen-anwalt.de')) continue;

      const inhalt = await holeInhalt(url);
      if (!inhalt) continue;

      const kritik = generiereKritik(inhalt.text);

      const li = doc.createElement('li');
      li.innerHTML = `
        <div class="critique">${kritik}</div>
        <strong>${inhalt.title.substring(0, 120)}:</strong>
        <a href="${url}" target="_blank">Zur Webseite</a>
        <div class="excerpt">Auszug: ${inhalt.text.substring(0, 450)}...</div>
      `;

      liste.appendChild(li);
      bekannt.push(url);
      neuGefunden++;
      console.log(`NEU: ${inhalt.title.substring(0, 70)}...`);
    }
    await new Promise(r => setTimeout(r, 4000));
  }

  // Datum aktualisieren
  const jetzt = new Date().toLocaleString('de-DE', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const datumP = doc.querySelector('.future-updates p');
  if (datumP) {
    datumP.innerHTML = `<strong>Letzte automatische Aktualisierung: ${jetzt} – ${neuGefunden} neue Funde hinzugefügt!</strong>`;
  }

  // WICHTIG: UTF-8 + BOM → keine kaputten Umlaute mehr!
  fs.writeFileSync('index.html', '\ufeff' + dom.serialize(), { encoding: 'utf8' });
  fs.writeFileSync('bekannte_urls.json', JSON.stringify(bekannt, null, 2), { encoding: 'utf8' });

  console.log(`=== Fertig! ${neuGefunden} neue Einträge hinzugefügt – Umlaute 100% korrekt ===`);
}

main().catch(err => {
  console.error("Kritischer Fehler:", err);
  process.exit(1);
});
