import { useEffect, useState, useMemo } from 'react';
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

  if (loading && datasets.length === 0) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      <div>
        <h1 className="text-2xl font-bold mb-4">Austin Open Data Datasets ({filteredDatasets.length} found)</h1>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Search datasets..."
            className="flex-grow p-2 border rounded"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select className="p-2 border rounded" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name' | 'popularity' | 'lastUpdated')}>
            <option value="name">Sort by Name</option>
            <option value="popularity">Sort by Popularity</option>
            <option value="lastUpdated">Sort by Last Updated</option>
          </select>
        </div>
        <ul className="space-y-2 h-[calc(100vh-150px)] overflow-y-auto">
          {filteredDatasets.map((dataset) => (
            <li key={dataset.id} className="border p-2 rounded cursor-pointer hover:bg-gray-100" onClick={() => handleSelectDataset(dataset.id)}>
              <h2 className="font-semibold">{dataset.name} {dataset.isLive && <span className="text-green-600 text-xs font-bold">(LIVE)</span>}</h2>
              <p className="text-xs text-gray-500">Views: {dataset.viewCount} | Last updated: {new Date(dataset.lastUpdated).toLocaleTimeString()} : {new Date(dataset.lastUpdated).toLocaleDateString()}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-4 h-[calc(100vh-2rem)] overflow-y-auto">
        {selectedDataset && (
          <div className="border p-4 rounded h-fit">
            <h2 className="text-xl font-bold">{selectedDataset.name}</h2>
            <p className="text-sm text-gray-600 mb-2">{selectedDataset.description}</p>
            <p><strong>Last updated:</strong> {new Date(selectedDataset.lastUpdated).toLocaleTimeString()} : {new Date(selectedDataset.lastUpdated).toLocaleDateString()}</p>
            <p><strong>Rows:</strong> {selectedDataset.rows}</p>
            <p><strong>Views:</strong> {selectedDataset.viewCount}</p>
            <h3 className="font-bold mt-2">Columns:</h3>
            <ul className="list-disc pl-5">
              {selectedDataset.columns.map((col, idx) => (
                <li key={idx}><strong>{col.name}</strong>: {col.description}</li>
              ))}
            </ul>
          </div>
        )}
        <DuckDBAnalyzer dataset={selectedDataset} />
      </div>
    </div>
  );
}
