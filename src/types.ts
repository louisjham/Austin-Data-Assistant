export interface Insight {
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  category: 'trend' | 'outlier' | 'correlation' | 'distribution' | 'anomaly';
  recommended_chart: 'bar' | 'line' | 'scatter' | 'pie' | 'map' | 'table';
  follow_up_question: string;
}

export interface InsightResponse {
  summary: string;
  quick_facts: string[];
  insights: Insight[];
  data_quality_notes: string[];
}
