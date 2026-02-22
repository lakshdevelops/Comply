import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * Creates an axios instance with exponential backoff retry logic
 */
export function createHttpClient(baseURL?: string, timeout = 30000): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout,
    headers: {
      'User-Agent': 'Legal-Compliance-MCP/1.0.0',
    },
  });

  // Retry interceptor with exponential backoff
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as any;
      
      // Don't retry if retry count is already set and exceeded
      if (config && config.__retryCount >= 3) {
        return Promise.reject(error);
      }

      // Don't retry on 4xx errors (client errors)
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        return Promise.reject(error);
      }

      // Set retry count
      config.__retryCount = config.__retryCount || 0;
      config.__retryCount += 1;

      // Calculate delay: 1s, 2s, 4s
      const delay = Math.pow(2, config.__retryCount - 1) * 1000;

      await new Promise((resolve) => setTimeout(resolve, delay));

      return client(config);
    }
  );

  return client;
}

