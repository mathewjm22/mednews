import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Settings, ChevronDown, ChevronUp, ExternalLink, Activity, BookOpen, Loader2, Star } from 'lucide-react';
import { fetchArticles, fetchSimilarArticles, isTrackedJournal, type Article } from './services/pubmed';
import { fetchRssFeeds } from './services/rss';
import DOMPurify from 'dompurify';

const CLINICAL_SPECIALTIES = [
  'General Medicine', 'Internal Medicine', 'Family Medicine',
  'Cardiology', 'Neurology', 'Oncology', 'Gastroenterology',
  'Pulmonology', 'Endocrinology', 'Nephrology', 'Rheumatology',
  'Infectious Disease', 'Hematology', 'Dermatology', 'Psychiatry',
  'General Surgery', 'Neurosurgery', 'Orthopedic Surgery',
  'Cardiothoracic Surgery', 'Vascular Surgery', 'Plastic Surgery'
];

const STUDY_TYPES = [
  { label: 'RCT', query: '"Randomized Controlled Trial"[Publication Type]', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', activeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200 ring-2 ring-offset-1 ring-indigo-100' },
  { label: 'Clinical Study', query: '"Clinical Trial"[Publication Type] OR "Clinical Study"[Publication Type]', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', activeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 ring-2 ring-offset-1 ring-emerald-100' },
  { label: 'Review Article', query: '"Review"[Publication Type]', color: 'bg-amber-100 text-amber-800 border-amber-200', activeClass: 'bg-amber-100 text-amber-800 border-amber-200 ring-2 ring-offset-1 ring-amber-100' },
  { label: 'Cochrane Review', query: '"Systematic Review"[Publication Type] AND "Cochrane Database Syst Rev"[Journal]', color: 'bg-purple-100 text-purple-800 border-purple-200', activeClass: 'bg-purple-100 text-purple-800 border-purple-200 ring-2 ring-offset-1 ring-purple-100' },
  { label: 'Case Report', query: '"Case Reports"[Publication Type]', color: 'bg-rose-100 text-rose-800 border-rose-200', activeClass: 'bg-rose-100 text-rose-800 border-rose-200 ring-2 ring-offset-1 ring-rose-100' },
];

function getStudyTypeTags(article: Article): { label: string, color: string }[] {
  if (!article.publicationTypes) return [];

  const tags: { label: string, color: string }[] = [];
  const types = article.publicationTypes.map(t => t.toLowerCase());

  // Prioritize Cochrane
  if (article.journal.toLowerCase().includes('cochrane') || types.includes('cochrane review')) {
    tags.push({ label: 'Cochrane Review', color: STUDY_TYPES.find(t => t.label === 'Cochrane Review')!.color });
  } else if (types.includes('randomized controlled trial')) {
    tags.push({ label: 'RCT', color: STUDY_TYPES.find(t => t.label === 'RCT')!.color });
  } else if (types.includes('clinical trial') || types.includes('clinical study')) {
    tags.push({ label: 'Clinical Study', color: STUDY_TYPES.find(t => t.label === 'Clinical Study')!.color });
  } else if (types.includes('review') || types.includes('systematic review')) {
    tags.push({ label: 'Review Article', color: STUDY_TYPES.find(t => t.label === 'Review Article')!.color });
  } else if (types.includes('case reports') || types.includes('case report')) {
    tags.push({ label: 'Case Report', color: STUDY_TYPES.find(t => t.label === 'Case Report')!.color });
  }

  return tags;
}

const App: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [rssArticles, setRssArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedStudyTypes, setSelectedStudyTypes] = useState<string[]>([]);

  // Date filter state
  const currentDate = new Date();
  const defaultYear = (currentDate.getFullYear() - 1).toString();
  const defaultMonth = (currentDate.getMonth() + 1).toString();
  const [startYear, setStartYear] = useState<string>(defaultYear);
  const [startMonth, setStartMonth] = useState<string>(defaultMonth);

  // Active settings state (used for fetching)
  const [apiKey, setApiKey] = useState(localStorage.getItem('pubmed_api_key') || '');
  const [rssFeeds, setRssFeeds] = useState<string>(localStorage.getItem('rss_feeds') || '');

  // Draft settings state (used in the modal)
  const [draftApiKey, setDraftApiKey] = useState(apiKey);
  const [draftRssFeeds, setDraftRssFeeds] = useState(rssFeeds);
  const [showSettings, setShowSettings] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

  // Similar articles state
  const [similarArticles, setSimilarArticles] = useState<Record<string, Article[]>>({});
  const [loadingSimilar, setLoadingSimilar] = useState<Record<string, boolean>>({});

  // View state: 'home' or 'trends'
  const [activeView, setActiveView] = useState<'home' | 'trends'>('home');

  // Load articles
  useEffect(() => {
    const loadArticles = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch pubmed data
        const { articles: pubmedData, totalPages, totalResults } = await fetchArticles(
          searchTerm,
          selectedSpecialties,
          selectedStudyTypes,
          apiKey,
          page,
          10,
          startYear,
          startMonth
        );

        // Fetch RSS data
        let rssData: Article[] = [];
        if (rssFeeds.trim()) {
           const urls = rssFeeds.split('\n').map(u => u.trim()).filter(u => u);
           if (urls.length > 0) {
             rssData = await fetchRssFeeds(urls);
           }
        }

        setArticles(pubmedData);
        setRssArticles(rssData);
        setTotalPages(totalPages);
        setTotalResults(totalResults + rssData.length);
      } catch (err: unknown) {
        console.error(err);
        setError('Failed to fetch articles. Please try again later or check your API key.');
      } finally {
        setLoading(false);
      }
    };

    loadArticles();
  }, [searchTerm, selectedSpecialties, selectedStudyTypes, page, apiKey, rssFeeds, startYear, startMonth]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput);
    setPage(1);
  };

  const handleSaveSettings = () => {
    localStorage.setItem('pubmed_api_key', draftApiKey);
    localStorage.setItem('rss_feeds', draftRssFeeds);
    setApiKey(draftApiKey);
    setRssFeeds(draftRssFeeds);
    setShowSettings(false);
    // Reload if needed
    setPage(1);
  };

  const toggleExpand = async (id: string, pmid: string) => {
    const isExpanding = expandedArticleId !== id;
    setExpandedArticleId(isExpanding ? id : null);

    // If expanding and we don't have similar articles for this id yet, fetch them
    if (isExpanding && pmid && pmid !== 'RSS' && !similarArticles[id]) {
      setLoadingSimilar(prev => ({ ...prev, [id]: true }));
      try {
        const related = await fetchSimilarArticles(pmid, apiKey);
        setSimilarArticles(prev => ({ ...prev, [id]: related }));
      } catch (err) {
        console.error("Failed to fetch similar articles:", err);
      } finally {
        setLoadingSimilar(prev => ({ ...prev, [id]: false }));
      }
    }
  };

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties(prev =>
      prev.includes(specialty)
        ? prev.filter(s => s !== specialty)
        : [...prev, specialty]
    );
    setPage(1); // Reset page on filter change
  };

  const toggleStudyType = (studyType: string) => {
    setSelectedStudyTypes(prev =>
      prev.includes(studyType)
        ? prev.filter(s => s !== studyType)
        : [...prev, studyType]
    );
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                ClinTrend
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveView('home')}
                className={`text-sm font-medium ${activeView === 'home' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Feed
              </button>
              <button
                onClick={() => setActiveView('trends')}
                className={`text-sm font-medium ${activeView === 'trends' ? 'text-red-500' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Top Medical Trends
              </button>
            </div>

            {activeView === 'home' && (
              <form onSubmit={handleSearch} className="flex-1 max-w-2xl flex">
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search trending topics (e.g., COVID-19, Cardiology)..."
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-l-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                />
              </div>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Search
                </button>
              </form>
            )}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="inline-flex items-center p-2 border border-slate-300 rounded-full text-slate-500 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-b border-slate-200 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="api-key" className="block text-sm font-medium text-slate-700">
                    NCBI API Key (Optional, increases rate limits)
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <input
                      type="text"
                      name="api-key"
                      id="api-key"
                      value={draftApiKey}
                      onChange={(e) => setDraftApiKey(e.target.value)}
                      className="flex-1 block w-full rounded-md sm:text-sm border-slate-300 border p-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your NCBI API Key"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="rss-feeds" className="block text-sm font-medium text-slate-700">
                    Custom RSS Feeds (One URL per line)
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <textarea
                      name="rss-feeds"
                      id="rss-feeds"
                      rows={3}
                      value={draftRssFeeds}
                      onChange={(e) => setDraftRssFeeds(e.target.value)}
                      className="flex-1 block w-full rounded-md sm:text-sm border-slate-300 border p-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://example.com/rss.xml&#10;https://another.com/feed"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={handleSaveSettings}
                className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors"
              >
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {activeView === 'trends' ? (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Activity className="h-6 w-6 text-red-500" />
                Top Trending Medical Searches on Google
              </h2>
              <p className="text-slate-600 mt-2">Showing the top 15 trending clinical topics over the past month.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[
                'Semaglutide', 'Atrial Fibrillation', 'COVID-19', 'RSV Vaccine',
                'Ozempic', 'Mounjaro', 'Heart Failure', 'Monkeypox',
                'AI in Medicine', 'GLP-1', 'Telehealth', 'Avian Flu',
                'Metformin', 'Melatonin', 'Long COVID'
              ].map((topic, index) => (
                <div key={topic} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center">
                  <div className="text-4xl font-black text-slate-100 mb-2">#{index + 1}</div>
                  <h3 className="font-bold text-lg text-slate-800 mb-3">{topic}</h3>
                  <div className="flex flex-col gap-2 w-full mt-auto">
                    <button
                      onClick={() => {
                        setSearchInput(topic);
                        setSearchTerm(topic);
                        setPage(1);
                        setActiveView('home');
                      }}
                      className="text-sm w-full py-2 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Search Literature
                    </button>
                    <a
                      href={`https://trends.google.com/trends/explore?q=${encodeURIComponent(topic)}&hl=en-US`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm w-full py-2 bg-slate-50 text-slate-600 font-medium rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-1"
                    >
                      View Trends <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
          {/* Filters */}
          <div className="mb-8 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Filter by Clinical Specialty</h3>
              <div className="flex flex-wrap gap-2">
                {CLINICAL_SPECIALTIES.map(specialty => (
                  <button
                    key={specialty}
                    onClick={() => toggleSpecialty(specialty)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                      selectedSpecialties.includes(specialty)
                        ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {specialty}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Filter by Study Type</h3>
              <div className="flex flex-wrap gap-2">
                {STUDY_TYPES.map(type => (
                  <button
                    key={type.label}
                    onClick={() => toggleStudyType(type.label)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                      selectedStudyTypes.includes(type.label)
                        ? type.activeClass
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider w-full sm:w-auto">Date Range (Start)</h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <select
                  value={startMonth}
                  onChange={(e) => { setStartMonth(e.target.value); setPage(1); }}
                  className="block w-full sm:w-32 pl-3 pr-10 py-1.5 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>

                <select
                  value={startYear}
                  onChange={(e) => { setStartYear(e.target.value); setPage(1); }}
                  className="block w-full sm:w-28 pl-3 pr-10 py-1.5 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <span className="text-xs text-slate-500 ml-2 hidden sm:inline-block">Showing results from selected date to present.</span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">

          {/* Main Content Area */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-500" />
                {searchTerm ? `Results for "${searchTerm}"` : 'Recent High-Impact Studies'}
              </h2>
              {!loading && totalResults > 0 && (
                <span className="text-sm text-slate-500">
                  {totalResults.toLocaleString()} results
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              </div>
            ) : error ? (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <p className="text-red-700">{error}</p>
              </div>
            ) : (articles.length === 0 && rssArticles.length === 0) ? (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
                <p className="text-slate-500 text-lg">No articles found. Try a different search term.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {[...rssArticles, ...articles].map((article, index) => (
                  <motion.div
                    key={article.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onClick={() => toggleExpand(article.id, article.pmid)}
                    className={`bg-white border ${article.pmid === 'RSS' ? 'border-orange-200' : 'border-slate-200'} rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group`}
                  >
                    <div className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
                              {article.journal}
                            </span>
                            <span className="text-xs font-medium text-slate-400">
                              {article.pubDate || 'Recent'}
                            </span>
                            {article.pmid === 'RSS' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800">
                                RSS
                              </span>
                            )}
                            {getStudyTypeTags(article).map(tag => (
                              <span key={tag.label} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${tag.color}`}>
                                {tag.label}
                              </span>
                            ))}
                          </div>

                          <h3 className="text-xl font-bold text-slate-900 leading-snug mb-2 group-hover:text-blue-700 transition-colors">
                            {article.title}
                          </h3>

                          <p className="text-sm text-slate-600 line-clamp-1 mb-3">
                            {article.authors.join(', ')}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {article.pmid !== 'RSS' && (
                            <a
                              href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center p-2 bg-slate-50 text-slate-500 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="View on PubMed"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}

                          <a
                            href={`https://trends.google.com/trends/explore?q=${encodeURIComponent(article.title.split(' ').slice(0, 3).join(' ').replace(/[^\w\s]/g, ''))}&hl=en-US`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center p-2 bg-slate-50 text-slate-500 rounded hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="View Search Trends for this topic"
                          >
                            <Activity className="h-4 w-4" />
                          </a>
                        </div>
                      </div>

                      {/* Abstract Expansion */}
                      <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-50">
                        <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700 transition-colors flex items-center gap-1">
                          {expandedArticleId === article.id ? (
                            <>Hide Full Abstract <ChevronUp className="h-4 w-4" /></>
                          ) : (
                            <>Read Full Abstract <ChevronDown className="h-4 w-4" /></>
                          )}
                        </span>
                      </div>

                      <AnimatePresence>
                        {expandedArticleId === article.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-4 border-t border-slate-100">
                              <div className="flex flex-col xl:flex-row gap-6">
                                <div className="flex-1">
                                  {article.abstract ? (
                                    <div
                                      className="text-[15px] text-slate-800 leading-relaxed space-y-4 font-serif"
                                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.abstract) }}
                                    />
                                  ) : (
                                    <p className="text-sm text-slate-500 italic">No abstract available for this article.</p>
                                  )}
                                  <div className="mt-6 flex gap-2">
                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-slate-100 text-slate-500">
                                      PMID: {article.pmid}
                                    </span>
                                  </div>
                                </div>

                                {/* Similar Studies Panel */}
                                {article.pmid !== 'RSS' && (
                                  <div className="w-full xl:w-80 shrink-0 bg-slate-50 rounded-lg p-4 border border-slate-100">
                                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                      <BookOpen className="h-4 w-4 text-slate-500" />
                                      Similar Studies
                                    </h4>

                                    {loadingSimilar[article.id] ? (
                                      <div className="flex justify-center items-center py-8">
                                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                                      </div>
                                    ) : (similarArticles[article.id] && similarArticles[article.id].length > 0) ? (
                                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                                        {similarArticles[article.id].map(similar => (
                                          <div key={similar.pmid} className="text-sm bg-white p-3 rounded border border-slate-200 shadow-sm relative group/similar">
                                            <a
                                              href={`https://pubmed.ncbi.nlm.nih.gov/${similar.pmid}/`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="block hover:text-blue-600 font-medium text-slate-800 leading-snug mb-1"
                                            >
                                              {similar.title}
                                            </a>
                                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-2">
                                              <span className="text-xs text-slate-500">{similar.journal}</span>
                                              {isTrackedJournal(similar.journal) && (
                                                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                  <Star className="h-3 w-3 fill-amber-500" /> Top Journal
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-500 italic py-2">No similar studies found.</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-6">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-600">
                      Page {page} of {Math.min(totalPages, 100)} {/* Limiting to 100 pages for sanity */}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages || page >= 100}
                      className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl p-6 sticky top-24">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-red-500" />
                Google Trends
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Explore trending medical searches on Google.
              </p>

              <div className="space-y-4">
                {['COVID-19', 'Ozempic', 'GLP-1', 'AI in Medicine'].map(topic => (
                  <div key={topic} className="flex flex-col border border-slate-100 rounded-lg p-3 bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-800">{topic}</span>
                      <a
                        href={`https://trends.google.com/trends/explore?q=${encodeURIComponent(topic)}&hl=en-US`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {/* Placeholder for embedded trends widget. Google Trends doesn't offer a clean API for direct static embedding without scripts, so we link out cleanly or could embed an iframe if generated via Google's embed tool */}
                    <button
                      onClick={() => {
                        setSearchInput(topic);
                        setSearchTerm(topic);
                        setPage(1);
                      }}
                      className="text-xs w-full py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors text-slate-600"
                    >
                      Search Literature
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;