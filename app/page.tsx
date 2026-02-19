'use client';

import { useEffect, useState } from 'react';

interface Trend {
  query: string;
  search_volume: number;
  increase_percentage: number;
  categories: Array<{
    id: number;
    name: string;
  }>;
}

interface ApiResponse {
  success: boolean;
  data: {
    trends: Trend[];
    count: number;
  };
  error?: string;
}

export default function Home() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/trends')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data.trends) {
          setTrends(data.data.trends);
        } else {
          setError(data.error || 'Failed to load trends');
        }
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch trends');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl text-gray-200">Loading trends...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-white">Google Trends - Live Data</h1>
        
        <div className="grid gap-4">
          {trends.map((trend, index) => (
            <div 
              key={index} 
              className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <h2 className="text-xl font-semibold mb-2 text-white">{trend.query}</h2>
              
              <div className="flex gap-4 text-sm text-gray-300">
                <span>
                  🔥 {trend.search_volume?.toLocaleString() || 'N/A'} searches
                </span>
                <span>
                  📈 +{trend.increase_percentage}%
                </span>
              </div>
              
              {trend.categories && trend.categories.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {trend.categories.map((cat, i) => (
                    <span 
                      key={cat.id || i}
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm border border-blue-500/30"
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-400">
          Showing {trends.length} trending topics
        </div>
      </div>
    </div>
  );
}
