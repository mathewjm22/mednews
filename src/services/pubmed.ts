export interface Article {
  id: string;
  title: string;
  abstract: string;
  journal: string;
  pubDate: string;
  authors: string[];
  pmid: string;
  publicationTypes: string[];
}

export const JOURNALS = [
  '"New England Journal of Medicine"[Journal]',
  '"JAMA"[Journal]',
  '"Lancet"[Journal]',
  '"The Lancet Oncology"[Journal]',
  '"The Lancet Neurology"[Journal]',
  '"The Lancet Infectious Diseases"[Journal]',
  '"The Lancet Respiratory Medicine"[Journal]',
  '"The Lancet Psychiatry"[Journal]',
  '"The Lancet Gastroenterology & Hepatology"[Journal]',
  '"The Lancet Diabetes & Endocrinology"[Journal]',
  '"Nature Medicine"[Journal]',
  '"BMJ"[Journal]',
  '"Annals of Internal Medicine"[Journal]',
  '"JAMA Internal Medicine"[Journal]',
  '"American Family Physician"[Journal]',
  '"Cleveland Clinic Journal of Medicine"[Journal]',
  '"Mayo Clinic Proceedings"[Journal]',
  '"Annals of Emergency Medicine"[Journal]',
  '"Cochrane Database of Systematic Reviews"[Journal]',
  '"Chest"[Journal]',
  '"Circulation"[Journal]',
  '"Journal of the American College of Cardiology"[Journal]',
  '"Gastroenterology"[Journal]',
  '"American Journal of Respiratory and Critical Care Medicine"[Journal]',
  '"The American Journal of Psychiatry"[Journal]',
  '"Neurology"[Journal]',
  '"Obstetrics and Gynecology"[Journal]',
  '"The Journal of Urology"[Journal]'
];

const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

// Define STUDY_TYPES locally or extract to a shared constants file if needed.
// Repeating here to avoid circular dependency with App.tsx for simplicity.
const STUDY_TYPES_MAP: Record<string, string> = {
  'RCT': '"Randomized Controlled Trial"[Publication Type]',
  'Clinical Study': '("Clinical Trial"[Publication Type] OR "Clinical Study"[Publication Type])',
  'Review Article': '"Review"[Publication Type]',
  'Cochrane Review': '("Systematic Review"[Publication Type] AND "Cochrane Database Syst Rev"[Journal])',
  'Case Report': '"Case Reports"[Publication Type]',
};

export const fetchSimilarArticles = async (pmid: string, apiKey: string = ''): Promise<Article[]> => {
  if (!pmid || pmid === 'RSS') return [];

  try {
    // 1. Get related PMIDs using elink
    let elinkUrl = `${BASE_URL}/elink.fcgi?dbfrom=pubmed&db=pubmed&id=${pmid}&cmd=neighbor&retmode=json`;
    if (apiKey) elinkUrl += `&api_key=${apiKey}`;

    const elinkResponse = await fetch(elinkUrl);
    if (!elinkResponse.ok) {
      throw new Error(`PubMed elink API failed: ${elinkResponse.status}`);
    }
    const elinkData = await elinkResponse.json();

    // Extract the linked PMIDs. The standard "similar articles" linkname is 'pubmed_pubmed' or 'pubmed_pubmed_alsoviewed'
    const linkset = elinkData.linksets?.[0];
    if (!linkset || !linkset.linksetdbs) return [];

    // Find the standard similar articles linkset
    const similarLinksDb = linkset.linksetdbs.find((db: any) => db.linkname === 'pubmed_pubmed');
    if (!similarLinksDb || !similarLinksDb.links) return [];

    // Get top 10 similar PMIDs (excluding the original pmid which is sometimes returned)
    const similarPmids = similarLinksDb.links
      .map((l: any) => l.id)
      .filter((id: string) => id !== pmid)
      .slice(0, 10);

    if (similarPmids.length === 0) return [];

    // 2. Fetch the actual article metadata for those PMIDs using efetch
    let fetchUrl = `${BASE_URL}/efetch.fcgi?db=pubmed&id=${similarPmids.join(',')}&retmode=xml`;
    if (apiKey) fetchUrl += `&api_key=${apiKey}`;

    let xmlText = '';
    try {
      const directResponse = await fetch(fetchUrl);
      if (directResponse.ok) {
        xmlText = await directResponse.text();
      } else {
        throw new Error('Direct fetch failed');
      }
    } catch (e: unknown) {
      console.warn('Falling back to proxy for similar articles after error:', e);
      const proxyUrl = 'https://corsproxy.io/?url=' + encodeURIComponent(fetchUrl);
      const fetchResponse = await fetch(proxyUrl);
      if (!fetchResponse.ok) {
        throw new Error(`PubMed API fetch failed: ${fetchResponse.status}`);
      }
      xmlText = await fetchResponse.text();
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const articlesNodeList = xmlDoc.getElementsByTagName('PubmedArticle');
    const articles: Article[] = Array.from(articlesNodeList).map(articleNode => {
      const id = articleNode.getElementsByTagName('PMID')[0]?.textContent || '';
      const title = articleNode.getElementsByTagName('ArticleTitle')[0]?.textContent || '';

      const abstractNodes = articleNode.getElementsByTagName('AbstractText');
      let abstract = '';
      if (abstractNodes.length > 0) {
        abstract = Array.from(abstractNodes).map(node => {
          const label = node.getAttribute('Label');
          return label ? `<strong>${label}:</strong> ${node.textContent}` : node.textContent;
        }).join('<br/><br/>');
      }

      const journal = articleNode.getElementsByTagName('Title')[0]?.textContent || '';

      const pubDateNode = articleNode.getElementsByTagName('PubDate')[0];
      let pubDate = '';
      if (pubDateNode) {
        const year = pubDateNode.getElementsByTagName('Year')[0]?.textContent || '';
        const month = pubDateNode.getElementsByTagName('Month')[0]?.textContent || '';
        const day = pubDateNode.getElementsByTagName('Day')[0]?.textContent || '';
        pubDate = [year, month, day].filter(Boolean).join('-');
      }

      const authorNodes = articleNode.getElementsByTagName('Author');
      const authors = Array.from(authorNodes).map(authorNode => {
        const lastName = authorNode.getElementsByTagName('LastName')[0]?.textContent || '';
        const initials = authorNode.getElementsByTagName('Initials')[0]?.textContent || '';
        return `${lastName} ${initials}`.trim();
      }).filter(Boolean);

      const pubTypeNodes = articleNode.getElementsByTagName('PublicationType');
      let publicationTypes = Array.from(pubTypeNodes).map(node => node.textContent || '').filter(Boolean);

      if (journal.includes("Cochrane")) {
        publicationTypes.push("Cochrane Review");
      }

      return {
        id,
        pmid: id,
        title,
        abstract,
        journal,
        pubDate,
        authors,
        publicationTypes,
      };
    });

    return articles;

  } catch (error) {
    console.error("Error fetching similar articles from PubMed:", error);
    return [];
  }
};

export const isTrackedJournal = (journalName: string): boolean => {
  const normalizedInput = journalName.toLowerCase();
  return JOURNALS.some(j => {
    // Strip ["Journal"] and quotes for comparison
    const cleanJournal = j.replace(/\[Journal\]/i, '').replace(/"/g, '').toLowerCase();
    return normalizedInput.includes(cleanJournal);
  });
};

export const fetchArticles = async (
  keyword: string = '',
  specialties: string[] = [],
  studyTypes: string[] = [],
  selectedJournals: string[] = [],
  apiKey: string = '',
  page: number = 1,
  articlesPerPage: number = 10,
  startYear?: string,
  startMonth?: string
): Promise<{ articles: Article[]; totalPages: number; totalResults: number }> => {
  try {
    const activeJournals = selectedJournals.length > 0 ? selectedJournals : JOURNALS;
    const journalQuery = `(${activeJournals.join(' OR ')})`;
    const keywordQuery = keyword ? ` AND (${keyword})` : '';
    const specialtiesQuery = specialties.length > 0 ? ` AND (${specialties.map(s => `"${s}"[Mesh] OR "${s}"[Title/Abstract]`).join(' OR ')})` : '';

    let studyTypesQuery = '';
    if (studyTypes.length > 0) {
      const typeQueries = studyTypes.map(type => STUDY_TYPES_MAP[type]).filter(Boolean);
      if (typeQueries.length > 0) {
        studyTypesQuery = ` AND (${typeQueries.join(' OR ')})`;
      }
    }

    const pediatricsExclusion = ' NOT "Pediatrics"[Mesh] NOT "Child"[Mesh] NOT "Infant"[Mesh]';

    // Sort by publication date (most recent first)
    const query = `${journalQuery}${keywordQuery}${specialtiesQuery}${studyTypesQuery}${pediatricsExclusion}`;

    const retstart = (page - 1) * articlesPerPage;

    let searchUrl = `${BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${articlesPerPage}&retstart=${retstart}&sort=date`;

    if (startYear && startMonth) {
      // month needs to be zero padded if it's 1-9
      const formattedMonth = startMonth.padStart(2, '0');
      searchUrl += `&mindate=${startYear}/${formattedMonth}/01&maxdate=3000/12/31&datetype=pdat`;
    }

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

      // Publication Types
      const pubTypeNodes = articleNode.getElementsByTagName('PublicationType');
      let publicationTypes = Array.from(pubTypeNodes).map(node => node.textContent || '').filter(Boolean);

      // Override for Cochrane Reviews
      if (journal.includes("Cochrane")) {
        publicationTypes.push("Cochrane Review");
      }

      return {
        id: pmid,
        pmid,
        title,
        abstract,
        journal,
        pubDate,
        authors,
        publicationTypes,
      };
    });

    return { articles, totalPages, totalResults: count };
  } catch (error) {
    console.error("Error fetching from PubMed:", error);
    throw error;
  }
};
