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
          publicationTypes: []
        });
      });
    } catch (error) {
      console.error(`Error parsing RSS feed ${url}:`, error);
    }
  });

  await Promise.allSettled(promises);

  return articles;
};
