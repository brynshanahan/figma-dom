/// <reference types="vitest" />

interface ImportMetaEnv {
  readonly VITEST_FIGMA_FILE_KEY: string
  readonly VITEST_FIGMA_API_KEY: string
  readonly VITE_FIGMA_FILE_KEY: string
  readonly VITE_FIGMA_API_KEY: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
