import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { Noir } from '@noir-lang/noir_js';
import noirjs_demo from './circuit/target/noirjs_demo.json';
import { ec as EC } from 'elliptic';
import BN from 'bn.js';
import { Buffer } from 'buffer';

// Create and initialize EC context
// (better do it once and reuse it)
var ec = new EC('secp256k1');

window.Buffer = Buffer;


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
      this.value = value;
  }
}

class Polynomial {
  constructor(coefficients) {
      this.coefficients = coefficients;
  }

  // Evaluate the polynomial at a given (scalar) x
  // returns scalar value
  evaluate(x) {
      let result = new BN(0);
      let xPow = new BN(1);

      for (let coefficient of this.coefficients) {
          result = result.add(xPow.mul(coefficient));
          xPow = xPow.mul(x);
      }

      return result;
  }
}

// Generates a polynomial with random coefficients and calculates shares based on the polynomial
// returns the generated shares and the polynomial used
function getPolyAndShares(secret, threshold, limit) {
  // Generate random coefficients for the polynomial, with the secret as the constant term
  let coefficients = [secret];
  for (let i = 1; i < threshold; i++) {
      const randomCoeff = new BN(ec.genKeyPair().getPrivate().toString(16), 16);
      coefficients.push(randomCoeff);
  }

  const poly = new Polynomial(coefficients);

  // Generate shares
  const shares = [];
  for (let i = 1; i <= limit; i++) {
      const x = new BN(i);
      const shareValue = poly.evaluate(x);
      shares.push(new ShamirShare(i, shareValue.toString(16)));
  }

  return { shares, poly };
}

// Verifies if a given share is valid based on the commitments and the curve 
// returns true if the share is valid, false otherwise
function verifyShare(share, commitments, curve) {
  console.log("share " + share.value)
  
  const x = new BN(share.id);
  let xPow = new BN(1);
  let expectedPoint = curve.g.mul(new BN(0)); // Start with the identity element

  for (let i = 0; i < commitments.length; i++) {
      // Add the contribution of each commitment
      const commitmentContribution = commitments[i].mul(xPow);
      expectedPoint = expectedPoint.add(commitmentContribution);
      xPow = xPow.mul(x);
  }

  // Convert the share value to a point on the curve
  const shareValue = new BN(share.value, 16);
  const actualPoint = curve.g.mul(shareValue);
console.log(actualPoint.getX().toString(16) + " " + actualPoint.getY().toString(16));
  // Verify if the actual share point matches the expected point
  return actualPoint.eq(expectedPoint);
}

// returns k commitments, which are points on the curve
function getCommitments(poly, curve) {
  const commitments = poly.coefficients.map(coefficient => {
    // multiply each (scalar) coefficient of polynomial with generator point
      return curve.g.mul(coefficient);
  });
  return commitments;
}

async function generateSharesAndCommitments() {
  // Generate a random secret for demonstration
  const secretKeyPair = ec.genKeyPair();
  const secret = secretKeyPair.getPrivate();
  console.log("secret " + secret)

  const threshold = 2; // Threshold (K)
  const limit = 3; // Total number of shares (N)

  const { shares, poly } = getPolyAndShares(secret, threshold, limit);
  console.log('Shares:', shares);

  // Generate commitments from the polynomial
  const commitments = getCommitments(poly, ec);
  console.log('Commitments:', commitments.map(commitment => commitment.encode('hex')));

  // Example: Verifying the first share using the generated commitments
  // Note: This assumes verifyShare is adapted to work with point commitments
  const isValid1 = verifyShare(shares[0], commitments, ec);
  console.log('Share 1 is valid:', isValid1);

  const isValid2 = verifyShare(shares[1], commitments, ec);
  console.log('Share 2 is valid:', isValid1);

  const isValid3 = verifyShare(shares[2], commitments, ec);
  console.log('Share 3 is valid:', isValid1);
}