/// <reference types="vite/client" />

interface ApiConfigStatus {
  hasOpenAI: boolean;
  hasGemini: boolean;
  hasExportDirectory: boolean;
  effectiveExportDirectory: string;
  missing: string[];
}

interface ApiConfigPayload {
  openaiApiKey: string;
  geminiApiKey: string;
  exportDirectory: string;
}

interface DesktopAPI {
  getApiConfig: () => Promise<ApiConfigPayload>;
  getApiConfigStatus: () => Promise<ApiConfigStatus>;
  chooseExportDirectory: () => Promise<string | null>;
  saveApiConfig: (config: ApiConfigPayload) => Promise<ApiConfigPayload & { status: ApiConfigStatus }>;
  openSettings: () => Promise<boolean>;
  onOpenSettings: (callback: () => void) => () => void;
}

interface Window {
  desktopAPI?: DesktopAPI;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
