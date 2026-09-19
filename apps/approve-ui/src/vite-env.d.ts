/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAIL_LOOP_BASE?: string
  readonly VITE_IDENTITY_LOOP_BASE?: string
  readonly VITE_IDENTITY_MOCK?: string
  readonly VITE_WHATSAPP_LOOP_BASE?: string
  readonly VITE_WHATSAPP_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
