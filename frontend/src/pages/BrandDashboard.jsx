import { useState, useEffect } from 'react';
import { useParams, Routes, Route, Navigate } from 'react-router-dom';
import BrandSidebar from '../components/BrandSidebar';
import PerformanceSummary from '../components/PerformanceSummary';
import AllPrompts from './AllPrompts';
import BrandReports from './BrandReports';
import BrandScheduledReports from './BrandScheduledReports';
import CitationsAndSources from './CitationsAndSources';
import toast from 'react-hot-toast';

const BrandDashboard = () => {
  const { brandId } = useParams();
  const [brandData, setBrandData] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBrandData();
    fetchBrandReports();
  }, [brandId]);

  const fetchBrandData = async () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/brand/${brandId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const { data } = await response.json();
        setBrandData(data);
      }
    } catch (error) {
      console.error('Error fetching brand:', error);
      toast.error('Error loading brand data');
    }
  };

  const fetchBrandReports = async () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/reports/brand/${brandId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const { data } = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#F8FAFC]">
        <BrandSidebar brandData={brandData} />
        <div className="flex-1 lg:ml-64 mt-16 lg:mt-0 flex items-center justify-center">
          <div className="text-gray-800 text-xl">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] overflow-x-hidden">
      <BrandSidebar brandData={brandData} />
      <div className="flex-1 lg:ml-64 mt-16 lg:mt-0 overflow-x-hidden">
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PerformanceSummary brandData={brandData} reports={reports} />} />
          <Route path="prompts" element={<AllPrompts />} />
          <Route path="reports" element={<BrandReports />} />
          <Route path="scheduled" element={<BrandScheduledReports />} />
          <Route path="citations" element={<CitationsAndSources />} />
        </Routes>
      </div>
    </div>
  );
};

export default BrandDashboard;