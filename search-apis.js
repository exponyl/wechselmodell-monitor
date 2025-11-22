// search-apis.js – zentrale, austauschbare Such-Engine mit Fallback
// Einfach API="serper" oder "googlesearch" oder "brave" oder "tavily" in .env setzen

import axios from 'axios';

const API = process.env.SEARCH_API || 'serper';           // Standard: serper
const SERPER_KEY   = process.env.SERPER_KEY;
const GOOGLE_KEY    = process.env.GOOGLE_CX_KEY;           // für googlesearch
const GOOGLE_CX     = process.env.GOOGLE_CX_ID;
const BRAVE_KEY     = process.env.BRAVE_SEARCH_KEY;
const TAVILY_KEY    = process.env.TAVILY_API_KEY;

export async function googleSuche(query, num = 12) {
  const apis = [];

  // 1. Serper.dev (aktuell dein Haupt-API, günstig + schnell)
  if (API === 'serper' && SERPER_KEY) {
    apis.push(async () => {
      const res = await axios.post('https://google.serper.dev/search', { q: query, gl: 'de', hl: 'de', num }, {
        headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
        timeout: 12000
      });
      return res.data.organic?.map(r => ({ title: r.title, link: r.link, snippet: r.snippet })) || [];
    });
  }

  // 2. Offizielle Google Custom Search JSON API (sehr stabil, aber 100 Anfragen/Tag kostenlos)
  if ((API === 'googlesearch' || !SERPER_KEY) && GOOGLE_KEY && GOOGLE_CX) {
    apis.push(async () => {
      const res = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: { key: GOOGLE_KEY, cx: GOOGLE_CX, q: query, num: num, gl: 'de' },
        timeout: 12000
      });
      return res.data.items?.map(i => ({ title: i.title, link: i.link, snippet: i.snippet })) || [];
    });
  }

  // 3. Brave Search (kostenlos 10.000 Anfragen/Monat, sehr gut für DE)
  if ((API === 'brave' || !SERPER_KEY) && BRAVE_KEY) {
    apis.push(async () => {
      const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        params: { q: query, count: num, country: 'de', search_lang: 'de' },
        headers: { 'X-Subscription-Token': BRAVE_KEY },
        timeout: 12000
      });
      return res.data.web?.results?.map(r => ({ title: r.title, link: r.url, snippet: r.description })) || [];
    });
  }

  // 4. Tavily (KI-basiert, super Ergebnisse, 1000 Anfragen kostenlos)
  if ((API === 'tavily' || !SERPER_KEY) && TAVILY_KEY) {
    apis.push(async () => {
      const res = await axios.post('https://api.tavily.com/search', {
        api_key: TAVILY_KEY,
        query: query,
        search_depth: "advanced",
        include_answer: false,
        include_images: false,
        include_raw_content: false,
        max_results: num
      }, { timeout: 15000 });
      return res.data.results?.map(r => ({ title: r.title, link: r.url, snippet: r.content })) || [];
    });
  }

  // Fallback-Kette: versuche nacheinander, bis eine funktioniert
  for (const tryApi of apis) {
    try {
      const results = await tryApi();
      if (results && results.length > 0) {
        console.log(`Suche erfolgreich mit ${tryApi.name || API}`);
        return results;
      }
    } catch (e) {
      console.log(`API ${tryApi.name || API} fehlgeschlagen:`, e.message);
    }
  }

  console.log("Alle Such-APIs fehlgeschlagen – gebe leere Liste zurück");
  return [];
}
