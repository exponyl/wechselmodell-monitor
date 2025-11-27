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
  if (/(veto|ablehnen.*elternteil|verweigern.*kommunikation)/i.test(lower)) return `${rot} Impliziert Kommunikationssabotage als ‚Veto' gegen Wechselmodell – fördert Eskalation, Grenze zu § 235 StGB (Entfremdung).`;
  if (/(kindeswohl|kindeswohl-argument|wohl des kindes)/i.test(lower)) return `${rot} Direkter Rat zur Verhinderung durch ‚Kindeswohl-Argumente' – impliziert selektive Darstellung, Grenze zu § 153 StGB.`;
  if (/(triftige gründe|abänderung|änderung.*modell)/i.test(lower)) return `${rot} Fördert Abänderung durch ‚triftige Gründe' – oft Konfliktinszenierung, verletzt Kindeswohl (§ 1666 BGB).`;
  if (/(ausweg|streit|distanz|eskalation|konflikt.*inszenierung)/i.test(lower)) return `${rot} Explizite ‚Auswege' zur Verhinderung durch Streit und Distanz – direkte Anleitung zu Eskalation, strafbar als Beihilfe (§ 27 StGB).`;
  if (/(indirekt|versteckt|strategie|trick)/i.test(lower)) return `${rot} Indirekte Strategie gegen das Wechselmodell erkennbar.`;
  return `${rot} Direkte Anleitung zur Verhinderung des Wechselmodells`;
}

function kuerzeAuszug(text) {
  const max = 180;
  if (!text || text.length <= max) return text || "Kein Auszug verfügbar.";
  return text.slice(0, max).trim() + "…";
}

async function holeInhalt(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0'
      }
    });
    const dom = new JSDOM(data, { url });
    const title = dom.window.document.querySelector('title')?.textContent.trim() || "Kein Titel";
    const bodyText = dom.window.document.body.textContent.replace(/\s+/g, ' ').trim();
    return { title, text: bodyText };
  } catch (err) {
    console.log("Fehler beim Laden von", url, "– wird übersprungen");
    return null;
  }
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
      if (!url || bekannteUrls.includes(url) || url.includes('wikipedia.org')) continue;

      const inhalt = await holeInhalt(url);
      if (!inhalt || inhalt.text.length < 150) continue;

      const kritik = bestimmeKritischGrund(inhalt.text);
      const auszug = kuerzeAuszug(inhalt.text);

      const li = doc.createElement('li');
      li.innerHTML = `${kritik} <a href="${url}" target="_blank" rel="noopener">Zur Webseite</a> Auszug: ${auszug}`;

      liste.appendChild(li);
      bekannteUrls.push(url);
      neuGefunden++;
      console.log("NEU:", inhalt.title.substring(0, 70) + "...");
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  const gesamtAnzahl = liste.children.length;

  doc.querySelectorAll('.additional-sources > p').forEach(p => {
    if (p.innerHTML.includes('quellen-seite') || p.textContent.includes('Weitere Ergebnisse') || p.textContent.includes('Seite ')) {
      p.remove();
    }
  });

  if (gesamtAnzahl > MAX_PER_PAGE) {
    const seite = Math.ceil(gesamtAnzahl / MAX_PER_PAGE);

    for (let s = 2; s <= seite; s++) {
      const seitenStart = (s - 1) * MAX_PER_PAGE;
      const seitenItems = Array.from(liste.children).slice(seitenStart, seitenStart + MAX_PER_PAGE);
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

    while (liste.children.length > MAX_PER_PAGE) liste.removeChild(liste.lastChild);

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
  const uhrzeit = jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  let futureDiv = doc.querySelector('.future-updates');
  if (!futureDiv) {
    futureDiv = doc.createElement('div');
    futureDiv.className = 'future-updates';
    doc.body.appendChild(futureDiv);
  }

  futureDiv.innerHTML = `

## Automatische Aktualisierung durch KI

**Letzte Aktualisierung: ${datum} um ${uhrzeit} Uhr – ${neuGefunden} neue Funde heute (Gesamt: ${gesamtAnzahl})**

Die KI durchsucht täglich Google, Wayback Machine, Gerichtsurteile und Medien.

`;

  fs.writeFileSync('index.html', '\ufeff' + dom.serialize());
  fs.writeFileSync('bekannte_urls.json', JSON.stringify(bekannteUrls, null, 2));

  console.log(`update-search fertig → ${neuGefunden} neue | Gesamt: ${gesamtAnzahl}`);
}

main().catch(console.error);
