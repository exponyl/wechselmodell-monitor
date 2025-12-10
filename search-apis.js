// search-apis.js
import axios from 'axios';

const SERPER_URL = 'https://google.serper.dev/search';
const TAVILY_URL = 'https://api.tavily.com/search';

/**
 * Haupt-Suchfunktion – wird von update-search.js und extra-search.js verwendet
 * @param {string} query       Suchanfrage
 * @param {number} maxResults  Maximale Anzahl Ergebnisse (Standard: 15)
 * @returns {Array<{title:string, link:string, snippet:string}>}
 */
export async function suche(query, maxResults = 15) {
  let results = [];

  // ------------------------------------------------------------------
  // 1. Serper versuchen (schnell & gut für normale Google-Suchen)
  // ------------------------------------------------------------------
  if (process.env.SERPER_KEY) {
    try {
      const res = await axios.post(
        SERPER_URL,
        {
          q: query,
          num: maxResults,
          gl: 'de',
          hl: 'de'
        },
        {
          headers: {
            'X-API-KEY': process.env.SERPER_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        }
      );

      if (res.data?.organic?.length > 0) {
        results = res.data.organic.map(item => ({
          title: item.title || 'Kein Titel',
          link: item.link,
          snippet: item.snippet || ''
        }));
        console.log(`Serper: ${results.length} Treffer für "${query.substring(0, 50)}..."`);
        return results.slice(0, maxResults);
      }
    } catch (error) {
      console.log(`Serper fehlgeschlagen: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------
  // 2. Tavily als starker Fallback (besonders für web.archive.org & komplexe Queries)
  // ------------------------------------------------------------------
  if (process.env.TAVILY_API_KEY) {
    try {
      const res = await axios.post(
        TAVILY_URL,
        {
          api_key: process.env.TAVILY_API_KEY,
          query: query,
          search_depth: 'advanced',
          max_results: maxResults
        },
        { timeout: 30000 }
      );

      if (res.data?.results?.length > 0) {
        const tavilyResults = res.data.results.map(item => ({
          title: item.title || 'Kein Titel',
          link: item.url,
          snippet: item.content || item.snippet || ''
        }));

        // Duplikate vermeiden
        for (const item of tavilyResults) {
          if (!results.some(r => r.link === item.link)) {
            results.push(item);
          }
        }
        console.log(`Tavily: ${tavilyResults.length} Treffer (Fallback)`);
      }
    } catch (error) {
      console.log(`Tavily fehlgeschlagen: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------
  // Finales Ergebnis zurückgeben
  // ------------------------------------------------------------------
  if (results.length === 0) {
    console.log(`Keine Ergebnisse von Serper oder Tavily für: ${query}`);
  }

  return results.slice(0, maxResults);
}
