const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const defaultApiBaseUrl =
  typeof window !== "undefined" && window.location.hostname
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000";
export const API_BASE_URL = (configuredBaseUrl || defaultApiBaseUrl).replace(/\/+$/, "");

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    const detail = record.detail ?? record.message ?? record.error;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
  return response.text();
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
    });
    const payload = await parseResponse(response);

    if (!response.ok) {
      throw new ApiError(
        getErrorMessage(payload, `The server returned ${response.status}.`),
        response.status,
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("The server took too long to respond. Please try again.");
    }
    throw new ApiError("Could not reach the assessment server. Check your connection and try again.");
  } finally {
    window.clearTimeout(timeout);
  }
}

export function uploadForm<T>(
  path: string,
  formData: FormData,
  onProgress?: (progress: number) => void,
) {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    xhr.responseType = "text";
    xhr.timeout = 120_000;
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let payload: unknown = xhr.responseText;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        payload = xhr.responseText;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(getErrorMessage(payload, `The server returned ${xhr.status}.`), xhr.status));
        return;
      }

      resolve(payload as T);
    };

    xhr.onerror = () => reject(new ApiError("Could not reach the assessment server. Check your connection and try again."));
    xhr.ontimeout = () => reject(new ApiError("The upload timed out. Please try recording again."));
    xhr.onabort = () => reject(new ApiError("The upload was cancelled."));
    xhr.send(formData);
  });
}