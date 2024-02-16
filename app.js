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
var clientIds = [];
var myId;


function updateClientIds(ids) {
  clientIds = ids;
}

function updateMyId(id) {
  myId = id;
}

async function initializeApp() {
  
  const createSharesBtn = document.getElementById('createShares');
  const messages = document.getElementById('messages');
  const messageBox = document.getElementById('messageBox');
  const targetClientIdBox = document.getElementById('targetClientIdBox');

  let ws;

  setupWebSocket();

  
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
    // TODO
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
      result = result+ (xPow*coefficient);
      xPow = xPow * x;
    }

    return result;
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
  console.log('expectedPoint:', expectedPoint);
  console.log('shareValuePoint:', shareValuePoint);
  return expectedPoint[0] == shareValuePoint[0] && expectedPoint[1] == shareValuePoint[1];
}

function generateRandomFr() {
  const randBigInt = BigInt(Math.floor(Math.random() * Number(order)));
  return Fr.e(randBigInt);
}


async function generateSharesAndCommitments() {

  // Generate a random field element
  const randomElement = generateRandomFr();
  let secret = Fr.e(randomElement);

  const threshold = 2; // Threshold (K)
  const limit = 3; // Total number of shares (N)

  const { shares, poly } = getPolyAndShares(secret, threshold, limit);

  console.log('Shares:', shares.map(share => `ID: ${share.id}, Value: ${share.value}`));

  const commitments = getCommitments(poly, Base8);
  console.log('Commitments:', commitments.map(commitment => `${commitment.toString()}`));

  const isValid1 = verifyShare(shares[0], commitments, Base8);
  console.log('Share 1 is valid:', isValid1);

  const isValid2 = verifyShare(shares[1], commitments, Base8);
  console.log('Share 2 is valid:', isValid2);


  const backend = new BarretenbergBackend(noirjs_demo);

  // Create a proof that verifies the share. 
  // The receiver instantiates the same with "new Noir{...}" and thus can verify the proof
  
  // Questions: 
  // - what will be the input for the proof?
  // a client will receive a share. But basically only it's own share. And it doesn't have access to the polynomial
  
  const simpleZKP = new Noir(noirjs_demo, backend);

  const input = { x: shares[0].id.toString(), 
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

  display('logs', 'Verifying proof... ⌛');
  const verification = await simpleZKP.verifyFinalProof(proof);
  display('logs', verification ? 'Verifying proof... ✅' : 'Proof verification failed');
}


function display(containerId, message) {
  const container = document.getElementById(containerId);
  const paragraph = document.createElement('p');
  paragraph.textContent = message;
  container.appendChild(paragraph);
}