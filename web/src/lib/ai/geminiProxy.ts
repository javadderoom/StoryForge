import { ProxyAgent, setGlobalDispatcher } from 'undici';

let _geminiProxyAgent: ProxyAgent | null = null;
let _isProxyInitialized = false;

/**
 * Returns true if the application is running in local development mode.
 */
export function isLocalEnvironment(): boolean {
  if (process.env.VERCEL === '1') return false;
  if (process.env.NODE_ENV === 'production') return false;
  return true;
}

/**
 * Resolves the local HTTPS proxy URL.
 * Defaults to http://127.0.0.1:10808 when in local mode.
 */
export function getLocalGeminiProxyUrl(): string | null {
  if (!isLocalEnvironment()) {
    return null;
  }
  // Allow disabling via environment variable if needed
  if (process.env.LOCAL_PROXY_ENABLED === 'false' || process.env.USE_GEMINI_PROXY === 'false') {
    return null;
  }
  const port = process.env.GEMINI_PROXY_PORT || '10808';
  return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || `http://127.0.0.1:${port}`;
}

/**
 * Lazily creates and returns a singleton Undici ProxyAgent for local Gemini calls.
 */
export function getGeminiProxyAgent(): ProxyAgent | null {
  const proxyUrl = getLocalGeminiProxyUrl();
  if (!proxyUrl) {
    return null;
  }
  if (!_geminiProxyAgent) {
    _geminiProxyAgent = new ProxyAgent(proxyUrl);
  }
  return _geminiProxyAgent;
}

/**
 * Initializes the global Undici dispatcher for all Node.js fetch requests in local mode.
 */
export function initLocalGeminiProxy(): void {
  if (_isProxyInitialized) return;
  _isProxyInitialized = true;

  const agent = getGeminiProxyAgent();
  if (agent) {
    const proxyUrl = getLocalGeminiProxyUrl();
    console.log(`[GeminiProxy] Local mode detected. Routing Gemini calls through local proxy: ${proxyUrl}`);
    try {
      setGlobalDispatcher(agent);
    } catch (err) {
      console.warn('[GeminiProxy] Failed to set global proxy dispatcher:', err);
    }
  }
}

// Auto-initialize when loaded in local environment
if (isLocalEnvironment()) {
  initLocalGeminiProxy();
}
