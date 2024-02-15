const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clientIdCounter = 1;
const clients = {};

function broadcastClientList() {
    const clientList = Object.keys(clients).map(key => clients[key].clientId);
    const message = JSON.stringify({ type: 'clientList', clientList });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

wss.on('connection', ws => {
    setupNewClient(ws);
    ws.on('message', message => handleMessage(ws, message));
    ws.on('close', () => handleClientDisconnect(ws));
});

function setupNewClient(ws) {
    const clientId = clientIdCounter++;
    clients[clientId] = { ws, clientId };
    ws.clientId = clientId;

    ws.send(JSON.stringify({ type: 'id', clientId }));
    broadcastClientList();
}

function handleMessage(ws, message) {
    const msg = JSON.parse(message);
    if (msg.type === 'chat') {
        sendChatMessage(msg);
    }
}

function sendChatMessage(msg) {
    if (clients[msg.targetClientId]) {
        clients[msg.targetClientId].ws.send(JSON.stringify(msg));
    }
}

function handleClientDisconnect(ws) {
    delete clients[ws.clientId];
    broadcastClientList();
}

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
