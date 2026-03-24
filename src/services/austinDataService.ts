export interface Dataset {
  id: string;
  name: string;
  description: string;
  category: string;
  attribution: string;
  lastUpdated: string;
  rows: number;
  columns: { name: string; description: string }[];
  isLive: boolean;
}

const BASE_URL = 'https://data.austintexas.gov/api/views';

export async function fetchDatasets(): Promise<Dataset[]> {
  try {
    const response = await fetch(`${BASE_URL}.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch datasets: ${response.statusText}`);
    }
    const data = await response.json();
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      attribution: item.attribution,
      lastUpdated: item.rowsUpdatedAt,
      rows: item.rows,
      columns: [], // Will be populated by fetchDatasetMetadata
      isLive: item.rowsUpdatedAt ? (Date.now() - new Date(item.rowsUpdatedAt).getTime() < 86400000) : false,
    }));
  } catch (error) {
    console.error('Error fetching datasets:', error);
    throw error;
  }
}

export async function fetchDatasetMetadata(id: string): Promise<Dataset> {
  try {
    const response = await fetch(`${BASE_URL}/${id}.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata for ${id}: ${response.statusText}`);
    }
    const data = await response.json();
    
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      category: data.category,
      attribution: data.attribution,
      lastUpdated: data.rowsUpdatedAt,
      rows: data.rows,
      columns: data.columns.map((col: any) => ({
        name: col.name,
        description: col.description || 'No description available',
      })),
      isLive: data.rowsUpdatedAt ? (Date.now() - new Date(data.rowsUpdatedAt).getTime() < 86400000) : false,
    };
  } catch (error) {
    console.error(`Error fetching metadata for ${id}:`, error);
    throw error;
  }
}
