/// <reference types="vite/client" />

// Versão do build, injetada pelo vite.config (define). Usada pra detectar
// quando uma nova versão foi publicada (banner "Atualizar").
declare const __APP_VERSION__: string;
