import React, { useState, useEffect } from 'react';
import { getWriterPerformance } from '../../services/api';

const PerformanceMetric = ({ label, value, subtext }) => (
    <div className="text-center p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</p>
        <p className="text-2xl font-bold text-gray-800 mb-1">{value}</p>
        <p className="text-sm text-gray-600">{subtext}</p>
    </div>
);

const WriterPerformance = () => {
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        const response = await getWriterPerformance();
        setPerformance(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch writer performance:', err);
        setError('Failed to load performance data');
        // Set default values on error
        setPerformance({
          topWriter: { name: 'N/A', assignments: 0 },
          avgCompletion: 0,
          avgSatisfaction: 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">Writer Performance</h3>
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  const topWriterName = performance?.topWriter?.name || 'N/A';
  const topWriterCount = performance?.topWriter?.assignments || 0;
  const avgCompletion = performance?.avgCompletion || 0;
  const avgSatisfaction = performance?.avgSatisfaction || 0;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Writer Performance</h3>
          <p className="text-sm text-gray-500 mt-1">Monthly statistics</p>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <PerformanceMetric 
          label="Top Writer" 
          value={topWriterName} 
          subtext={`${topWriterCount} assignment${topWriterCount !== 1 ? 's' : ''}`} 
        />
        <PerformanceMetric 
          label="Avg. Completion" 
          value={`${avgCompletion}%`} 
          subtext="On-time delivery" 
        />
        <PerformanceMetric 
          label="Satisfaction" 
          value={avgSatisfaction > 0 ? `${avgSatisfaction}/5` : 'N/A'} 
          subtext="Client ratings" 
        />
      </div>

      <div className="mt-6 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Performance Overview</p>
            <p className="text-xs text-gray-500">
              {topWriterCount > 0 
                ? `Top performer completed ${topWriterCount} assignment${topWriterCount !== 1 ? 's' : ''} this month`
                : 'No completed assignments this month'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WriterPerformance;

