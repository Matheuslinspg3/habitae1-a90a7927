import { createServer } from 'node:http';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';

const EDGE_BASE_URL = process.env.EDGE_BASE_URL;
const WORKER_SECRET = process.env.WORKER_SECRET;
const INSTANCE_ID = process.env.INSTANCE_ID;

function startHttpServer() {
  const port = Number(process.env.PORT || 3000);

  console.log('PORT env:', process.env.PORT);

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

  server.listen(port, '0.0.0.0', () => {
    console.log(`HTTP server listening on ${port}`);
  });

  return server;
}

async function notifyStatus(status, qrCode = null) {
  if (!EDGE_BASE_URL || !WORKER_SECRET || !INSTANCE_ID) {
    console.warn('Missing EDGE_BASE_URL, WORKER_SECRET or INSTANCE_ID; skipping status update');
    return;
  }

  const url = `${EDGE_BASE_URL.replace(/\/$/, '')}/update-status`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WORKER_SECRET}`,
      },
      body: JSON.stringify({
        instanceId: INSTANCE_ID,
        status,
        qr_code: qrCode,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`Failed to update status (${response.status}): ${responseText}`);
    }
  } catch (error) {
    console.error('Failed to call update-status proxy', error);
  }
}

async function startBaileysWorker() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();

  const connect = async () => {
    const sock = makeWASocket({
      auth: state,
      version,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const qrDataUrl = await QRCode.toDataURL(qr);
        await notifyStatus('CONNECTING', qrDataUrl);
        console.log('QR saved');
      }

      if (connection === 'open') {
        await notifyStatus('CONNECTED', null);
      }

      if (connection === 'close') {
        await notifyStatus('DISCONNECTED', null);

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log('Connection closed, reconnecting...');
          await connect();
        } else {
          console.log('Connection closed and logged out. Waiting for restart.');
        }
      }
    });
  };

  await connect();

  setInterval(() => {
    console.log('worker alive');
  }, 60_000);
}

async function bootstrap() {
  startHttpServer();
  await startBaileysWorker();
}

bootstrap().catch((error) => {
  console.error('Failed to start wa-worker', error);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received from platform');
});
