export interface Article {
  id: string;
  title: string;
  abstract: string;
  journal: string;
  pubDate: string;
  authors: string[];
  pmid: string;
}

const JOURNALS = [
  '"New England Journal of Medicine"[Journal]',
  '"JAMA"[Journal]',
  '"Lancet"[Journal]',
  '"BMJ"[Journal]',
  '"Annals of Internal Medicine"[Journal]',
  '"JAMA Internal Medicine"[Journal]',
  '"American Family Physician"[Journal]',
  '"Cleveland Clinic Journal of Medicine"[Journal]',
  '"Mayo Clinic Proceedings"[Journal]',
  '"Annals of Emergency Medicine"[Journal]',
  '"Chest"[Journal]',
  '"Circulation"[Journal]',
  '"Journal of the American College of Cardiology"[Journal]',
  '"Gastroenterology"[Journal]',
  '"American Journal of Respiratory and Critical Care Medicine"[Journal]',
  '"The American Journal of Psychiatry"[Journal]',
  '"Neurology"[Journal]',
  '"Pediatrics"[Journal]',
  '"Obstetrics and Gynecology"[Journal]',
  '"The Journal of Urology"[Journal]'
];

const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export const fetchArticles = async (
  keyword: string = '',
  apiKey: string = '',
  page: number = 1,
  articlesPerPage: number = 10
): Promise<{ articles: Article[]; totalPages: number; totalResults: number }> => {
  try {
    const journalQuery = `(${JOURNALS.join(' OR ')})`;
    const keywordQuery = keyword ? ` AND (${keyword})` : '';
    // Sort by publication date (most recent first)
    const query = `${journalQuery}${keywordQuery}`;

    const retstart = (page - 1) * articlesPerPage;

    let searchUrl = `${BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${articlesPerPage}&retstart=${retstart}&sort=date`;
    if (apiKey) {
      searchUrl += `&api_key=${apiKey}`;
    }

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`PubMed API search failed: ${searchResponse.status}`);
    }
    const searchData = await searchResponse.json();

    const idList = searchData.esearchresult?.idlist || [];
    const count = parseInt(searchData.esearchresult?.count || '0', 10);
    const totalPages = Math.ceil(count / articlesPerPage);

    if (idList.length === 0) {
      return { articles: [], totalPages: 0, totalResults: 0 };
    }

    let fetchUrl = `${BASE_URL}/efetch.fcgi?db=pubmed&id=${idList.join(',')}&retmode=xml`;
    if (apiKey) {
      fetchUrl += `&api_key=${apiKey}`;
    }

    // Using simple proxy since CORS blocks XML fetches from NCBI
    // Alternatively, if proxy is down or slow, try direct first, then proxy.
    let xmlText = '';
    try {
      const directResponse = await fetch(fetchUrl);
      if (directResponse.ok) {
        xmlText = await directResponse.text();
      } else {
        throw new Error('Direct fetch failed');
      }
    } catch (e: unknown) {
      console.warn('Falling back to proxy after error:', e);
      const proxyUrl = 'https://corsproxy.io/?url=' + encodeURIComponent(fetchUrl);
      const fetchResponse = await fetch(proxyUrl);
      if (!fetchResponse.ok) {
        throw new Error(`PubMed API fetch failed: ${fetchResponse.status}`);
      }
      xmlText = await fetchResponse.text();
    }

    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const articlesNodeList = xmlDoc.getElementsByTagName('PubmedArticle');
    const articles: Article[] = Array.from(articlesNodeList).map(articleNode => {
      const pmid = articleNode.getElementsByTagName('PMID')[0]?.textContent || '';
      const title = articleNode.getElementsByTagName('ArticleTitle')[0]?.textContent || '';

      // Abstract can be multiple AbstractText elements (e.g., Background, Methods, Results, Conclusion)
      const abstractNodes = articleNode.getElementsByTagName('AbstractText');
      let abstract = '';
      if (abstractNodes.length > 0) {
        abstract = Array.from(abstractNodes).map(node => {
          const label = node.getAttribute('Label');
          return label ? `<strong>${label}:</strong> ${node.textContent}` : node.textContent;
        }).join('<br/><br/>');
      }

      const journal = articleNode.getElementsByTagName('Title')[0]?.textContent || '';

      // Parse pub date
      const pubDateNode = articleNode.getElementsByTagName('PubDate')[0];
      let pubDate = '';
      if (pubDateNode) {
        const year = pubDateNode.getElementsByTagName('Year')[0]?.textContent || '';
        const month = pubDateNode.getElementsByTagName('Month')[0]?.textContent || '';
        const day = pubDateNode.getElementsByTagName('Day')[0]?.textContent || '';
        pubDate = [year, month, day].filter(Boolean).join('-');
      }

      // Authors
      const authorNodes = articleNode.getElementsByTagName('Author');
      const authors = Array.from(authorNodes).map(authorNode => {
        const lastName = authorNode.getElementsByTagName('LastName')[0]?.textContent || '';
        const initials = authorNode.getElementsByTagName('Initials')[0]?.textContent || '';
        return `${lastName} ${initials}`.trim();
      }).filter(Boolean);

      return {
        id: pmid,
        pmid,
        title,
        abstract,
        journal,
        pubDate,
        authors,
      };
    });

    return { articles, totalPages, totalResults: count };
  } catch (error) {
    console.error("Error fetching from PubMed:", error);
    throw error;
  }
};
