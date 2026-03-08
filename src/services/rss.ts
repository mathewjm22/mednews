import type { Article } from './pubmed';

export const fetchRssFeeds = async (urls: string[]): Promise<Article[]> => {
  if (!urls || urls.length === 0) return [];

  const articles: Article[] = [];

  // Use a CORS proxy for RSS feeds since most don't have CORS enabled
  const corsProxy = 'https://corsproxy.io/?url=';

  const promises = urls.map(async (url) => {
    try {
      const response = await fetch(`${corsProxy}${encodeURIComponent(url)}`);
      if (!response.ok) {
        console.warn(`Failed to fetch RSS feed: ${url}`);
        return;
      }

      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');

      // Simple RSS 2.0 or Atom parser
      const items = xmlDoc.querySelectorAll('item, entry');

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
          journal: new URL(url).hostname.replace('www.', ''),
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
