import { useEffect, useState, useMemo } from 'react';
import { fetchDatasets, fetchDatasetMetadata, Dataset } from './services/austinDataService';

export default function App() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDatasets()
      .then((data) => {
        setDatasets(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filteredDatasets = useMemo(() => {
    return datasets.filter((dataset) =>
      (dataset.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (dataset.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [datasets, searchTerm]);

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
        <input
          type="text"
          placeholder="Search datasets..."
          className="w-full p-2 mb-4 border rounded"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <ul className="space-y-2 h-[calc(100vh-150px)] overflow-y-auto">
          {filteredDatasets.map((dataset) => (
            <li key={dataset.id} className="border p-2 rounded cursor-pointer hover:bg-gray-100" onClick={() => handleSelectDataset(dataset.id)}>
              <h2 className="font-semibold">{dataset.name} {dataset.isLive && <span className="text-green-600 text-xs font-bold">(LIVE)</span>}</h2>
            </li>
          ))}
        </ul>
      </div>
      {selectedDataset && (
        <div className="border p-4 rounded h-fit sticky top-4">
          <h2 className="text-xl font-bold">{selectedDataset.name}</h2>
          <p className="text-sm text-gray-600 mb-2">{selectedDataset.description}</p>
          <p><strong>Last Updated:</strong> {new Date(selectedDataset.lastUpdated).toLocaleString()}</p>
          <p><strong>Rows:</strong> {selectedDataset.rows}</p>
          <h3 className="font-bold mt-2">Columns:</h3>
          <ul className="list-disc pl-5">
            {selectedDataset.columns.map((col, idx) => (
              <li key={idx}><strong>{col.name}</strong>: {col.description}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
