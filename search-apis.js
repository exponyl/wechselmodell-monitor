// search-apis.js  ← diese Datei kommt neu ins Repo (öffentlich, kein Problem!)

import axios from 'axios';

const API = process.env.SEARCH_API || 'brave';  // ← kommt aus GitHub Secret!

export async function suche(query, num = 12) {
  const results = [];

  // 1. Brave Search (kostenlos & top für deutsche Ergebnisse)
  if ((API === 'brave' || !results.length) && process.env.BRAVE_SEARCH_KEY) {
    try {
      const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        params: { q: query, count: num, country: 'de', search_lang: 'de' },
        headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_KEY },
        timeout: 12000
      });
      const mapped = res.data.web?.results?.map(r => ({
        title: r.title,
        link: r.url,
        snippet: r.description || ''
      })) || [];
      if (mapped.length) return mapped;
    } catch (e) { console.log('Brave failed:', e.message); }
  }

  // 2. Serper.dev (dein bisheriger)
  if ((API === 'serper' || !results.length) && process.env.SERPER_KEY) {
    try {
      const res = await axios.post('https://google.serper.dev/search', {
        q: query, gl: 'de', hl: 'de', num
      }, {
        headers: { 'X-API-KEY': process.env.SERPER_KEY, 'Content-Type': 'application/json' },
        timeout: 12000
      });
      const mapped = res.data.organic?.map(r => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet || ''
      })) || [];
      if (mapped.length) return mapped;
    } catch (e) { console.log('Serper failed:', e.message); }
  }

  // 3. Tavily (optional)
  if ((API === 'tavily' || !results.length) && process.env.TAVILY_API_KEY) {
    try {
      const res = await axios.post('https://api.tavily.com/search', {
        api_key: process.env.TAVILY_API_KEY,
        query, max_results: num, search_depth: "advanced"
      });
      const mapped = res.data.results?.map(r => ({
        title: r.title,
        link: r.url,
        snippet: r.content || ''
      })) || [];
      if (mapped.length) return mapped;
    } catch (e) { console.log('Tavily failed:', e.message); }
  }

  return []; // alles kaputt → leere Liste
}
