import { Point } from "@zk-kit/baby-jubjub";
import BN from 'bn.js';
import { Buffer } from 'buffer';

// Assuming BabyJub provides necessary functionality directly or via its components
const babyJub = new BabyJub();

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
    this.value = value; // This might need to be a BabyJub point or scalar
  }
}

class Polynomial {
  constructor(coefficients) {
    this.coefficients = coefficients;
  }

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

function getPolyAndShares(secret, threshold, limit) {
  let coefficients = [new BN(secret)]; // Assuming secret is already a BN
  for (let i = 1; i < threshold; i++) {
    // Generate random coefficients. Adapt this to use Baby JubJub's random scalar generation
    coefficients.push(BabyJub.randomScalar());
  }

  const poly = new Polynomial(coefficients);

  const shares = [];
  for (let i = 1; i <= limit; i++) {
    const x = new BN(i);
    const shareValue = poly.evaluate(x);
    shares.push(new ShamirShare(i, shareValue.toString(16)));
  }

  return { shares, poly };
}

function getCommitments(poly, basePoint) {
  return poly.coefficients.map(coefficient => {
    // Convert coefficient to Fq if necessary
    const fqCoefficient = BigInt(coefficient);
    // Multiply the base point by the coefficient
    return Point.multiply(basePoint, fqCoefficient);
  });
}

// The verifyShare and getCommitments functions would need to be adapted based on Baby JubJub's API.
// This might involve converting BNs to Baby JubJub scalars and using Baby JubJub's point operations.

function verifyShare(share, commitments, basePoint) {
  const shareId = BigInt(share.id); // Convert share ID to Fq
  let xPow = BigInt(1); // Initialize x^0 as 1
  let expectedPoint = new Point(BigInt(0), BigInt(1)); // Initialize to the neutral element, if applicable

  for (let i = 0; i < commitments.length; i++) {
    const commitment = commitments[i];
    // Multiply commitment by x^i
    const contribution = Point.multiply(commitment, xPow);
    // Add contribution to the expected point
    expectedPoint = Point.add(expectedPoint, contribution);
    // Prepare x^(i+1) for the next iteration
    xPow = Fq.multiply(xPow, shareId);
  }

  // Convert the share value back to a point and compare
  const shareValuePoint = Point.fromBigInt(new BigInt(share.value, 16));
  return expectedPoint.equals(shareValuePoint);
}

async function generateSharesAndCommitments() {
  // Generate a random secret within the Baby JubJub field
  const secret = Fq.random();

  console.log("secret " + secret.toString());

  const threshold = 2; // Threshold (K)
  const limit = 3; // Total number of shares (N)

  // Adjust getPolyAndShares to work with Baby JubJub
  // Note: This assumes getPolyAndShares is adapted to use Fq for coefficients
  const { shares, poly } = getPolyAndShares(secret, threshold, limit);
  console.log('Shares:', shares.map(share => `ID: ${share.id}, Value: ${share.value}`));

  // Generate commitments from the polynomial using Baby JubJub's base point
  // Note: Ensure you have the correct base point for Baby JubJub (e.g., Base8)
  const commitments = getCommitments(poly, BabyJub.Base8);
  console.log('Commitments:', commitments.map(commitment => `(${commitment.x.toString()}, ${commitment.y.toString()})`));

  // Example: Verifying the first share using the generated commitments
  // Note: This assumes verifyShare is adapted to work with point commitments and Baby JubJub's API
  const isValid1 = verifyShare(shares[0], commitments, BabyJub.Base8);
  console.log('Share 1 is valid:', isValid1);

  const isValid2 = verifyShare(shares[1], commitments, BabyJub.Base8);
  console.log('Share 2 is valid:', isValid2);

  const isValid3 = verifyShare(shares[2], commitments, BabyJub.Base8);
  console.log('Share 3 is valid:', isValid3);
}
