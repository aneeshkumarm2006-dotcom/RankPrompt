import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, ExternalLink, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';

const CitationsAndSources = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState([]);
  const [brandData, setBrandData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedPlatform, setSelectedPlatform] = useState('All Platforms');
  const [sortBy, setSortBy] = useState('Frequency');
  const [sortOrder, setSortOrder] = useState('Descending');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, [brandId]);

  const fetchData = async () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      setLoading(true);

      // Fetch brand data
      const brandRes = await fetch(`${API_URL}/brand/${brandId}`, {
        credentials: 'include',
      });
      if (brandRes.ok) {
        const { data } = await brandRes.json();
        setBrandData(data);
      }

      // Fetch all reports for the brand
      const reportsRes = await fetch(`${API_URL}/reports/brand/${brandId}`, {
        credentials: 'include',
      });

      if (reportsRes.ok) {
        const { data: reports } = await reportsRes.json();
        
        // Extract all sources from all reports
        const sourcesMap = {};
        reports.forEach(report => {
          if (report.reportData) {
            report.reportData.forEach(item => {
              if (Array.isArray(item.response)) {
                item.response.forEach(resp => {
                  const url = resp.details?.website || resp.details?.matchedUrl;
                  if (url) {
                    if (!sourcesMap[url]) {
                      sourcesMap[url] = {
                        url,
                        frequency: 0,
                        domain: new URL(url).hostname,
                        lastSeen: report.reportDate || report.createdAt,
                        reports: [],
                        platforms: new Set(),
                        categories: new Set()
                      };
                    }
                    sourcesMap[url].frequency++;
                    sourcesMap[url].reports.push(report._id);
                    sourcesMap[url].platforms.add(resp.src);
                    sourcesMap[url].categories.add(item.category);
                    
                    // Update last seen if this report is more recent
                    const reportDate = new Date(report.reportDate || report.createdAt);
                    const lastSeenDate = new Date(sourcesMap[url].lastSeen);
                    if (reportDate > lastSeenDate) {
                      sourcesMap[url].lastSeen = report.reportDate || report.createdAt;
                    }
                  }
                });
              }
            });
          }
        });

        // Convert to array and clean up Sets
        const sourcesArray = Object.values(sourcesMap).map(source => ({
          ...source,
          platforms: Array.from(source.platforms),
          categories: Array.from(source.categories)
        }));

        setSources(sourcesArray);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load citations');
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories and platforms
  const allCategories = ['All Categories', ...new Set(sources.flatMap(s => s.categories))];
  const allPlatforms = ['All Platforms', ...new Set(sources.flatMap(s => s.platforms))];

  // Filter sources
  const filteredSources = sources.filter(source => {
    const matchesSearch = !searchQuery || 
      source.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.domain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || 
      source.categories.includes(selectedCategory);
    const matchesPlatform = selectedPlatform === 'All Platforms' || 
      source.platforms.includes(selectedPlatform);
    
    return matchesSearch && matchesCategory && matchesPlatform;
  });

  // Sort sources
  const sortedSources = [...filteredSources].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'Frequency') {
      comparison = a.frequency - b.frequency;
    } else if (sortBy === 'Last Seen') {
      comparison = new Date(a.lastSeen) - new Date(b.lastSeen);
    }
    return sortOrder === 'Descending' ? -comparison : comparison;
  });

  // Paginate sources
  const totalPages = Math.ceil(sortedSources.length / itemsPerPage);
  const paginatedSources = sortedSources.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 bg-gray-50 dark:bg-dark-950 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400 dark:text-gray-500">Loading citations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-[#F8FAFC] dark:bg-dark-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">Citations & Sources</h1>
          {brandData && (
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">{brandData.brandName}</p>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <LinkIcon className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Understanding Citations</h3>
              <p className="text-gray-700 dark:text-purple-300 text-sm leading-relaxed">
                Citations are external websites that AI systems reference when mentioning your brand. Strong citations help establish your brand's authority and improve visibility in AI responses.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-dark-900 rounded-lg p-4 sm:p-6 mb-6 border border-gray-200 dark:border-dark-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 sm:px-4 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
              >
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Platform</label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 sm:px-4 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
              >
                {allPlatforms.map(plat => (
                  <option key={plat} value={plat}>{plat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 sm:px-4 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
              >
                <option>Frequency</option>
                <option>Last Seen</option>
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 sm:px-4 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
              >
                <option>Descending</option>
                <option>Ascending</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Search Citations</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by URL or domain..."
                className="w-full bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
              />
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Showing {paginatedSources.length} of {sortedSources.length} citations
          </div>
        </div>

        {/* Citations - Desktop Table / Mobile Cards */}
        <div className="bg-white dark:bg-dark-900 rounded-lg border border-gray-200 dark:border-dark-700 mb-6">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Source URL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Seen
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Reports
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                {paginatedSources.length > 0 ? (
                  paginatedSources.map((source, idx) => {
                    const globalIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                    return (
                      <tr key={source.url} className="hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-medium">
                          {globalIndex}
                        </td>
                        <td className="px-4 py-3 text-sm max-w-md">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-400 hover:text-primary-300 dark:text-primary-500 dark:hover:text-primary-400 flex items-center gap-1 truncate group"
                          >
                            <span className="truncate">{source.url}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {source.domain}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs font-medium">
                            {source.frequency} {source.frequency === 1 ? 'mention' : 'mentions'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatDate(source.lastSeen)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {source.reports.length}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No citations found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-200 dark:divide-dark-700">
            {paginatedSources.length > 0 ? (
              paginatedSources.map((source, idx) => {
                const globalIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                return (
                  <div key={source.url} className="p-4 hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors">
                    {/* Index & Frequency */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">#{globalIndex}</span>
                      <span className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs font-medium">
                        {source.frequency} {source.frequency === 1 ? 'mention' : 'mentions'}
                      </span>
                    </div>
                    
                    {/* Domain */}
                    <p className="text-sm text-gray-800 dark:text-white font-medium mb-2">{source.domain}</p>
                    
                    {/* URL */}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-400 hover:text-primary-300 dark:text-primary-500 dark:hover:text-primary-400 mb-3 block truncate"
                    >
                      {source.url}
                    </a>
                    
                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Last Seen</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200">{formatDate(source.lastSeen)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Reports</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200">{source.reports.length}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No citations found
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              ←
            </button>
            
            {[...Array(Math.min(totalPages, 5))].map((_, idx) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = idx + 1;
              } else if (currentPage <= 3) {
                pageNum = idx + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + idx;
              } else {
                pageNum = currentPage - 2 + idx;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 rounded text-sm ${
                    currentPage === pageNum
                      ? 'bg-primary-500 text-white'
                      : 'bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {totalPages > 5 && currentPage < totalPages - 2 && (
              <>
                <span className="text-gray-500 dark:text-gray-400">...</span>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className="px-3 py-1 bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 text-sm"
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CitationsAndSources;
