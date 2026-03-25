export interface Column {
  name: string;
  description: string;
  isComplete: boolean;
  dataType: string;
  fieldName: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  category: string;
  attribution: string;
  lastUpdated: string;
  rows: number;
  columns: Column[];
  isLive: boolean;
  viewCount: number;
}

const BASE_URL = 'https://data.austintexas.gov/api/views';
const CACHE_KEY = 'austin_datasets_cache_v2';
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

export async function fetchDatasets(): Promise<Dataset[]> {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data;
    }
  }

  try {
    const response = await fetch(`${BASE_URL}.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch datasets: ${response.statusText}`);
    }
    const data = await response.json();
    const datasets: Dataset[] = data.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      attribution: item.attribution,
      lastUpdated: typeof item.rowsUpdatedAt === 'number' ? new Date(item.rowsUpdatedAt * 1000).toISOString() : item.rowsUpdatedAt,
      rows: item.rows,
      columns: [], // Will be populated by fetchDatasetMetadata
      isLive: item.rowsUpdatedAt ? (Date.now() - new Date(typeof item.rowsUpdatedAt === 'number' ? item.rowsUpdatedAt * 1000 : item.rowsUpdatedAt).getTime() < 86400000) : false,
      viewCount: item.viewCount || 0,
    }));

    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: datasets, timestamp: Date.now() }));
    return datasets;
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
      lastUpdated: typeof data.rowsUpdatedAt === 'number' ? new Date(data.rowsUpdatedAt * 1000).toISOString() : data.rowsUpdatedAt,
      rows: data.rows,
      columns: (data.columns || []).map((col: any) => {
        const name = col.name || 'Unnamed Column';
        const description = col.description || 'No description available';
        return {
          name,
          description,
          isComplete: name !== 'Unnamed Column' && description !== 'No description available',
          dataType: col.dataTypeName || 'text',
          fieldName: col.fieldName || name,
        };
      }),
      isLive: data.rowsUpdatedAt ? (Date.now() - new Date(typeof data.rowsUpdatedAt === 'number' ? data.rowsUpdatedAt * 1000 : data.rowsUpdatedAt).getTime() < 86400000) : false,
      viewCount: data.viewCount || 0,
    };
  } catch (error) {
    console.error(`Error fetching metadata for ${id}:`, error);
    throw error;
  }
}

export async function fetchDatasetData(id: string, limit: number = 1000): Promise<string> {
  const url = `https://data.austintexas.gov/resource/${id}.csv?$limit=${limit}`;
  console.log('Fetching URL:', url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',        // Explicitly tells SW not to cache
      headers: {
        'Cache-Control': 'no-cache',   // Belt and suspenders
        'Pragma': 'no-cache',
      }
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch data for ${id} from ${url}`);
    }
    const csvData = await response.text();
    
    // Validate we got real data
    console.log('CSV size:', csvData.length);
    if (csvData.length < 100) {
      throw new Error(`Response too small to be valid CSV: ${csvData.length} bytes`);
    }
    
    return csvData;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`Error fetching data for ${id} from ${url}:`, error);
    throw error;
  }
}
