import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Settings, ChevronDown, ChevronUp, ExternalLink, Activity, BookOpen, Loader2 } from 'lucide-react';
import { fetchArticles, type Article } from './services/pubmed';
import { fetchRssFeeds } from './services/rss';
import DOMPurify from 'dompurify';

const CLINICAL_SPECIALTIES = [
  'Cardiology', 'Neurology', 'Oncology', 'Gastroenterology',
  'Pulmonology', 'Endocrinology', 'Nephrology', 'Rheumatology',
  'Infectious Disease', 'Hematology', 'Dermatology', 'Psychiatry',
  'General Surgery', 'Neurosurgery', 'Orthopedic Surgery',
  'Cardiothoracic Surgery', 'Vascular Surgery', 'Plastic Surgery'
];

const App: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [rssArticles, setRssArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

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

  // View state: 'home' or 'trends'
  const [activeView, setActiveView] = useState<'home' | 'trends'>('home');

  // Load articles
  useEffect(() => {
    const loadArticles = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch pubmed data
        const { articles: pubmedData, totalPages, totalResults } = await fetchArticles(searchTerm, selectedSpecialties, apiKey, page, 10);

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
  }, [searchTerm, selectedSpecialties, page, apiKey, rssFeeds]);

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

  const toggleExpand = (id: string) => {
    setExpandedArticleId(expandedArticleId === id ? null : id);
  };

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties(prev =>
      prev.includes(specialty)
        ? prev.filter(s => s !== specialty)
        : [...prev, specialty]
    );
    setPage(1); // Reset page on filter change
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
          {/* Specialty Filters */}
          <div className="mb-8">
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
                    className={`bg-white border ${article.pmid === 'RSS' ? 'border-orange-200' : 'border-slate-200'} rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-600 mb-1">
                            {article.journal} • {article.pubDate || 'Recent'}
                          </p>
                          <h3 className="text-lg font-bold text-slate-900 leading-tight mb-2">
                            {article.title}
                          </h3>
                          <p className="text-sm text-slate-500 line-clamp-1 mb-4">
                            {article.authors.join(', ')}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {article.pmid !== 'RSS' && (
                            <a
                              href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                              title="View on PubMed"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {article.pmid === 'RSS' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              RSS Source
                            </span>
                          )}
                          <a
                            href={`https://trends.google.com/trends/explore?q=${encodeURIComponent(article.title.split(' ').slice(0, 3).join(' ').replace(/[^\w\s]/g, ''))}&hl=en-US`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 px-2 py-1 text-xs font-medium bg-red-50 text-red-600 rounded-md border border-red-100 hover:bg-red-100 transition-colors"
                            title="View Search Trends for this topic"
                          >
                            <Activity className="h-3 w-3" />
                            Trend
                          </a>
                        </div>
                      </div>

                      {/* Abstract Expansion */}
                      <button
                        onClick={() => toggleExpand(article.id)}
                        className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors mt-2"
                      >
                        {expandedArticleId === article.id ? (
                          <>Hide Abstract <ChevronUp className="h-4 w-4" /></>
                        ) : (
                          <>Show Abstract <ChevronDown className="h-4 w-4" /></>
                        )}
                      </button>

                      <AnimatePresence>
                        {expandedArticleId === article.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-4 border-t border-slate-100">
                              {article.abstract ? (
                                <div
                                  className="text-sm text-slate-700 leading-relaxed space-y-2"
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.abstract) }}
                                />
                              ) : (
                                <p className="text-sm text-slate-500 italic">No abstract available for this article.</p>
                              )}
                              <div className="mt-4 flex gap-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  PMID: {article.pmid}
                                </span>
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