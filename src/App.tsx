import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fireworks } from '@fireworks-js/react';
import { fetchDatasets, fetchDatasetMetadata, Dataset } from './services/austinDataService';
import { SPECIAL_DATASET_IDS } from './constants';
import DuckDBAnalyzer from './components/DuckDBAnalyzer';

export default function App() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'popularity' | 'lastUpdated'>('name');
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isIdle, setIsIdle] = useState<boolean>(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleActivity = () => {
      setIsIdle(false);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsIdle(true), 7000);
    };

    // Initialize timer
    handleActivity();

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [allDatasets, ...specialDatasets] = await Promise.all([
          fetchDatasets(),
          ...SPECIAL_DATASET_IDS.map(id => fetchDatasetMetadata(id))
        ]);

        const datasetMap = new Map(allDatasets.map(d => [d.id, d]));
        specialDatasets.forEach(d => datasetMap.set(d.id, d));
        
        setDatasets(Array.from(datasetMap.values()));
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const filteredDatasets = useMemo(() => {
    let filtered = datasets.filter((dataset) =>
      (dataset.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (dataset.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortBy === 'popularity') {
      filtered = filtered.sort((a, b) => b.viewCount - a.viewCount);
    } else if (sortBy === 'lastUpdated') {
      filtered = filtered.sort((a, b) => {
        const dateA = new Date(a.lastUpdated).getTime();
        const dateB = new Date(b.lastUpdated).getTime();
        if (isNaN(dateA) || isNaN(dateB)) return 0;
        return dateB - dateA;
      });
    } else {
      filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [datasets, searchTerm, sortBy]);

  const handleSelectDataset = async (id: string) => {
    setLoading(true);
    try {
      const metadata = await fetchDatasetMetadata(id);
      setSelectedDataset(metadata);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && datasets.length === 0) return <div className="text-white">Loading...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-black text-white relative">
      <img
        src="https://images.unsplash.com/photo-1531218150217-54595bc2b934?q=80&w=1920&auto=format&fit=crop"
        alt="Austin Skyline"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
        referrerPolicy="no-referrer"
      />

      {isIdle && (
        <Fireworks
          options={{
            opacity: 0.5,
            particles: 150,
            explosion: 7,
            intensity: 30,
            traceSpeed: 3,
          }}
          style={{
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            position: 'absolute',
            zIndex: 0,
            pointerEvents: 'none'
          }}
        />
      )}

      <div className="relative z-10 p-6 md:p-12">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <motion.h1 
            className="text-5xl font-bold mb-4 sparkle-text"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Austin Open Data Assistant
          </motion.h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Explore, analyze, and gain insights from Austin's vast collection of open data. 
            Search for datasets below to get started.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!selectedDataset ? (
            <motion.div
              key="search-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ duration: 0.3 }}
            >
              <div className="max-w-2xl mx-auto mb-12">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search datasets (e.g., 'parking', 'trees')..."
                    className="flex-grow p-4 border-2 border-gray-700 bg-gray-900 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <select className="p-4 border-2 border-gray-700 bg-gray-900 rounded-lg text-lg" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name' | 'popularity' | 'lastUpdated')}>
                    <option value="name">Sort by Name</option>
                    <option value="popularity">Sort by Popularity</option>
                    <option value="lastUpdated">Sort by Last Updated</option>
                  </select>
                </div>
              </div>

              {searchTerm && (
                <div className="max-w-4xl mx-auto">
                  <p className="text-gray-400 mb-4">{filteredDatasets.length} datasets found</p>
                  <ul className="space-y-4">
                    {filteredDatasets.slice(0, 10).map((dataset) => (
                      <li key={dataset.id} className="bg-gray-900 border-l-4 border-cyan-500 p-4 rounded shadow hover:shadow-md cursor-pointer transition" onClick={() => handleSelectDataset(dataset.id)}>
                        <h2 className="text-lg font-semibold text-cyan-300">{dataset.name} {dataset.isLive && <span className="text-green-400 text-xs font-bold">(LIVE)</span>}</h2>
                        <p className="text-sm text-gray-300">{dataset.description?.substring(0, 150)}...</p>
                      </li>
                    ))}
                    {filteredDatasets.length > 10 && <li className="text-center text-gray-500">...and {filteredDatasets.length - 10} more. Refine your search.</li>}
                  </ul>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="dataset-view"
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.4, type: 'spring', bounce: 0.3 }}
              className="max-w-4xl mx-auto bg-gray-900 p-8 rounded-xl shadow-2xl border border-gray-700 relative"
            >
              <button 
                onClick={() => setSelectedDataset(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-2 rounded-full transition-colors"
                title="Back to search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
              <h2 className="text-3xl font-bold text-cyan-300 mb-4 pr-12">{selectedDataset.name}</h2>
              <p className="text-gray-300 mb-6">{selectedDataset.description}</p>
              <div className="grid grid-cols-2 gap-4 text-sm mb-8 bg-black/50 p-4 rounded-lg">
                <p><strong>Last updated:</strong> {new Date(selectedDataset.lastUpdated).toLocaleDateString()}</p>
                <p><strong>Rows:</strong> {selectedDataset.rows}</p>
                <p><strong>Views:</strong> {selectedDataset.viewCount}</p>
              </div>
              <DuckDBAnalyzer dataset={selectedDataset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
