import React, { useEffect, useState } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';
import { Dataset } from '../services/austinDataService';
import { fetchDatasetData } from '../services/austinDataService';

interface Props {
  dataset: Dataset | null;
}

const DuckDBAnalyzer: React.FC<Props> = ({ dataset }) => {
  const [db, setDb] = useState<duckdb.AsyncDuckDB | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [statCol, setStatCol] = useState<string>('');
  const [statType, setStatType] = useState<string>('mean_median');
  const [sortCol, setSortCol] = useState<string>('');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const isFetchingRef = React.useRef(false);

  useEffect(() => {
    const initDb = async () => {
      try {
        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
        const worker = await duckdb.createWorker(bundle.mainWorker!);
        const logger = new duckdb.ConsoleLogger();
        const dbInstance = new duckdb.AsyncDuckDB(logger, worker);
        await dbInstance.instantiate(bundle.mainModule, bundle.pthreadWorker);
        setDb(dbInstance);
        setLoading(false);
        console.log("DuckDB initialized successfully");
      } catch (err) {
        console.error("DuckDB initialization failed:", err);
        setLoading(false); // Stop loading even if it fails
      }
    };
    initDb();
  }, []);

  const runStats = async () => {
    if (isFetchingRef.current) return;
    if (!db || !dataset || !statCol) return;
    isFetchingRef.current = true;
    setLoading(true);
    const conn = await db.connect();
    try {
      const csvData = await fetchDatasetData(dataset.id, 1000);
      await db.registerFileText('data.csv', csvData);
      
      // Define columns for read_csv_auto
      const columns = (dataset.columns.length > 0 ? dataset.columns : []).reduce((acc, col) => {
        acc[col.fieldName] = col.dataType === 'number' ? 'DOUBLE' : 'VARCHAR';
        return acc;
      }, {} as Record<string, string>);
      
      let query = 'CREATE OR REPLACE TABLE dataset AS SELECT * FROM read_csv_auto("data.csv", header=true';
      if (Object.keys(columns).length > 0) {
        const colSchema = Object.entries(columns).map(([name, type]) => `"${name}": "${type}"`).join(', ');
        query += `, columns={${colSchema}}`;
      }
      query += ')';
      await conn.query(query);
      
      const col = dataset.columns.find(c => c.name === statCol);
      if (!col) return;
      const fieldName = col.fieldName;

      let statQuery = '';
      switch (statType) {
        case 'mean_median':
          statQuery = `SELECT AVG("${fieldName}") as mean, MEDIAN("${fieldName}") as median FROM dataset`;
          break;
        case 'stddev':
          statQuery = `SELECT STDDEV("${fieldName}") as stddev FROM dataset`;
          break;
        case 'value_counts':
          statQuery = `SELECT "${fieldName}", COUNT(*) as count FROM dataset GROUP BY "${fieldName}" ORDER BY count DESC LIMIT 10`;
          break;
        case 'min_max':
          statQuery = `SELECT MIN("${fieldName}") as min, MAX("${fieldName}") as max FROM dataset`;
          break;
        case 'percentile':
          statQuery = `SELECT QUANTILE("${fieldName}", 0.85) as p85 FROM dataset`;
          break;
      }
      
      const result = await conn.query(statQuery);
      setStats(result.toArray());
      setData([]); // Clear main data table
    } catch (err) {
      console.error("Stats execution failed:", err);
      setStats([{ error: "Failed to calculate stats." }]);
    } finally {
      await conn.close();
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const runQuery = async () => {
    if (isFetchingRef.current) return;
    console.log("runQuery started");
    if (!db || !dataset) return;
    isFetchingRef.current = true;
    setLoading(true);
    const conn = await db.connect();
    try {
      console.log("Fetching CSV data...");
      const csvData = await fetchDatasetData(dataset.id, 1000);
      console.log("CSV data fetched, size:", csvData.length);
      await db.registerFileText('data.csv', csvData);
      console.log("CSV data registered");
      
      // Define columns for read_csv_auto
      const columns = (dataset.columns.length > 0 ? dataset.columns : []).reduce((acc, col) => {
        acc[col.fieldName] = col.dataType === 'number' ? 'DOUBLE' : 'VARCHAR';
        return acc;
      }, {} as Record<string, string>);
      
      let query = 'CREATE OR REPLACE TABLE dataset AS SELECT * FROM read_csv_auto("data.csv", header=true';
      if (Object.keys(columns).length > 0) {
        const colSchema = Object.entries(columns).map(([name, type]) => `"${name}": "${type}"`).join(', ');
        query += `, columns={${colSchema}}`;
      }
      query += ')';
      console.log("Executing query:", query);
      await conn.query(query);
      console.log("Table created");
      
      let selectQuery = 'SELECT * FROM dataset';
      if (sortCol) {
        const col = dataset.columns.find(c => c.name === sortCol);
        if (col) {
          selectQuery += ` ORDER BY "${col.fieldName}" ${sortDir}`;
        }
      }
      
      console.log("Executing select query:", selectQuery);
      const result = await conn.query(selectQuery);
      console.log("Query result obtained");
      setData(result.toArray());
      setStats([]); // Clear stats
    } catch (err) {
      console.error("Query execution failed:", err);
      setData([{ error: "Failed to load or query data. Please check console for details." }]);
    } finally {
      await conn.close();
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-4">DuckDB WASM Analyzer</h2>
      {loading && <p>Initializing DuckDB...</p>}
      {dataset ? (
        <>
          <p className="mb-2">Selected Dataset: <strong>{dataset.name}</strong></p>
          
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex gap-2">
              <select 
                value={sortCol} 
                onChange={(e) => setSortCol(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="">Sort by column...</option>
                {dataset.columns.map(col => (
                  <option key={col.name} value={col.name}>{col.name}</option>
                ))}
              </select>
              <select 
                value={sortDir} 
                onChange={(e) => setSortDir(e.target.value as 'ASC' | 'DESC')}
                className="border p-2 rounded"
              >
                <option value="ASC">ASC</option>
                <option value="DESC">DESC</option>
              </select>
              <button 
                onClick={runQuery}
                className="bg-blue-500 text-white px-4 py-2 rounded"
                disabled={loading || !db}
              >
                {loading ? 'Initializing...' : 'Run Analysis'}
              </button>
            </div>

            <div className="flex gap-2 border-t pt-4">
              <select 
                value={statCol} 
                onChange={(e) => setStatCol(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="">Select column for stats...</option>
                {dataset.columns.map(col => (
                  <option key={col.name} value={col.name}>{col.name}</option>
                ))}
              </select>
              <select 
                value={statType} 
                onChange={(e) => setStatType(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="mean_median">Mean / Median</option>
                <option value="stddev">Std Dev</option>
                <option value="value_counts">Value Counts</option>
                <option value="min_max">Min / Max</option>
                <option value="percentile">85th Percentile</option>
              </select>
              <button 
                onClick={runStats}
                className="bg-green-500 text-white px-4 py-2 rounded"
                disabled={loading || !db || !statCol}
              >
                Run Stats
              </button>
            </div>
          </div>
          
          {/* Results display for both data and stats */}
          {(data.length > 0 || stats.length > 0) && (
            <div className="mt-4 overflow-x-auto max-h-96 border rounded">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(data.length > 0 ? data[0] : stats[0]).map((key) => (
                      <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(data.length > 0 ? data : stats).map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                          {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500">Please select a dataset to start analysis.</p>
      )}
    </div>
  );
};

export default DuckDBAnalyzer;
