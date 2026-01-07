// search-apis.js
import axios from 'axios';

const DDG_URL = 'https://api.duckduckgo.com/';
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
  // 1. DuckDuckGo versuchen (kostenlos, kein Key, gut für Instant Answers und Related Topics)
  // ------------------------------------------------------------------
  try {
    const res = await axios.get(
      `${DDG_URL}?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`,
      {
        timeout: 20000,
        params: {
          kl: 'de-de'  // Für deutsche Ergebnisse
        }
      }
    );

    if (res.data?.RelatedTopics?.length > 0) {
      results = res.data.RelatedTopics
        .filter(item => item.FirstURL)  // Nur Einträge mit Links
        .map(item => ({
          title: item.Text?.split(' - ')[0] || 'Kein Titel',  // Titel extrahieren
          link: item.FirstURL,
          snippet: item.Text || ''
        }));
      console.log(`DuckDuckGo: ${results.length} Treffer für "${query.substring(0, 50)}..."`);
      return results.slice(0, maxResults);
    }
  } catch (error) {
    console.log(`DuckDuckGo fehlgeschlagen: ${error.message}`);
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
    console.log(`Keine Ergebnisse von DuckDuckGo oder Tavily für: ${query}`);
  }

  return results.slice(0, maxResults);
}
