// ws-server.js (Minimal Echo Version for Render + Twilio)
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { WebSocketServer } from 'ws';

const fastify = Fastify();
const websocketServer = new WebSocketServer({ noServer: true });

fastify.register(fastifyWebsocket, {
  options: {
    server: websocketServer,
  }
});

fastify.get('/media-stream', { websocket: true }, (connection, req) => {
  const ws = connection.socket;
  console.log('✅ WebSocket connection established');

  ws.on('message', (message) => {
    console.log('📩 Message from client:', message.toString());
    ws.send(`Echo: ${message}`);
  });

  ws.on('close', () => {
    console.log('❌ WebSocket connection closed');
  });
});

const PORT = process.env.PORT || 5050;
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🟢 Echo server listening at ${address}`);
});
