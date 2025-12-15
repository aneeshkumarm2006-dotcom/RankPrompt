import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, Edit, ExternalLink, Calendar, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';

const MyBrands = () => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [editingBrand, setEditingBrand] = useState(null);
  const [deletingBrand, setDeletingBrand] = useState(null);

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/brand/list`, {
        credentials: 'include',
      });

      if (response.ok) {
        const { data } = await response.json();
        setBrands(data);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast.error('Error loading brands');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBrand = async (brandId) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/brand/${brandId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Brand and all its reports deleted successfully');
        setBrands(brands.filter(b => b._id !== brandId));
        setDeletingBrand(null);
      } else {
        toast.error('Failed to delete brand');
      }
    } catch (error) {
      console.error('Error deleting brand:', error);
      toast.error('Error deleting brand');
    }
  };

  const handleEditBrand = async (brandId, newData) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/brand/${brandId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newData),
      });

      if (response.ok) {
        toast.success('Brand updated successfully');
        fetchBrands();
        setEditingBrand(null);
      } else {
        toast.error('Failed to update brand');
      }
    } catch (error) {
      console.error('Error updating brand:', error);
      toast.error('Error updating brand');
    }
  };

  const filteredBrands = brands.filter(brand =>
    brand.brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    brand.websiteUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedBrands = [...filteredBrands].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    return 0;
  });

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-dark-950">
        <Sidebar />
        <div className="flex-1 lg:ml-64 mt-16 lg:mt-0 flex items-center justify-center">
          <div className="text-gray-800 dark:text-gray-200 text-xl">Loading brands...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-950">
      <Sidebar />
      <div className="flex-1 lg:ml-64 mt-16 lg:mt-0 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">My Brands</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage your brands and their visibility reports</p>
            </div>
            <button
              onClick={() => navigate('/reports/new')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Brand
            </button>
          </div>

          {/* Search and Sort */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search by brand name or website..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {/* Brands Grid */}
          {sortedBrands.length === 0 ? (
            <div className="bg-white dark:bg-dark-900 rounded-lg p-12 text-center border border-gray-200 dark:border-dark-700">
              <Building2 className="w-16 h-16 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No Brands Yet</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first brand to start tracking visibility</p>
              <button
                onClick={() => navigate('/reports/new')}
                className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Create New Brand
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedBrands.map((brand) => (
                <div
                  key={brand._id}
                  className="bg-white dark:bg-dark-900 rounded-lg p-6 border border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600 transition-all"
                >
                  {/* Brand Header */}
                  <div className="flex items-start gap-3 mb-4">
                    {brand.favicon ? (
                      <img
                        src={brand.favicon}
                        alt={brand.brandName}
                        className="w-12 h-12 rounded-lg flex-shrink-0"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary-500 flex items-center justify-center text-white font-bold text-xl">
                        {brand.brandName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1 truncate">
                        {brand.brandName}
                      </h3>
                      <a
                        href={brand.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1 truncate"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        {brand.websiteUrl.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3 mb-4">
                    {brand.lastReportVisibility !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-800 dark:text-gray-300 text-sm">Visibility</span>
                        <span className="text-green-400 font-semibold">
                          {brand.lastReportVisibility}%
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <Calendar className="w-3 h-3" />
                      Created {new Date(brand.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/brands/${brand._id}/dashboard`)}
                      className="flex-1 px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => setEditingBrand(brand)}
                      className="px-3 py-2 bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600"
                      title="Edit Brand"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingBrand(brand)}
                      className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      title="Delete Brand"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Brand Modal */}
      {editingBrand && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Edit Brand</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                handleEditBrand(editingBrand._id, {
                  brandName: formData.get('brandName'),
                  websiteUrl: formData.get('websiteUrl'),
                });
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    name="brandName"
                    defaultValue={editingBrand.brandName}
                    required
                    className="w-full px-4 py-2 bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Website URL
                  </label>
                  <input
                    type="url"
                    name="websiteUrl"
                    defaultValue={editingBrand.websiteUrl}
                    required
                    className="w-full px-4 py-2 bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingBrand(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBrand && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Delete Brand</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Are you sure you want to delete <strong>{deletingBrand.brandName}</strong>?
            </p>
            <p className="text-red-400 text-sm mb-6">
              This will permanently delete the brand and all its reports. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingBrand(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteBrand(deletingBrand._id)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete Brand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBrands;
