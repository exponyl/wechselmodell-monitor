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
  // ... (unverändert)
}

function kuerzeAuszug(text) {
  // ... (unverändert)
}

function addNoCacheHeaders(dom) {
  // ... (unverändert)
}

async function main() {
  // ... (der ganze Anfang bis zum Erzeugen der Einträge bleibt gleich)

  const gesamtAnzahl = ul.children.length;

  // Robuster Remove
  doc.querySelectorAll('.additional-sources > p').forEach(p => {
    if (p.querySelector('a[href^="quellen-seite"]') || p.textContent.includes('Weitere Ergebnisse') || p.textContent.includes('Seite ')) {
      p.remove();
    }
  });

  if (gesamtAnzahl > MAX_PER_PAGE) {
    const seite = Math.ceil(gesamtAnzahl / MAX_PER_PAGE);

    for (let s = 2; s <= seite; s++) {
      // ... (der Copy-Teil bleibt gleich)

      // auch hier alter Remove
      dom2.window.document.querySelectorAll('.additional-sources > p').forEach(p => {
        if (p.querySelector('a[href^="quellen-seite"]') || p.textContent.includes('Weitere Ergebnisse') || p.textContent.includes('Seite ')) p.remove();
      });

      // ECHTE Navigation
      const nav = dom2.window.document.createElement('p');
      nav.style.textAlign = 'center';
      nav.style.fontSize = '1.1em';
      nav.style.margin = '40px 0';

      if (s > 1) { const a = dom2.window.document.createElement('a'); a.href = 'index.html'; a.textContent = 'Seite 1'; nav.appendChild(a); nav.appendChild(dom2.window.document.createTextNode(' | ')); }
      if (s > 2) { const a = dom2.window.document.createElement('a'); a.href = `quellen-seite-${s-1}.html`; a.textContent = `Seite ${s-1}`; nav.appendChild(a); nav.appendChild(dom2.window.document.createTextNode(' | ')); }
      const aktuell = dom2.window.document.createElement('span'); aktuell.textContent = `Seite ${s}`; nav.appendChild(aktuell);
      if (s < seite) { const a = dom2.window.document.createElement('a'); a.href = `quellen-seite-${s+1}.html`; a.textContent = ` Seite ${s+1}`; nav.appendChild(a); }

      dom2.window.document.querySelector('.additional-sources').appendChild(nav);

      // ... (Rest wie oben, Timestamp etc.)
    }

    // ECHTER „Weitere Ergebnisse“-Link auf index.html
    const mehrLink = doc.createElement('p');
    mehrLink.style.textAlign = 'center';
    mehrLink.style.margin = '50px 0';
    const a = doc.createElement('a');
    a.href = 'quellen-seite-2.html';
    a.textContent = `Weitere Ergebnisse (Seite 2 ff.) – insgesamt ${gesamtAnzahl} Funde`;
    a.style.fontSize = '1.1em';
    mehrLink.appendChild(a);
    doc.querySelector('.additional-sources').appendChild(mehrLink);
  }

  // ... (Cache-Headers + Timestamp unverändert)
}

main().catch(console.error);
