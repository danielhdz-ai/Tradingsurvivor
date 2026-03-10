// Vercel Serverless Function - Proxy para NewsAPI
// Soluciona problemas de CORS de forma profesional

export default async function handler(req, res) {
  // Configurar CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Tu API key de NewsAPI (luego la pondrás en variables de entorno de Vercel)
    const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '69efefe35fec443f9c30fe76c7ff4bff';
    const NEWSAPI_BASE = 'https://newsapi.org/v2';
    
    // Construir URL
    const newsUrl = `${NEWSAPI_BASE}/top-headlines?category=business&language=es&pageSize=50&apiKey=${NEWSAPI_KEY}`;
    
    console.log('📡 Fetching news from:', newsUrl);
    
    // Hacer la petición a NewsAPI
    const response = await fetch(newsUrl);
    
    if (!response.ok) {
      throw new Error(`NewsAPI respondió con status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Filtrar solo noticias de macroeconomía
    const economyKeywords = [
      'economía', 'economy', 'económico', 'banco central', 'fed', 
      'pib', 'gdp', 'inflación', 'tasas de interés', 'interest rates', 
      'desempleo', 'comercio', 'trade', 'fiscal', 'monetaria', 'monetary', 
      'recession', 'recesión', 'growth', 'crecimiento', 'mercado', 'market', 
      'bolsa', 'divisas', 'forex', 'petroleo', 'oro'
    ];
    
    const filteredArticles = data.articles?.filter(article => {
      const title = article.title?.toLowerCase() || '';
      const description = article.description?.toLowerCase() || '';
      
      return economyKeywords.some(keyword => 
        title.includes(keyword.toLowerCase()) || description.includes(keyword.toLowerCase())
      );
    }) || [];
    
    // Formatear respuesta
    const formattedNews = filteredArticles.slice(0, 30).map(article => {
      const publishedDate = new Date(article.publishedAt);
      const timestamp = Math.floor(publishedDate.getTime() / 1000);
      
      // Categorizar
      const title = article.title?.toLowerCase() || '';
      let sector = 'indices';
      
      if (title.includes('bitcoin') || title.includes('crypto') || title.includes('ethereum')) {
        sector = 'crypto';
      } else if (title.includes('forex') || title.includes('usd') || title.includes('eur')) {
        sector = 'forex';
      } else if (title.includes('s&p') || title.includes('nasdaq') || title.includes('dow')) {
        sector = 'indices';
      } else if (title.includes('gold') || title.includes('oil') || title.includes('commodity')) {
        sector = 'commodities';
      }
      
      return {
        datetime: timestamp,
        title: article.title,
        sector: sector,
        source: article.source?.name || 'Unknown',
        url: article.url,
        image: article.urlToImage || ''
      };
    });
    
    console.log('✅ Noticias filtradas:', formattedNews.length);
    
    // Devolver respuesta
    return res.status(200).json({
      success: true,
      articles: formattedNews,
      total: formattedNews.length
    });
    
  } catch (error) {
    console.error('❌ Error en proxy de noticias:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      articles: []
    });
  }
}
