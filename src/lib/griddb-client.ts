
const GRIDDB_API_URL = process.env.GRIDDB_API_URL;
const GRIDDB_USERNAME = process.env.GRIDDB_USERNAME;
const GRIDDB_PASSWORD = process.env.GRIDDB_PASSWORD;
const GRIDDB_TIMEOUT_MS = parseInt(process.env.GRIDDB_TIMEOUT_MS || '5000');
const GRIDDB_RETRY_COUNT = parseInt(process.env.GRIDDB_RETRY_COUNT || '3');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function griddbFetch(endpoint: string, options: RequestInit) {
  if (!GRIDDB_API_URL || !GRIDDB_USERNAME || !GRIDDB_PASSWORD) {
    throw new Error("GridDB connection details are not configured in environment variables.");
  }

  const authHeader = `Basic ${Buffer.from(`${GRIDDB_USERNAME}:${GRIDDB_PASSWORD}`).toString('base64')}`;
  const url = `${GRIDDB_API_URL}/${endpoint}`;
  
  let lastError: Error | null = null;

  for (let i = 0; i < GRIDDB_RETRY_COUNT; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GRIDDB_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Authorization': authHeader,
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`GridDB API Error (Attempt ${i+1}/${GRIDDB_RETRY_COUNT}) on endpoint ${endpoint}:`, errorBody);
        lastError = new Error(`GridDB API request failed with status ${response.status}`);
        // If it's a client error (4xx), don't retry
        if (response.status >= 400 && response.status < 500) {
            throw lastError;
        }
        await sleep(500 * (i + 1)); // Exponential backoff
        continue;
      }

      // Handle cases where GridDB returns an empty success response
      const textBody = await response.text();
      try {
        return JSON.parse(textBody);
      } catch (e) {
        if (textBody === '') return {}; // Return empty object for empty success responses
        return textBody; // Return text if not valid JSON but not empty
      }
    } catch (error: any) {
        clearTimeout(timeoutId);
        lastError = error;
        if (error.name === 'AbortError') {
            console.error(`GridDB request timed out after ${GRIDDB_TIMEOUT_MS}ms. Retrying...`);
        }
        await sleep(500 * (i + 1));
    }
  }

  throw new Error(`GridDB request failed after ${GRIDDB_RETRY_COUNT} retries. Last error: ${lastError?.message}`);
}

export async function createTable(tableName: string, columns: any[]) {
    const body = {
        "container_name": tableName,
        "container_type": "COLLECTION",
        "row_key": true,
        "columns": columns
    };
    try {
        await griddbFetch(`tables`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        console.log(`Table '${tableName}' created successfully.`);
    } catch (error: any) {
        // GridDB might error if the table already exists, which is fine.
        if (error.message.includes("409")) { // 409 Conflict
            console.log(`Table '${tableName}' already exists.`);
        } else {
            // Re-throw other errors
            throw error;
        }
    }
}


export async function putRows(tableName: string, rows: any[]) {
    return griddbFetch(`tables/${tableName}/rows`, {
        method: 'PUT',
        body: JSON.stringify(rows)
    });
}

export async function getRows(tableName: string, query: string) {
    const response = await griddbFetch(`tql?query=select * from ${tableName} where ${query}`, {
        method: 'GET'
    });
    return response;
}
