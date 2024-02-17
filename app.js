import * as BabyJubJub from '@zk-kit/baby-jubjub';
const { Point, addPoint, Base8, Fr, mulPointEscalar } = BabyJubJub;
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { Noir } from '@noir-lang/noir_js';
import noirjs_demo from './circuit/target/noirjs_demo.json';

import BN from 'bn.js';
import { Buffer } from 'buffer';

window.Buffer = Buffer;

const order = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

document.addEventListener('DOMContentLoaded', initializeApp);

const N = 3
const K = 2 // Then polynomial will have degree K-1
// clientIds[i] <=> x = i+1
var clientIds = [];
let clientShares = new Map();
var storedCommitments = [];
var myId;
var generatedProof;

function updateClientIds(ids) {
  console.log("Current clients")
  clientIds = ids;
}

function updateMyId(id) {
  myId = id;
}

async function initializeApp() {
  const sendBtn = document.getElementById('send');
  const createSharesBtn = document.getElementById('createShares');
  const messages = document.getElementById('messages');
  // const messageBox = document.getElementById('messageBox');
  const targetClientIdBox = document.getElementById('targetClientIdBox');

  let ws;

  setupWebSocket();

  sendBtn.addEventListener('click', sendShareAndCommitments);
  createSharesBtn.addEventListener('click', generateSharesAndCommitments);

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
        case 'shareCommitmentProof':
          console.log("Received share and commitments");
          displayShareAndCommitments(msg.fromClientId, msg.content.share, msg.content.commitments, msg.content.proof);
          break;
        case 'id':
          updateMyId(msg.clientId);
          displayClientInfo();
          break;
        case 'chat':
          console.log("Received chat message")
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

  async function displayShareAndCommitments(fromClientId, share, commitments, proofData) {
    const shareDetails = `Share from ${fromClientId}: ID: ${share.id}, Value: ${share.value}`;
    const commitmentDetails = commitments.map((commitment, index) =>
      `Commitment ${index + 1}: (${commitment.x}, ${commitment.y})`
    ).join(', ');

    // Display share and commitments
    showMessage(`${shareDetails}. Commitments: ${commitmentDetails}`);

    // Decode the proof and public inputs from Base64
    const proof = base64ToUint8Array(proofData.proof);
    const publicInputs = proofData.publicInputs.map(input => base64ToUint8Array(input));

    // Display the proof (optional, depending on your needs)
    // showMessage(`Proof: ${proofData.proof}`);

    console.log(proofData)
    console.log(publicInputs)
    console.log(proof)
    // Verify the proof
    display('logs', 'Verifying proof... ⌛');
    try {

      const backend = new BarretenbergBackend(noirjs_demo);
      //TODO reconstruct the proof obj
      const receivedProof = {
        publicInputs: [],
        proof: proof
      }
      console.log(receivedProof)

      const simpleZKP = new Noir(noirjs_demo, backend);
      const verificationResult = await simpleZKP.verifyFinalProof(receivedProof);
      display('logs', verificationResult ? 'Verifying proof... ✅' : 'Proof verification failed');
    } catch (error) {
      console.error('Proof verification error:', error);
      display('logs', 'Proof verification error');
    }
  }


  function uint8ArrayToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function base64ToUint8Array(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
  }

  function sendShareAndCommitments() {
    if (!ws) {
      showMessage("No WebSocket connection :(");
      return;
    }

    const targetClientId = targetClientIdBox.value;
    const share = clientShares.get(Number(targetClientId));
    const commitments = storedCommitments;

    if (share && commitments && targetClientId && generatedProof) {
      const message = {
        type: 'shareCommitmentProof',
        fromClientId: myId,
        targetClientId: targetClientId,
        content: {
          share: {
            id: share.id,
            value: share.value.toString(),
          },
          commitments: commitments.map(commitment => ({
            x: commitment[0].toString(),
            y: commitment[1].toString(),
          })),
          proof: {
            publicInputs: generatedProof.publicInputs.map(uint8ArrayToBase64),
            proof: uint8ArrayToBase64(generatedProof.proof),
          },
        },
      };

      const serialized = JSON.stringify(message, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );
      console.log(serialized);
      ws.send(serialized);
      showMessage(`Share, commitments, and proof sent to client ${targetClientId}`);
    } else {
      console.log('Share, commitments, proof, or target client ID is missing');
    }
  }


  function showMessage(message) {
    console.log(message)
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

class ShamirShare {
  constructor(id, value) {
    this.id = id;
    this.value = value; // scalar
  }
}

class Polynomial {
  constructor(coefficients) {
    this.coefficients = coefficients;
  }

  evaluate(x) {
    let result = BigInt(0);
    let xPow = BigInt(1);

    for (let coefficient of this.coefficients) {
      result = result + (xPow * coefficient);
      xPow = xPow * x;
    }

    return result % order;
  }
}

function getPolyAndShares(secret, threshold, limit) {
  let coefficients = [secret]; // secret is an element in Fr
  for (let i = 1; i < threshold; i++) {
    // Generate random coefficients (in Fr). Adapt this to use Baby JubJub's random scalar generation
    coefficients.push(generateRandomFr());
  }

  const poly = new Polynomial(coefficients);

  const shares = [];
  for (let i = 1; i <= limit; i++) {
    const x = BigInt(i);
    const shareValue = poly.evaluate(x);
    shares.push(new ShamirShare(i, shareValue));
  }

  return { shares, poly };
}

// returns coeff * basePoint for all coeffs
function getCommitments(poly, basePoint) {
  return poly.coefficients.map(coefficient => {
    // Multiply the base point by the coefficient
    return mulPointEscalar(basePoint, BigInt(coefficient));
  });
}

function verifyShare(share, commitments, basePoint) {
  const shareId = Fr.e(BigInt(share.id)); // Convert share ID (=x) to Fr
  let xPow = Fr.e(BigInt(1)); // Initialize x^0 as 1
  let expectedPoint = [Fr.e(BigInt(0)), Fr.e(BigInt(1))]; // Initialize to the neutral element, if applicable

  for (let i = 0; i < commitments.length; i++) {
    const commitment = commitments[i];
    // Multiply commitment by x^i
    const contribution = mulPointEscalar(commitment, xPow);
    // Add contribution to the expected point
    expectedPoint = addPoint(expectedPoint, contribution);
    // Prepare x^(i+1) for the next iteration
    xPow = Fr.mul(xPow, shareId);
  }

  // Convert the share value back to a point and compare
  const shareValuePoint = mulPointEscalar(basePoint, Fr.e(BigInt(share.value)));
  return expectedPoint[0] == shareValuePoint[0] && expectedPoint[1] == shareValuePoint[1];
}

function generateRandomFr() {
  const randBigInt = BigInt(Math.floor(Math.random() * Number(order)));
  return Fr.e(randBigInt);
}

async function generateSharesAndCommitments() {

  // FIXME 
  // For now, we repeat the shares & commitment generation until we have only valid shares.
  // The shares + commitments should always be valid when generated correctly, but for some reason that is not the case
  // this has to be fixed!
  const threshold = 2; // Threshold (K)
  const limit = 3; // Total number of shares (N)
  let isValid1 = false;
  let isValid2 = false;
  let isValid3 = false;

  let shares, poly, commitments;

  while (!isValid1 || !isValid2 || !isValid3) {
    // Generate a random field element
    const randomElement = generateRandomFr();
    let secret = Fr.e(randomElement);

    // Get polynomial and shares
    const polyAndShares = getPolyAndShares(secret, threshold, limit);
    shares = polyAndShares.shares;
    poly = polyAndShares.poly;

    // Get commitments
    commitments = getCommitments(poly, Base8);

    // Verify each share
    isValid1 = verifyShare(shares[0], commitments, Base8);
    isValid2 = verifyShare(shares[1], commitments, Base8);
    isValid3 = verifyShare(shares[2], commitments, Base8);
  }

  // Log the valid shares and commitments
  console.log('Shares:', shares.map(share => `ID: ${share.id}, Value: ${share.value}`));
  console.log('Commitments:', commitments.map(commitment => `${commitment.toString()}`));
  console.log('Share 1 is valid:', isValid1);
  console.log('Share 2 is valid:', isValid2);
  console.log('Share 3 is valid:', isValid3);

  // Store the shares & commitments
  clientIds.forEach((clientId, index) => {
    clientShares.set(clientId, shares[index]);
  });
  storedCommitments = commitments

  const backend = new BarretenbergBackend(noirjs_demo);

  const simpleZKP = new Noir(noirjs_demo, backend);

  const input = {
    x: shares[0].id.toString(),
    share: shares[0].value.toString(),
    c0_x: commitments[0][0].toString(),
    c0_y: commitments[0][1].toString(),
    c1_x: commitments[1][0].toString(),
    c1_y: commitments[1][1].toString()
  };

  display('logs', 'Generating proof... ⌛');
  console.log('input:', input);
  const proof = await simpleZKP.generateFinalProof(input);
  display('logs', 'Generated proof... ✅');
  display('results', proof.proof);
  generatedProof = proof;

  //   display('logs', 'Verifying proof... ⌛');
  //   const verification = await simpleZKP.verifyFinalProof(proof);
  //   display('logs', verification ? 'Verifying proof... ✅' : 'Proof verification failed');
}


function display(containerId, message) {
  const container = document.getElementById(containerId);
  const paragraph = document.createElement('p');
  paragraph.textContent = message;
  container.appendChild(paragraph);
}