// Service worker mínimo do AthosBI: só existe pra que o app possa ser
// instalado no celular (atalho na tela inicial). Não guarda nada em cache —
// cada abertura busca a versão mais nova do site. Sem internet, a página
// avisa em vez de mostrar o erro do navegador.
const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AthosBI</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#081d33;color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;text-align:center;padding:24px}
h1{font-size:20px;margin:0 0 8px}p{color:#9fb0c6;font-size:14px;margin:0 0 20px}button{background:#e8691f;color:#fff;border:0;border-radius:999px;padding:10px 20px;font-size:14px;font-weight:600}</style></head>
<body><div><h1>Sem conexão</h1><p>O AthosBI precisa de internet para mostrar os números. Confira a conexão e tente de novo.</p><button onclick="location.reload()">Tentar de novo</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
