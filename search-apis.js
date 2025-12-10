// search-apis.js
const axios = require('axios');
const cheerio = require('cheerio');

const SERPER_URL = 'https://google.serper.dev/search';
const TAVILY_URL = 'https://api.tavily.com/search';

async function searchSerper(query) {
  if (!process.env.SERPER_KEY) return null;
  try {
    const response = await axios.post(
      SERPER_URL,
      { q: query, num: 15 },
      {
        headers: {
          'X-API-KEY': process.env.SERPER_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 18000
      }
    );
    return response.data.organic || [];
  } catch (error) {
    console.log(`Serper fehlgeschlagen für "${query}": ${error.message}`);
    return null;
  }
}

async function searchTavily(query) {
  if (!process.env.TAVILY_API_KEY) return null;
  try {
    const response = await axios.post(
      TAVILY_URL,
      {
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: "advanced",
        include_answer: false,
        include_images: false,
        include_raw_content: false,
        max_results: 15
      },
      { timeout: 25000 }
    );

    if (!response.data?.results) return [];

    return response.data.results.map(r => ({
      title: r.title,
      link: r.url,
      snippet: r.content || r.snippet || ''
    }));
  } catch (error) {
    console.log(`Tavily fehlgeschlagen für "${query}": ${error.message}`);
    return null;
  }
}

async function fetchPageContent(url) {
  for (let retry = 0; retry < 4; retry++) {
    try {
      const { data } = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9'
        }
      });

      const $ = cheerio.load(data);
      // Entferne unnötige Elemente
      $('script, style, noscript, iframe, nav, header, footer, aside, .cookie, .advert').remove();
      let text = $('body').text()
        .replace(/\s+/g, ' ')
        .trim();

      return text.length > 100 ? text.slice(0, 10000) : text;
    } catch (error) {
      const status = error.response?.status;
      if (status === 429 || status === 403 || status >= 500) {
        const wait = (retry + 1) * 4000;
        console.log(`Warte ${wait/1000}s wegen ${status} bei ${url}`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      console.log(`Endgültiger Fehler beim Laden von ${url} – übersprungen`);
      return null;
    }
  }
  return null;
}

async function searchWithFallback(query) {
  let results = await searchSerper(query);

  if (!results || results.length === 0) {
    console.log(`Serper leer → Fallback zu Tavily für: ${query}`);
    results = await searchTavily(query);
  }

  if (!results || results.length === 0) {
    console.log(`Beide APIs leer für: ${query}`);
  }

  return results || [];
}

module.exports = {
  searchWithFallback,
  fetchPageContent
};
