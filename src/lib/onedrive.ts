import { Client } from "@microsoft/microsoft-graph-client";

export function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// Retry helper for transient Graph API errors (503, 429, 500)
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const graphError = error as { statusCode?: number; headers?: Record<string, string> };
      const status = graphError.statusCode;
      const isRetryable = status === 503 || status === 429 || status === 500;

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Respect Retry-After header for 429, otherwise exponential backoff
      let delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      if (status === 429 && graphError.headers?.["retry-after"]) {
        delayMs = parseInt(graphError.headers["retry-after"]) * 1000 || delayMs;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Retry exhausted"); // unreachable but satisfies TS
}

// List children of a folder by path (relative to OneDrive root)
// Returns empty array if folder doesn't exist (404) or is temporarily unavailable (503)
export async function listFolder(
  accessToken: string,
  folderPath: string
): Promise<DriveItem[]> {
  const client = getGraphClient(accessToken);
  const encodedPath = encodeURIComponent(folderPath).replace(/%2F/g, "/");
  try {
    const result = await withRetry(() =>
      client.api(`/me/drive/root:/${encodedPath}:/children`).get()
    );
    return result.value;
  } catch (error: unknown) {
    const graphError = error as { statusCode?: number; body?: string; message?: string; code?: string };
    // 404 = folder doesn't exist yet (fresh account, no jobs created)
    // 503 = transient unavailability after retries exhausted
    if (graphError.statusCode === 404 || graphError.statusCode === 503) {
      console.warn(`[OneDrive] listFolder returned ${graphError.statusCode} for "${folderPath}" — returning empty list`);
      return [];
    }
    console.error(`[OneDrive] listFolder failed:`, {
      status: graphError.statusCode,
      message: graphError.message,
      code: graphError.code,
      body: typeof graphError.body === 'string' ? graphError.body.slice(0, 500) : graphError.body,
      folderPath,
      tokenPrefix: accessToken ? accessToken.slice(0, 10) + '...' : 'MISSING',
    });
    throw error;
  }
}

// Create a folder at the given parent path (409 = already exists, treated as success)
export async function createFolder(
  accessToken: string,
  parentPath: string,
  folderName: string
): Promise<DriveItem> {
  const client = getGraphClient(accessToken);
  const encodedPath = encodeURIComponent(parentPath).replace(/%2F/g, "/");
  try {
    return await withRetry(() =>
      client.api(`/me/drive/root:/${encodedPath}:/children`).post({
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      })
    );
  } catch (error: unknown) {
    const graphError = error as { statusCode?: number; body?: string; message?: string };
    // 409 = folder already exists — not an error for our use case
    if (graphError.statusCode === 409) {
      console.log(`[OneDrive] Folder already exists: ${parentPath}/${folderName}`);
      // Return the existing folder metadata
      const existing = await withRetry(() =>
        client.api(`/me/drive/root:/${encodedPath}/${encodeURIComponent(folderName)}`).get()
      );
      return existing;
    }
    console.error(`[OneDrive] createFolder failed:`, {
      status: graphError.statusCode,
      message: graphError.message,
      body: graphError.body,
      parentPath,
      folderName,
    });
    throw error;
  }
}

// Upload a file (up to 4MB) to a folder path
export async function uploadFile(
  accessToken: string,
  folderPath: string,
  fileName: string,
  content: ArrayBuffer | string
): Promise<DriveItem> {
  const client = getGraphClient(accessToken);
  const filePath = `${folderPath}/${fileName}`;
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, "/");
  return client
    .api(`/me/drive/root:/${encodedPath}:/content`)
    .put(content);
}

// Download a file's content by path
export async function downloadFile(
  accessToken: string,
  filePath: string
): Promise<ArrayBuffer> {
  const client = getGraphClient(accessToken);
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, "/");
  return withRetry(() =>
    client.api(`/me/drive/root:/${encodedPath}:/content`).get()
  );
}

// Read a JSON file from OneDrive and parse it
export async function readJsonFile<T>(
  accessToken: string,
  filePath: string
): Promise<T | null> {
  try {
    const client = getGraphClient(accessToken);
    const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, "/");
    const response = await withRetry(() =>
      client.api(`/me/drive/root:/${encodedPath}:/content`).get()
    );

    if (typeof response === "string") {
      return JSON.parse(response) as T;
    }
    // If response is ArrayBuffer, convert to string
    const text = new TextDecoder().decode(response);
    return JSON.parse(text) as T;
  } catch (error: unknown) {
    const graphError = error as { statusCode?: number; body?: string; message?: string; code?: string };
    if (graphError.statusCode === 404 || graphError.statusCode === 503) {
      return null;
    }
    console.error(`[OneDrive] readJsonFile failed:`, {
      status: graphError.statusCode,
      message: graphError.message,
      code: graphError.code,
      body: typeof graphError.body === 'string' ? graphError.body.slice(0, 500) : graphError.body,
      filePath,
      tokenPrefix: accessToken ? accessToken.slice(0, 10) + '...' : 'MISSING',
    });
    throw error;
  }
}

// Write a JSON file to OneDrive
export async function writeJsonFile(
  accessToken: string,
  filePath: string,
  data: unknown
): Promise<DriveItem> {
  const client = getGraphClient(accessToken);
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, "/");
  const content = JSON.stringify(data, null, 2);
  try {
    return await withRetry(() =>
      client.api(`/me/drive/root:/${encodedPath}:/content`).put(content)
    );
  } catch (error: unknown) {
    const graphError = error as { statusCode?: number; body?: string; message?: string };
    console.error(`[OneDrive] writeJsonFile failed:`, {
      status: graphError.statusCode,
      message: graphError.message,
      body: graphError.body,
      filePath,
    });
    throw error;
  }
}

// Check if a file/folder exists
export async function itemExists(
  accessToken: string,
  path: string
): Promise<boolean> {
  try {
    const client = getGraphClient(accessToken);
    const encodedPath = encodeURIComponent(path).replace(/%2F/g, "/");
    await withRetry(() => client.api(`/me/drive/root:/${encodedPath}`).get());
    return true;
  } catch {
    return false;
  }
}

// Create job folder structure: {rootPath}/{jobCode} - {address}/Quotes/
export async function createJobFolders(
  accessToken: string,
  rootPath: string,
  jobCode: string,
  address: string
): Promise<void> {
  const folderName = `${jobCode} - ${address}`;
  await createFolder(accessToken, rootPath, folderName);
  await createFolder(accessToken, `${rootPath}/${folderName}`, "Quotes");
}

// Browse OneDrive folders by item ID (root if no ID provided)
// Used by the folder picker component
export async function browseFolders(
  accessToken: string,
  folderId?: string
): Promise<{ current: { id: string; name: string; path: string }; folders: DriveItem[] }> {
  const client = getGraphClient(accessToken);

  // Get current folder metadata
  const currentApi = folderId
    ? `/me/drive/items/${folderId}`
    : "/me/drive/root";
  const current = await withRetry(() => client.api(currentApi).get());

  // Get children (folders only)
  const childrenApi = folderId
    ? `/me/drive/items/${folderId}/children?$filter=folder ne null&$orderby=name`
    : "/me/drive/root/children?$filter=folder ne null&$orderby=name";
  const result = await withRetry(() => client.api(childrenApi).get());

  const pathDisplay = current.parentReference?.path
    ? current.parentReference.path.replace("/drive/root:", "") + "/" + current.name
    : "/";

  return {
    current: {
      id: current.id,
      name: current.name || "OneDrive",
      path: pathDisplay === "/" ? "/" : pathDisplay,
    },
    folders: result.value || [],
  };
}

// Get the OneDrive path string from a folder ID (for saving to settings)
export async function getFolderPath(
  accessToken: string,
  folderId: string
): Promise<string> {
  const client = getGraphClient(accessToken);
  const item = await withRetry(() => client.api(`/me/drive/items/${folderId}`).get());
  const parentPath = item.parentReference?.path?.replace("/drive/root:", "") || "";
  return parentPath ? `${parentPath}/${item.name}`.replace(/^\//, "") : item.name;
}

// Graph API DriveItem type (simplified)
export interface DriveItem {
  id: string;
  name: string;
  size?: number;
  folder?: { childCount: number };
  file?: { mimeType: string };
  lastModifiedDateTime?: string;
  webUrl?: string;
  "@microsoft.graph.downloadUrl"?: string;
}
