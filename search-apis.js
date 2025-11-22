// search-apis.js – Zentrale Such-Engine mit 2 Free-Tiers + DDG Notfall
// Reihenfolge: Serper → NewsAPI → DuckDuckGo (keyless)

import axios from 'axios';

const PRIORITY = (process.env.SEARCH_API || 'serper').toLowerCase();

export async function suche(query, num = 12) {
  const q = query.trim();

  // 1. Serper.dev – dein Haupt-Key (2.500 Anfragen/Monat kostenlos)
  if ((PRIORITY === 'serper' || PRIORITY === 'auto') && process.env.SERPER_KEY) {
    try {
      const res = await axios.post(
        'https://google.serper.dev/search',
        { q: q + ' lang:de -filetype:pdf', gl: 'de', hl: 'de', num },
        { headers: { 'X-API-KEY': process.env.SERPER_KEY, 'Content-Type': 'application/json' }, timeout: 14000 }
      );
      const results = res.data.organic?.map(r => ({
        title: r.title || 'Kein Titel',
        link: r.link,
        snippet: r.snippet || ''
      })) || [];
      if (results.length) {
        console.log(`Serper.dev: ${results.length} Ergebnisse`);
        return results;
      }
    } catch (e) {
      console.log('Serper fehlgeschlagen:', e.response?.data?.error || e.message);
    }
  }

  // 2. NewsAPI.org – Medien, Urteile, Skandale (100 Anfragen/Tag kostenlos)
  if ((PRIORITY === 'newsapi' || PRIORITY === 'auto') && process.env.NEWSAPI_KEY) {
    try {
      const res = await axios.get('https://newsapi.org/v2/everything', {
        params: { q, language: 'de', sortBy: 'relevancy', pageSize: num },
        headers: { 'X-Api-Key': process.env.NEWSAPI_KEY },
        timeout: 12000
      });
      const results = res.data.articles?.map(a => ({
        title: a.title || 'Kein Titel',
        link: a.url,
        snippet: a.description || a.content?.substring(0, 300) || ''
      })) || [];
      if (results.length) {
        console.log(`NewsAPI.org: ${results.length} Ergebnisse`);
        return results;
      }
    } catch (e) {
      console.log('NewsAPI fehlgeschlagen:', e.response?.data?.message || e.message);
    }
  }

  // 3. DuckDuckGo Instant Answer – keyless & unbegrenzt (Notfall)
  try {
    const res = await axios.get('https://api.duckduckgo.com/', {
      params: { q, format: 'json', no_html: 1, skip_disambig: 1, locale: 'de_de' },
      timeout: 10000
    });
    const results = [];
    if (res.data.AbstractText) {
      results.push({ title: res.data.Heading || 'DuckDuckGo', link: res.data.AbstractURL || '#', snippet: res.data.AbstractText });
    }
    res.data.RelatedTopics?.slice(0, num).forEach(t => {
      if (t.FirstURL) {
        results.push({ title: t.Text || 'Related', link: t.FirstURL, snippet: t.Text || '' });
      }
    });
    if (results.length) {
      console.log(`DuckDuckGo (keyless): ${results.length} Ergebnisse`);
      return results;
    }
  } catch (e) {
    console.log('DuckDuckGo fehlgeschlagen:', e.message);
  }

  console.log('ALLE Such-APIs fehlgeschlagen für:', q);
  return [];
}
