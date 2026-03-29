import React, { useEffect, useState } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';
import { motion, AnimatePresence } from 'motion/react';
import { Dataset } from '../services/austinDataService';
import { AustinDataInsightsEngine } from '../services/insightsEngine';

interface Props {
  dataset: Dataset | null;
}

const DuckDBAnalyzer: React.FC<Props> = ({ dataset }) => {
  const [db, setDb] = useState<duckdb.AsyncDuckDB | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing DuckDB...');
  const [stats, setStats] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<any | null>(null);
  const [sortCol, setSortCol] = useState<string>('');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const isFetchingRef = React.useRef(false);

  useEffect(() => {
    const initDb = async () => {
      try {
        setLoadingMessage('Initializing DuckDB...');
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
        setLoading(false);
      }
    };
    initDb();
  }, []);

  const runProfile = async () => {
    if (isFetchingRef.current || !db || !dataset) return;
    isFetchingRef.current = true;
    setLoading(true);
    setLoadingMessage('AI is analyzing the dataset and generating insights...');
    try {
      const engine = new AustinDataInsightsEngine(db);
      const results = await engine.getInsights(dataset);
      
      setStats([results.profile, ...results.statistical_findings]);
      setAiInsights(results.ai_insights);
      setData([]); // Clear main data table
    } catch (err) {
      console.error("Profile execution failed:", err);
      setStats([{ error: "Failed to profile dataset." }]);
      setAiInsights(null);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const runQuery = async () => {
    if (isFetchingRef.current || !db || !dataset) return;
    isFetchingRef.current = true;
    setLoading(true);
    setLoadingMessage('Querying data...');
    const conn = await db.connect();
    try {
      // Re-load data for query
      const { fetchDatasetData } = await import('../services/austinDataService');
      const csvData = await fetchDatasetData(dataset.id, 1000);
      await db.registerFileText('data.csv', csvData);
      
      let query = 'CREATE OR REPLACE TABLE dataset AS SELECT * FROM read_csv_auto("data.csv", header=true, ignore_errors=true, null_padding=true)';
      await conn.query(query);
      
      let selectQuery = 'SELECT * FROM dataset';
      if (sortCol) {
        const col = dataset.columns.find(c => c.name === sortCol);
        if (col) {
          selectQuery += ` ORDER BY "${col.fieldName}" ${sortDir}`;
        }
      }
      
      const result = await conn.query(selectQuery);
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
    <div className="p-4 border border-gray-700 rounded-lg bg-gray-800/50">
      <h2 className="text-xl font-bold mb-4 text-cyan-300">Explore Data</h2>
      
      {loading && (
        <div className="flex items-center gap-3 mb-4 p-4 bg-gray-900/80 rounded-lg border border-cyan-500/30">
          <div className="w-6 h-6 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-cyan-400 font-medium animate-pulse">{loadingMessage}</p>
        </div>
      )}

      {dataset ? (
        <>
          <p className="mb-4 text-gray-300">Selected Dataset: <strong className="text-white">{dataset.name}</strong></p>
          
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-wrap gap-2">
              <select 
                value={sortCol} 
                onChange={(e) => setSortCol(e.target.value)}
                className="border border-gray-600 bg-gray-900 text-white p-2 rounded focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                disabled={loading}
              >
                <option value="">Sort by column...</option>
                {dataset.columns.map(col => (
                  <option key={col.name} value={col.name}>{col.name}</option>
                ))}
              </select>
              <select 
                value={sortDir} 
                onChange={(e) => setSortDir(e.target.value as 'ASC' | 'DESC')}
                className="border border-gray-600 bg-gray-900 text-white p-2 rounded focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                disabled={loading}
              >
                <option value="ASC">ASC</option>
                <option value="DESC">DESC</option>
              </select>
              <button 
                onClick={runQuery}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !db}
              >
                Sort it!
              </button>
            </div>

            <div className="flex gap-2 border-t border-gray-700 pt-4">
              <button 
                onClick={runProfile}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={loading || !db}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                Get AI Insights
              </button>
            </div>
          </div>
          
          {/* Results display for both data and stats */}
          {(data.length > 0 || stats.length > 0 || aiInsights) && (
            <div className="mt-4 overflow-x-auto max-h-[600px] border border-gray-700 rounded bg-gray-900 p-4 custom-scrollbar relative">
              <AnimatePresence mode="wait">
                {aiInsights && (
                  <motion.div 
                    key="insights"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-6 bg-gray-900 p-8 rounded-2xl border border-purple-500/30 shadow-[0_0_40px_rgba(168,85,247,0.15)] relative overflow-hidden min-h-[300px] flex flex-col justify-center"
                  >
                    {/* Magic 8 ball inner shadow/glow effect */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.15)_0%,transparent_70%)] pointer-events-none"></div>
                    <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                      <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={{
                          hidden: { opacity: 0 },
                          visible: {
                            opacity: 1,
                            transition: {
                              staggerChildren: 0.6,
                              delayChildren: 0.3
                            }
                          }
                        }}
                        className="max-w-3xl mx-auto"
                      >
                        <motion.p 
                          variants={{
                            hidden: { opacity: 0, y: 40, filter: 'blur(10px)', scale: 0.9 },
                            visible: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, transition: { duration: 1.5, ease: "easeOut" } }
                          }}
                          className="mb-8 text-gray-100 leading-relaxed text-xl text-center font-medium"
                        >
                          "{aiInsights.summary}"
                        </motion.p>
                        
                        {aiInsights.quick_facts && aiInsights.quick_facts.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            {aiInsights.quick_facts.map((fact: string, i: number) => (
                              <motion.div
                                key={`fact-${i}`}
                                variants={{
                                  hidden: { opacity: 0, scale: 0.8, filter: 'blur(5px)' },
                                  visible: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.8, ease: "easeOut" } }
                                }}
                                className="p-4 bg-cyan-900/20 border-l-4 border-cyan-500 rounded-r-lg shadow-sm flex items-center gap-3"
                              >
                                <div className="text-cyan-400">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                </div>
                                <p className="text-gray-200 font-medium">{fact}</p>
                              </motion.div>
                            ))}
                          </div>
                        )}
                        
                        <div className="grid gap-4 mb-4">
                          {aiInsights.insights.map((insight: any, i: number) => (
                            <motion.div 
                              key={i} 
                              variants={{
                                hidden: { opacity: 0, y: 30, filter: 'blur(8px)' },
                                visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 1.2, ease: "easeOut" } }
                              }}
                              className="p-5 bg-purple-900/30 rounded-xl border border-purple-500/20 text-gray-200 shadow-inner backdrop-blur-sm"
                            >
                              {insight.details}
                            </motion.div>
                          ))}
                        </div>
                        
                        {aiInsights.data_quality_notes && (
                          <motion.div 
                            variants={{
                              hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
                              visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 1.2, ease: "easeOut" } }
                            }}
                            className="mt-8 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-sm text-yellow-200 text-center"
                          >
                            <strong className="text-yellow-400">Data Quality Note:</strong> {aiInsights.data_quality_notes}
                          </motion.div>
                        )}
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {data.length > 0 && !aiInsights && (
                <div>
                  <h3 className="text-lg font-bold mb-3 text-cyan-400">Data Preview</h3>
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                      <tr>
                        {Object.keys(data[0]).map((key) => (
                          <th key={key} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-gray-900 divide-y divide-gray-800">
                      {data.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                              {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
