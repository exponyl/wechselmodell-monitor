// search-apis.js
import axios from 'axios';

const SERPER_URL = 'https://google.serper.dev/search';
const TAVILY_URL = 'https://api.tavily.com/search';

// Hauptfunktion – genau so heißt sie in deinen Skripten: suche(query, maxResults)
export async function suche(query, maxResults = 15) {
  let results = [];

  // 1. Serper versuchen (sehr gut bei normalen Suchen)
  if (process.env.SERPER_KEY) {
    try {
      const response = await axios.post(
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

      if (response.data?.organic?.length > 0) {
        results = response.data.organic.map(item => ({
          title: item.title || 'Kein Titel',
          link: item.link,
          snippet: item.snippet || item.snippet || ''
        }));
        console.log(`Serper: ${results.length} Ergebnisse für "${query.substring(0, 50)}..."`);
        return results.slice(0, maxResults);
      }
    } catch (error) {
      console.log(`Serper fehlgeschlagen: ${error.message}`);
    }
  }

  // 2. Tavily als zuverlässiger Fallback (besonders wichtig für web.archive.org!)
  if (process.env.TAVILY_API_KEY) {
    try {
      const response = await axios.post(
        TAVILY_URL,
        {
          api_key: process.env.TAVILY_API_KEY,
          query: query,
          search_depth: 'advanced',
          max_results: maxResults
        },
        { timeout: 30000 }
      );

      if (response.data?.results?.length > 0) {
        const tavilyResults = response.data.results.map(item => ({
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

        console.log(`Tavily: ${tavilyResults.length} Ergebnisse (Fallback) für "${query.substring(0, 50)}..."`);
        
        if (results.length >= 3) {
          return results.slice(0, maxResults);
        }
      }
    } catch (error) {
      console.log(`Tavily fehlgeschlagen: ${error.message}`);
    }
  }

  // Falls wirklich gar nichts kommt
  console.log(`Keine Ergebnisse von Serper oder Tavily für: ${query}`);
  return results.slice(0, maxResults);
}
