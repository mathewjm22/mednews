import type { Article } from './pubmed';

const fetchTextWithTimeout = async (url: string, options: RequestInit = {}, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    clearTimeout(id);
    return text;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

export const fetchRssFeeds = async (urls: string[]): Promise<Article[]> => {
  if (!urls || urls.length === 0) return [];

  const articles: Article[] = [];

  const promises = urls.map(async (url) => {
    try {
      // Trying different proxies if one fails. Some proxies block certain domains or have limits.
      let text = '';

      // Sequential fallback of proxies to avoid multiple 429s from hitting a broken proxy repeatedly
      const proxies = [
        `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
      ];

      for (let i = 0; i < proxies.length; i++) {
        try {
          text = await fetchTextWithTimeout(proxies[i]);
          if (text && text.includes('<rss') || text.includes('<feed')) {
            break; // Valid XML fetched
          }
        } catch (e) {
          if (i === proxies.length - 1) {
             console.warn(`Failed to fetch RSS feed via proxies: ${url}`);
             return;
          }
        }
      }

      if (!text) return;

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');

      // Simple RSS 2.0 or Atom parser
      const items = xmlDoc.querySelectorAll('item, entry');

      // Try to get feed title for the source
      const feedTitleNode = xmlDoc.querySelector('channel > title, feed > title');
      let feedTitle = feedTitleNode?.textContent?.trim() || new URL(url).hostname.replace('www.', '');

      items.forEach((item, index) => {
        const title = item.querySelector('title')?.textContent || 'Untitled';
        const description = item.querySelector('description, summary, content')?.textContent || '';
        const pubDate = item.querySelector('pubDate, published, updated')?.textContent || '';
        const author = item.querySelector('creator, author > name')?.textContent || 'Unknown Author';

        // Extract an image if available
        let imageUrl = '';

        // 1. Try media:content
        const mediaContent = item.getElementsByTagName('media:content');
        for (let i = 0; i < mediaContent.length; i++) {
          const type = mediaContent[i].getAttribute('type') || '';
          const urlAttr = mediaContent[i].getAttribute('url');
          if (type.startsWith('image/') && urlAttr) {
            imageUrl = urlAttr;
            break;
          }
        }

        // 2. Try enclosure
        if (!imageUrl) {
          const enclosure = item.querySelector('enclosure');
          const type = enclosure?.getAttribute('type') || '';
          if (type.startsWith('image/') && enclosure?.getAttribute('url')) {
            imageUrl = enclosure.getAttribute('url')!;
          }
        }

        // 3. Try parsing description/content for an <img> tag
        if (!imageUrl) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = description;
            const img = tempDiv.querySelector('img');
            if (img && img.src) {
                imageUrl = img.src;
            }
        }

        // Extract a "PMID" equivalent or generate a unique ID
        const id = item.querySelector('guid, id')?.textContent || `rss-${url}-${index}`;

        articles.push({
          id,
          pmid: 'RSS', // Marker to show it's from RSS
          title: title.trim(),
          abstract: description.trim(),
          authors: [author.trim()],
          journal: feedTitle,
          pubDate: pubDate ? new Date(pubDate).toLocaleDateString() : 'Recent',
          publicationTypes: [],
          imageUrl: imageUrl || undefined
        });
      });
    } catch (error) {
      console.error(`Error parsing RSS feed ${url}:`, error);
    }
  });

  await Promise.allSettled(promises);

  return articles;
};
