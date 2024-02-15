import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { Noir } from '@noir-lang/noir_js';
import noirjs_demo from './circuit/target/noirjs_demo.json';
import BigNumber from 'bignumber.js';
document.addEventListener('DOMContentLoaded', initializeApp);

const PRIME = new BigNumber('21888242871839275222246405745257275088548364400416034343698204186575808495617');
const N = 3
const K = 2 // Then polynomial will have degree K-1
var clientIds = [];
var myId;

function updateClientIds(ids) {
  clientIds = ids;
}

function updateMyId(id) {
  myId = id;
}

async function initializeApp() {
    // await initializeNoir();
    await initWebSocketChat();
}

async function initializeNoir() {
    const backend = new BarretenbergBackend(noirjs_demo);

// Create a proof that verifies the share. 
// The receiver instantiates the same with "new Noir{...}" and thus can verify the proof

// Questions: 
// - what will be the input for the proof?
// a client will receive a share. But basically only it's own share. And it doesn't have access to the polynomial

    const simpleZKP = new Noir(noirjs_demo, backend);

    const { a, b, c } = generateRandomValues();

    const input = { x: a.toFixed(), share: b.toFixed(), c0: c.toFixed(), c1: c.toFixed() };

    display('logs', 'Generating proof... ⌛');
    const proof = await simpleZKP.generateFinalProof(input);
//     display('logs', 'Generating proof... ✅');
//     display('results', proof.proof);

//     display('logs', 'Verifying proof... ⌛');
//     const verification = await simpleZKP.verifyFinalProof(proof);
//     display('logs', verification ? 'Verifying proof... ✅' : 'Proof verification failed');
}

function display(containerId, message) {
    const container = document.getElementById(containerId);
    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    container.appendChild(paragraph);
}

function generateRandomValues() {
  const prime = new BigNumber('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  const a = BigNumber.random().times(prime).integerValue(BigNumber.ROUND_FLOOR);
  const b = BigNumber.random().times(prime).integerValue(BigNumber.ROUND_FLOOR);
  const c = a.plus(b).mod(prime);

  return { a, b, c };
}

/*
1. Generate a secret
2. Obtain polynomial with degree t-1
3. Obtain shares for the secret, by creating evaluating for all clientIds
4. Obtain commitments 

*/
async function getAllTheThings() {
  const secret = BigNumber.random().times(PRIME).integerValue(BigNumber.ROUND_FLOOR);
  console.log("secret " + secret.toFixed());
  let pol = createPolynomial(secret);
  console.log("pol[0] " + pol[0].toFixed());
  console.log("pol[1] " + pol[1].toFixed());
  let sharesMap = getShares(pol);
  
  let commitments = getCommitments(pol);

  let temp = verifyShare(clientIds[0], sharesMap[clientIds[0]], commitments, PRIME)
  console.log(temp)

  const backend = new BarretenbergBackend(noirjs_demo);

  // Create a proof that verifies the share. 
  // The receiver instantiates the same with "new Noir{...}" and thus can verify the proof
  
  // Questions: 
  // - what will be the input for the proof?
  // a client will receive a share. But basically only it's own share. And it doesn't have access to the polynomial
  
  const simpleZKP = new Noir(noirjs_demo, backend);

  // const { a, b, c } = generateRandomValues();

  const input = { x: clientIds[0].toFixed(), 
    share: sharesMap[clientIds[0]].toFixed(), 
    c0: commitments[0].toFixed(), 
    c1: commitments[1].toFixed() };

  display('logs', 'Generating proof... ⌛');
  const proof = await simpleZKP.generateFinalProof(input);
  display('logs', 'Generated proof... ✅');
  display('results', proof.proof);

  display('logs', 'Verifying proof... ⌛');
  const verification = await simpleZKP.verifyFinalProof(proof);
  display('logs', verification ? 'Verifying proof... ✅' : 'Proof verification failed');
}

// input BigNumber secret
// returns array of BigNumber coefficients
function createPolynomial(s) {
  // create polynomial of degree k-1
  var coeffs = [];
  // first coeff is the secret itself
  coeffs.push(s);
  // Then, add random coefficients
  for (let i = 0; i < K-1; i++) {
    // coeffs.push(BigNumber(1))
    let coeff = BigNumber.random().times(PRIME).integerValue(BigNumber.ROUND_FLOOR);
    console.log("COEFF " + coeff.toFixed());
    coeffs.push(coeff);
  }
  return coeffs;
}

// input array of BigNumber coefficients
// returns a map of "clientId" -> "share"
function getShares(p) {
  var sharesMap = {};
  for (const clientId of clientIds) {
    let share = evalPolynomial(p, clientId);
    sharesMap[clientId] = new BigNumber(share);
    console.log("Share for " + clientId + ": "+ sharesMap[clientId].toFixed());
  }
  return sharesMap;
}

// input array of BigNumber coefficients and a clientId x
// returns BigNumber evaluation of the polynomial in point x
function evalPolynomial(coeffs, x) {
  var res = new BigNumber(0);
  let _x = new BigNumber(x);
  for (let i=0; i<K; i++) {
    // TODO is the problem here?
    let temp = _x.exponentiatedBy(i, PRIME);
    temp = coeffs[i].multipliedBy(temp).modulo(PRIME);
    console.log("temp "+ temp.toFixed());
    res = res.plus(temp).modulo(PRIME);
  }
  res = res.modulo(PRIME);
  return res;
}

function getCommitments(coeffs) {
  // Generator
  const g = new BigNumber('5');
  var commitments = [];
  for (let i=0; i<K; i++) {
    let c = g.exponentiatedBy(coeffs[i], PRIME);
    c = c.modulo(PRIME);
    console.log("commitment " + c.toFixed());
    commitments.push(c);
  }

  return commitments;
}

// TODO CONTINUE HERE verifying the work 
function verifyShare(x, share, commitments, prime) {
  // let x = new BigNumber(i);
  // i
  console.log("x = " + x.toFixed())
  // share value
  console.log("share = " + share.toFixed())
  // commitments
  console.log("c0 = " + commitments[0].toFixed())
  console.log("c1 = " + commitments[1].toFixed())
  x = new BigNumber(x);
  let rhs = new BigNumber(1); // Assuming commitments are BigNumber objects
  // let i = new BigNumber();

  for (let j = 0; j < commitments.length; j++) {
      let exp = x.exponentiatedBy(new BigNumber(j), PRIME);
      console.log("exp = " + exp.toFixed())
      let temp = new BigNumber(commitments[j]).exponentiatedBy(exp, PRIME);
      console.log("temp = " + temp.toFixed())
      temp = temp.modulo(PRIME);
      console.log("temp = " + temp.toFixed())
      rhs = rhs.multipliedBy(temp).modulo(PRIME);
      console.log("rhs = " + rhs.toFixed())
  }
  rhs = rhs.modulo(PRIME);
  console.log("rhs " + rhs.toFixed());

  const g = new BigNumber('5');
  share = new BigNumber(share);

  // let sc = new BigNumber(share); // Assuming share.value is a BigNumber or can be converted to one
  let lhs = g.exponentiatedBy(share, PRIME).modulo(PRIME); // In a prime field, this might just be the share value itself
  console.log("lhs " + lhs.toFixed());
  // if (lhs.isEqualTo(rhs)) {
  //     return true; // Share is valid
  // } else {
  //     throw new Error("Share is not valid");
  // }
}

function initWebSocketChat() {
    const sendBtn = document.getElementById('send');
    const createSharesBtn = document.getElementById('createShares');
    const messages = document.getElementById('messages');
    const messageBox = document.getElementById('messageBox');
    const targetClientIdBox = document.getElementById('targetClientIdBox');

    let ws;

    setupWebSocket();

    sendBtn.addEventListener('click', sendMessage);
    createSharesBtn.addEventListener('click', getAllTheThings);

    function setupWebSocket() {
        if (ws) {
            closeWebSocket();
        }

        ws = new WebSocket('ws://localhost:3000');
        ws.onopen = () => console.log('Chat connection opened!');
        ws.onmessage = handleWebSocketMessage;
        ws.onclose = () => ws = null;
    }

    function closeWebSocket() {
        ws.onerror = ws.onopen = ws.onclose = null;
        ws.close();
    }

    function handleWebSocketMessage({ data }) {
        try {
            const msg = JSON.parse(data);
            switch (msg.type) {
                case 'id':
                    updateMyId(msg.clientId);
                    displayClientInfo();
                    break;
                case 'chat':
                    showMessage(`${msg.fromClientId}: ${msg.content}`);
                    break;
                case 'clientList':
                    updateClientIds(msg.clientList)
                    displayConnectedClients(msg.clientList.filter(id => id !== myId));
                    break;
                default:
                    console.error('Unknown message type:', msg.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }

    function sendMessage() {
        if (!ws) {
            showMessage("No WebSocket connection :(");
            return;
        }

        const targetClientId = targetClientIdBox.value;
        const content = messageBox.value.trim();

        if (content && targetClientId) {
            const message = { type: 'chat', content, fromClientId: myClientId, targetClientId };
            ws.send(JSON.stringify(message));
            showMessage(`Me: ${content}`);
        } else {
            console.log('Message content or target client ID is missing');
        }

        messageBox.value = '';
    }

    function showMessage(message) {
        messages.textContent += `\n\n${message}`;
        messages.scrollTop = messages.scrollHeight;
    }

    function displayClientInfo() {
        const clientInfo = `My ID: ${myId}`;
        document.getElementById('clientInfo').textContent = clientInfo;
    }

    function displayConnectedClients(clientList) {
        const connectedClients = `Connected Clients: ${clientList.join(', ')}`;
        document.getElementById('connectedClients').textContent = connectedClients;
    }
}
