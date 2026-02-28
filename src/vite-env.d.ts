/// <reference types="vite/client" />
/* 
Define the frontend environment variable type here
to insure frontend can use import.meta to get them.
*/

interface ImportMetaEnv {
    // frontend type
    readonly VITE_API_URL: string
    readonly VITE_APP_NAME: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}