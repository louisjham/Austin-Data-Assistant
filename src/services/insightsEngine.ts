import * as duckdb from '@duckdb/duckdb-wasm';
import { fetchDatasetData, Dataset } from './austinDataService';
import { generateInsights, SoQLQuery } from './geminiService';
import { InsightResponse } from '../types';

export class AustinDataInsightsEngine {
  private db: duckdb.AsyncDuckDB;

  constructor(db: duckdb.AsyncDuckDB) {
    this.db = db;
  }

  private async loadDatasetIntoDuckDB(conn: duckdb.AsyncDuckDBConnection, dataset: Dataset) {
    const csvData = await fetchDatasetData(dataset.id, 1000);
    await this.db.registerFileText('data.csv', csvData);
    
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
  }

  private async computeAdvancedInsights(conn: duckdb.AsyncDuckDBConnection, dataset: Dataset) {
    const insights: any[] = [];
    const numericCols = dataset.columns.filter(c => c.dataType === 'number').map(c => c.fieldName);
    const categoricalCols = dataset.columns.filter(c => c.dataType !== 'number').map(c => c.fieldName);

    // --- Outlier Detection ---
    for (const col of numericCols) {
      const res = await conn.query(`
        SELECT COUNT(*) as outlier_count
        FROM (
            SELECT (ABS("${col}" - AVG("${col}") OVER()) / NULLIF(STDDEV("${col}") OVER(), 0)) as z_score
            FROM dataset
        )
        WHERE z_score > 3
      `);
      const count = Number(res.toArray()[0].outlier_count);
      if (count > 0) {
        insights.push({ type: "outlier", column: col, outlier_count: count, details: `${col} has ${count} outliers (z-score > 3)` });
      }
    }

    // --- Correlations ---
    for (let i = 0; i < numericCols.length; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        const res = await conn.query(`SELECT CORR("${numericCols[i]}", "${numericCols[j]}") as corr_val FROM dataset`);
        const corrVal = Number(res.toArray()[0].corr_val);
        if (Math.abs(corrVal) > 0.7) {
          insights.push({ type: "correlation", columns: [numericCols[i], numericCols[j]], value: corrVal.toFixed(3), details: `Strong correlation (${corrVal.toFixed(2)}) between ${numericCols[i]} and ${numericCols[j]}` });
        }
      }
    }

    // --- Distribution / Concentration ---
    for (const col of categoricalCols) {
      const res = await conn.query(`
        SELECT "${col}" as val, COUNT(*) * 1.0 / (SELECT COUNT(*) FROM dataset) as pct
        FROM dataset
        GROUP BY "${col}"
        HAVING pct > 0.5
      `);
      const top = res.toArray()[0];
      if (top) {
        insights.push({ type: "concentration", column: col, top_value: top.val, percentage: (Number(top.pct) * 100).toFixed(1), details: `${top.val} accounts for ${(Number(top.pct) * 100).toFixed(1)}% of ${col}` });
      }
    }

    // --- Aggregation Patterns ---
    for (const catCol of categoricalCols) {
      for (const numCol of numericCols) {
        const res = await conn.query(`SELECT "${catCol}" as cat, AVG("${numCol}") as avg_val FROM dataset GROUP BY "${catCol}"`);
        const data = res.toArray();
        if (data.length < 2) continue;
        
        const avgValues = data.map(d => Number(d.avg_val));
        const mean = avgValues.reduce((a, b) => a + b, 0) / avgValues.length;
        const std = Math.sqrt(avgValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / avgValues.length);
        
        if (std > mean * 0.5) {
          const max = data.reduce((prev, current) => (Number(prev.avg_val) > Number(current.avg_val) ? prev : current));
          const min = data.reduce((prev, current) => (Number(prev.avg_val) < Number(current.avg_val) ? prev : current));
          insights.push({ type: "group_variance", category: catCol, metric: numCol, top_group: max.cat, top_value: Number(max.avg_val).toFixed(2), bottom_group: min.cat, bottom_value: Number(min.avg_val).toFixed(2) });
        }
      }
    }
    return insights;
  };

  private async profileDataset(conn: duckdb.AsyncDuckDBConnection, dataset: Dataset) {
    const profile: any = {
      shape: { rows: 0, columns: dataset.columns.length },
      columns: {},
      sample_rows: []
    };

    const rowCountRes = await conn.query('SELECT COUNT(*) as count FROM dataset');
    profile.shape.rows = Number(rowCountRes.toArray()[0].count);

    const sampleRes = await conn.query('SELECT * FROM dataset LIMIT 5');
    profile.sample_rows = sampleRes.toArray();

    for (const col of dataset.columns) {
      const fieldName = col.fieldName;
      const colInfo: any = { dtype: col.dataType };

      const nullRes = await conn.query(`SELECT count(*) - count("${fieldName}") as null_count FROM dataset`);
      colInfo.null_count = Number(nullRes.toArray()[0].null_count);

      const uniqueRes = await conn.query(`SELECT count(DISTINCT "${fieldName}") as unique_count FROM dataset`);
      colInfo.unique_count = Number(uniqueRes.toArray()[0].unique_count);

      if (col.dataType === 'number') {
        const statRes = await conn.query(`SELECT AVG("${fieldName}") as mean, MEDIAN("${fieldName}") as median, MIN("${fieldName}") as min, MAX("${fieldName}") as max, STDDEV("${fieldName}") as std FROM dataset`);
        const stats = statRes.toArray()[0];
        colInfo.mean = Number(stats.mean).toFixed(2);
        colInfo.median = Number(stats.median).toFixed(2);
        colInfo.min = Number(stats.min).toFixed(2);
        colInfo.max = Number(stats.max).toFixed(2);
        colInfo.std = Number(stats.std).toFixed(2);
      } else {
        const topRes = await conn.query(`SELECT "${fieldName}" as val, COUNT(*) as count FROM dataset GROUP BY "${fieldName}" ORDER BY count DESC LIMIT 10`);
        colInfo.top_values = topRes.toArray().reduce((acc, row) => {
          acc[row.val] = Number(row.count);
          return acc;
        }, {} as Record<string, number>);
      }
      profile.columns[col.name] = colInfo;
    }
    return profile;
  }

  async getInsights(dataset: Dataset, user_question?: string): Promise<{
    profile: any,
    statistical_findings: any[],
    ai_insights: InsightResponse
  }> {
    const conn = await this.db.connect();
    try {
      await this.loadDatasetIntoDuckDB(conn, dataset);
      
      const profile = await this.profileDataset(conn, dataset);
      const stats_insights = await this.computeAdvancedInsights(conn, dataset);
      const ai_insights = await generateInsights(profile, stats_insights, user_question);
      
      return { profile, statistical_findings: stats_insights, ai_insights };
    } finally {
      await conn.close();
    }
  }
}
