// search-apis.js
const axios = require('axios');
const cheerio = require('cheerio');

const SERPER_URL = 'https://google.serper.dev/search';
const TAVILY_URL = 'https://api.tavily.com/search';

async function searchSerper(query) {
  if (!process.env.SERPER_KEY) return null;
  try {
    const response = await axios.post(SERPER_URL, { q: query }, {
      headers: { 'X-API-KEY': process.env.SERPER_KEY },
      timeout: 15000
    });
    return response.data.organic || [];
  } catch (e) {
    console.log(`Serper fehlgeschlagen für "${query}":`, e.message);
    return null;
  }
}

async function searchTavily(query) {
  if (!process.env.TAVILY_API_KEY) return null;
  try {
    const response = await axios.post(TAVILY_URL, {
      api_key: process.env.TAVILY_API_KEY,
      query: query,
      search_depth: "advanced",
      include_domains: [],
      max_results: 15
    }, { timeout: 20000 });

    return (response.data.results || []).map(r => ({
      title: r.title,
      link: r.url,
      snippet: r.content
    }));
  } catch (e) {
    console.log(`Tavily fehlgeschlagen für "${query}":`, e.message);
    return null;
  }
}

async function fetchPageContent(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const { data } = await axios.get(url, {
        timeout: 12000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WechselmodellMonitor/1.0)' }
      });
      const $ = cheerio.load(data);
      $('script, style, nav, footer, aside').remove();
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      return text.slice(0, 8000);
    } catch (e) {
      if (e.response?.status === 403 || e.response?.status === 429) {
        await new Promise(r => setTimeout(r, 3000 * (i + 1)));
        continue;
      }
      console.log(`Fehler beim Laden von ${url} – wird übersprungen`);
      return null;
    }
  }
  return null;
}

async function searchWithFallback(query) {
  let results = await searchSerper(query);
  if (!results || results.length === 0) {
    console.log(`Fallback zu Tavily für: ${query}`);
    results = await searchTavily(query);
  }
  return results || [];
}

module.exports = { searchWithFallback, fetchPageContent };
