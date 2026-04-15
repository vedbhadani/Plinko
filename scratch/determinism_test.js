const crypto = require('crypto');

function sha256(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function xorshift32(seed) {
  let state = seed >>> 0;
  return function rand() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state = state >>> 0;
    return state / 0x100000000;
  };
}

function extractSeed(combinedSeed) {
  const rawSeed = parseInt(combinedSeed.slice(0, 8), 16);
  return rawSeed === 0 ? 1 : rawSeed;
}

function generatePegMap(rand, rows) {
  const pegMap = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let p = 0; p <= r; p++) {
      const leftBias = parseFloat((0.5 + (rand() - 0.5) * 0.2).toFixed(6));
      row.push(leftBias);
    }
    pegMap.push(row);
  }
  return pegMap;
}

function simulatePath(rand, pegMap, dropColumn, rows = 12) {
  const path = [];
  let pos = 0;
  const adj = (dropColumn - Math.floor(rows / 2)) * 0.01;
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  for (let r = 0; r < rows; r++) {
    const pegIndex = Math.min(pos, r);
    const leftBias = pegMap[r][pegIndex];
    const bias = clamp(leftBias + adj, 0, 1);
    const rnd = rand();
    if (rnd < bias) {
      path.push('L');
    } else {
      path.push('R');
      pos += 1;
    }
  }
  return { path, binIndex: pos };
}

function runSimulation(serverSeed, clientSeed, nonce, dropColumn) {
  const combinedSeed = sha256(serverSeed + ":" + clientSeed + ":" + nonce);
  const prngSeed = extractSeed(combinedSeed);
  const rand = xorshift32(prngSeed);
  const pegMap = generatePegMap(rand, 12);
  const pegMapHash = sha256(JSON.stringify(pegMap));
  const { path, binIndex } = simulatePath(rand, pegMap, dropColumn, 12);
  return { pegMapHash, binIndex, path: JSON.stringify(path) };
}

const inputs = {
  serverSeed: "b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc",
  nonce: "42",
  clientSeed: "candidate-hello",
  dropColumn: 6
};

console.log("Running Determinism Sanity Test (10 iterations)...");

const firstResult = runSimulation(inputs.serverSeed, inputs.clientSeed, inputs.nonce, inputs.dropColumn);
let allCorrect = true;

for (let i = 1; i <= 10; i++) {
  const result = runSimulation(inputs.serverSeed, inputs.clientSeed, inputs.nonce, inputs.dropColumn);
  const match = JSON.stringify(result) === JSON.stringify(firstResult);
  console.log(`Iteration ${i}: ${match ? '✅' : '❌'}`);
  if (!match) allCorrect = false;
}

if (allCorrect) {
  console.log("\nSUCCESS: System is 100% deterministic.");
} else {
  console.log("\nFAILURE: Non-deterministic behavior detected!");
  process.exit(1);
}
