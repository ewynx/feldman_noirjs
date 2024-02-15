import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { Noir } from '@noir-lang/noir_js';
import noirjs_demo from './circuit/target/noirjs_demo.json';

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Noir
    const backend = new BarretenbergBackend(noirjs_demo);
    const noir = new Noir(noirjs_demo, backend);
    const input = { x: 1, y: 2 };
    display('logs', 'Generating proof... ⌛');
    const proof = await noir.generateFinalProof(input);
    display('logs', 'Generating proof... ✅');
    display('results', proof.proof);
    display('logs', 'Verifying proof... ⌛');
    const verification = await noir.verifyFinalProof(proof);
    if (verification) display('logs', 'Verifying proof... ✅');

    // WebSocket chat functionality
    initWebSocketChat();
});

function display(container, msg) {
    const c = document.getElementById(container);
    const p = document.createElement('p');
    p.textContent = msg;
    c.appendChild(p);
}
function initWebSocketChat() {
  const sendBtn = document.querySelector('#send');
  const messages = document.querySelector('#messages');
  const messageBox = document.querySelector('#messageBox');
  const targetClientIdBox = document.querySelector('#targetClientIdBox'); // Input for target client ID
  let myClientId;
  let ws;

  function showMessage(message) {
      messages.textContent += `\n\n${message}`;
      messages.scrollTop = messages.scrollHeight;
      messageBox.value = ''; // Clear the input box
  }

  function displayClientInfo() {
    const clientInfo = `My ID: ${myClientId}`;
    document.getElementById('clientInfo').textContent = clientInfo;
  }

  function displayConnectedClients(clientList) {
    const connectedClients = `Connected Clients: ${clientList.join(', ')}`;
    document.getElementById('connectedClients').textContent = connectedClients;
  }

  function init() {
      if (ws) {
          ws.onerror = ws.onopen = ws.onclose = null;
          ws.close();
      }

      ws = new WebSocket('ws://localhost:3000');
      ws.onopen = () => {
          console.log('Chat connection opened!');
      };
      
      ws.onmessage = ({ data }) => {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'id') {
                myClientId = msg.clientId;
                displayClientInfo();
            } else if (msg.type === 'chat') {
                showMessage(`${msg.fromClientId}: ${msg.content}`);
            } else if (msg.type === 'clientList') {
                displayConnectedClients(msg.clientList.filter(id => id !== myClientId));
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
      };
      
      ws.onclose = function() {
          ws = null;
      };
  }

  sendBtn.onclick = function() {
      if (!ws) {
          showMessage("No WebSocket connection :(");
          return;
      }

      const targetClientId = targetClientIdBox.value; // Get the target client ID from the input box
      const messageContent = messageBox.value;
      if (messageContent && targetClientId) {
          const message = JSON.stringify({ 
              type: 'chat', 
              content: messageContent, 
              fromClientId: myClientId, 
              targetClientId: targetClientId 
          });
          ws.send(message);
          showMessage(`Me: ${messageContent}`);
      } else {
          console.log('Message content or target client ID is missing');
      }
      messageBox.value = ''; // Clear after sending
  };

  init();
}
