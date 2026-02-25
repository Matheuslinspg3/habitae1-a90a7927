import { createServer } from 'node:http';

function startHttpServer() {
  const port = Number(process.env.PORT || 3000);

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('wa-worker running');
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('ok');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  server.listen(port, () => {
    console.log(`HTTP server listening on ${port}`);
  });

  return server;
}

async function startBaileysWorker() {
  // Mantenha/inicialize aqui a lógica existente do worker Baileys.
  // Este servidor HTTP roda em paralelo e não interfere no fluxo do Baileys.
}

async function bootstrap() {
  startHttpServer();
  await startBaileysWorker();
}

bootstrap().catch((error) => {
  console.error('Failed to start wa-worker', error);
  process.exit(1);
});
