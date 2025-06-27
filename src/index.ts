// import express from 'express';
import https from 'https';
import fs from 'fs';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const options = {
    key: fs.readFileSync(path.join(__dirname, './cert/key.pem')),
    cert: fs.readFileSync(path.join(__dirname, './cert/cert.pem')),
};

// const app = express();
// const server = https.createServer(options, app);
const server = https.createServer(options);
const wss = new WebSocketServer({ server: server });

type BroadcastMessage = {
    type: 'new-user' | 'close',
    id: `${string}-${string}-${string}-${string}-${string}`
}

// app.use(express.static('public'));

const peers = new Map();

wss.on('connection', socket => {
    const userId = crypto.randomUUID();

    peers.set(socket, userId);

    socket.on('message', (raw: WebSocket.RawData) => {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'ready') {
            if (msg.id !== null) {
                peers.set(socket, userId);
            }

            socket.send(JSON.stringify({ type: 'init', id: userId, peers: getAllPeerIdsExcept(userId) }));
            broadcastExcept(socket, {
                type: 'new-user',
                id: userId
            });
            return;
        }

        msg.from = userId;

        if (msg.to !== undefined) {
            const recipientSocket = [...peers.entries()].find(([, id]) => id === msg.to)?.[0];
            if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
                recipientSocket.send(JSON.stringify(msg));
            }
        }
    });

    socket.on('close', () => {
        const ID = peers.get(socket);
        broadcastExcept(socket, { type: 'close', id: ID })
        peers.delete(socket);
    })
});

function getAllPeerIdsExcept(userId: string) {
    const CLIENTES = Array.from(peers.values()).filter(id => id !== userId);
    return CLIENTES;
}

function broadcastExcept(sender: WebSocket, message: BroadcastMessage) {
    for (const [client] of peers.entries()) {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    }
}

server.listen(5000);