const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clientIdCounter = 1;
const clients = {};

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

    switch (msg.type) {
        case 'chat':
            sendChatMessage(msg);
            break;
        case 'shareCommitment':
            sendShareCommitmentMessage(msg);
            break;
        default:
            console.log(`Unknown message type: ${msg.type}`);
    }
}

function sendChatMessage(msg) {
    if (clients[msg.targetClientId]) {
        clients[msg.targetClientId].ws.send(JSON.stringify(msg));
    }
}

function sendShareCommitmentMessage(msg) {
    if (clients[msg.targetClientId]) {
        clients[msg.targetClientId].ws.send(JSON.stringify(msg));
    } else {
        console.log(`Target client ${msg.targetClientId} not found.`);
    }
}

function handleClientDisconnect(ws) {
    delete clients[ws.clientId];
    broadcastClientList();
}

function broadcastClientList() {
    const clientList = Object.keys(clients).map(key => clients[key].clientId);
    const message = JSON.stringify({ type: 'clientList', clientList });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
