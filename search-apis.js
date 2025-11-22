// search-apis.js – 100% kostenlos, 3 starke APIs mit automatischer Fallback-Kette
// Reihenfolge: Serper → SearchAPI → NewsAPI → (Notfall: DDG ohne Key)

import axios from 'axios';

const API = (process.env.SEARCH_API || 'serper').toLowerCase();

export async function suche(query, num = 12) {
  const cleanQuery = query.trim();

  // 1. Serper.dev – dein bewährter Haupt-Key (2.500/Monat)
  if ((API === 'serper' || !process.env.SERPER_KEY) && process.env.SERPER_KEY) {
    try {
      const res = await axios.post('https://google.serper.dev/search', {
        q: cleanQuery + ' lang:de -filetype:pdf',
        gl: 'de', hl: 'de', num
      }, {
        headers: { 'X-API-KEY': process.env.SERPER_KEY, 'Content-Type': 'application/json' },
        timeout: 14000
      });
      const results = res.data.organic?.map(r => ({
        title: r.title || 'Kein Titel',
        link: r.link,
        snippet: r.snippet || ''
      })) || [];
      if (results.length) {
        console.log(`Serper erfolgreich → ${results.length} Ergebnisse`);
        return results;
      }
    } catch (e) {
      console.log('Serper fehlgeschlagen:', e.response?.data || e.message);
    }
  }

  // 2. SearchAPI.io – echte Google-SERP (100/Tag)
  if ((API === 'searchapi' || API === 'serper') && process.env.SEARCHAPI_KEY) {
    try {
      const res = await axios.get('https://www.searchapi.io/api/v1/search', {
        params: {
          engine: 'google',
          q: cleanQuery,
          num: num,
          hl: 'de',
          gl: 'de'
        },
        headers: { Authorization: `Bearer ${process.env.SEARCHAPI_KEY}` },
        timeout: 14000
      });
      const results = res.data.organic_results?.map(r => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet || ''
      })) || [];
      if (results.length) {
        console.log(`SearchAPI.io erfolgreich → ${results.length} Ergebnisse`);
        return results;
      }
    } catch (e) {
      console.log('SearchAPI.io fehlgeschlagen:', e.response?.data?.error || e.message);
    }
  }

  // 3. NewsAPI.org – stark bei Medien, Gerichten, Skandalen (100/Tag)
  if ((API === 'newsapi' || API === 'serper') && process.env.NEWSAPI_KEY) {
    try {
      const res = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: cleanQuery,
          language: 'de',
          sortBy: 'relevancy',
          pageSize: num
        },
        headers: { 'X-Api-Key': process.env.NEWSAPI_KEY },
        timeout: 12000
      });
      const results = res.data.articles?.map(a => ({
        title: a.title || 'Kein Titel',
        link: a.url,
        snippet: a.description || a.content?.substring(0, 200) || ''
      })) || [];
      if (results.length) {
        console.log(`NewsAPI erfolgreich → ${results.length} Ergebnisse`);
        return results;
      }
    } catch (e) {
      console.log('NewsAPI fehlgeschlagen:', e.response?.data?.message || e.message);
    }
  }

  // 4. Notfall: DuckDuckGo Instant Answer (unbegrenzt, kein Key!)
  try {
    const res = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: cleanQuery,
        format: 'json',
        no_html: 1,
        skip_disambig: 1,
        locale: 'de_de'
      },
      timeout: 10000
    });
    const results = [];
    if (res.data.AbstractText) {
      results.push({
        title: res.data.Heading || 'DuckDuckGo',
        link: res.data.AbstractURL || '#',
        snippet: res.data.AbstractText
      });
    }
    res.data.RelatedTopics?.slice(0, num - results.length).forEach(t => {
      if (t.FirstURL) {
        results.push({
          title: t.Text || 'Related',
          link: t.FirstURL,
          snippet: t.Text || ''
        });
      }
    });
    if (results.length) {
      console.log(`DDG Notfall-Suche erfolgreich → ${results.length} Ergebnisse`);
      return results;
    }
  } catch (e) {
    console.log('DDG Notfall fehlgeschlagen:', e.message);
  }

  console.log('Alle Such-APIs fehlgeschlagen für:', cleanQuery);
  return [];
}
