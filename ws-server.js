// ws-server.js
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';

const fastify = Fastify();
fastify.register(fastifyWebsocket);

// Minimal working WebSocket echo server
fastify.get('/media-stream', { websocket: true }, (connection, req) => {
  const ws = connection.socket;
  console.log('✅ WebSocket connection established');

  ws.on('message', (message) => {
    console.log('📩 Message:', message.toString());
    ws.send(`Echo: ${message}`);
  });

  ws.on('close', () => {
    console.log('❌ WebSocket closed');
  });
});

const PORT = process.env.PORT || 5050;
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🟢 Server listening at ${address}`);
});
