// ws-server.js
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import dotenv from 'dotenv';
import axios from 'axios';
import WebSocket from 'ws';

dotenv.config();

const fastify = Fastify();
fastify.register(fastifyWebsocket);

const {
  OPENAI_API_KEY,
  ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID,
  DONNA_TRIGGER_ENDPOINT,
} = process.env;

// Helper: create OpenAI Realtime session
async function startOpenAISession() {
  const openaiSocket = new WebSocket('wss://api.openai.com/v1/realtime', {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
  });

  return new Promise((resolve, reject) => {
    openaiSocket.on('open', () => {
      openaiSocket.send(JSON.stringify({
        session: {
          system: "You are Donna, an AI voice assistant.",
          voice: ELEVENLABS_VOICE_ID,
          tool_choice: "auto",
          tools: [
            {
              type: "function",
              function: {
                name: "send_email",
                description: "Send an email to a client",
                parameters: {
                  to: { type: "string" },
                  subject: { type: "string" },
                  body: { type: "string" },
                }
              }
            }
          ]
        }
      }));
      resolve(openaiSocket);
    });
    openaiSocket.on('error', reject);
  });
}

// Helper: synthesize audio from ElevenLabs
async function synthesizeElevenLabs(text) {
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
    { text },
    {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'stream',
    }
  );
  return response.data;
}

// Helper: forward tool call to Donna
async function forwardToolCall(toolCall) {
  try {
    await axios.post(DONNA_TRIGGER_ENDPOINT, toolCall);
  } catch (err) {
    console.error('Tool call failed:', err.message);
  }
}

// WebSocket endpoint
fastify.get('/media-stream', { websocket: true }, async (connection, req) => {
  const client = connection.socket;
  const openai = await startOpenAISession();

  console.log('[Twilio] Connection started');

  client.on('message', async (message) => {
    try {
      const msg = JSON.parse(message.toString());
      if (msg.event === 'media') {
        // This is audio — stream to OpenAI
        openai.send(JSON.stringify({ audio: msg.media.payload }));
      }
    } catch (err) {
      console.error('Bad message from Twilio:', err.message);
    }
  });

  openai.on('message', async (msg) => {
    const parsed = JSON.parse(msg);

    if (parsed.content) {
      console.log('[OpenAI] Response:', parsed.content);

      // Speak back via ElevenLabs
      const audioStream = await synthesizeElevenLabs(parsed.content);
      audioStream.on('data', (chunk) => {
        client.send(chunk);
      });
    }

    if (parsed.tool_calls) {
      for (const call of parsed.tool_calls) {
        await forwardToolCall(call);
      }
    }
  });
});

const PORT = process.env.PORT || 5050;

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {


