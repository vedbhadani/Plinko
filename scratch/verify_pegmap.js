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

const serverSeed = "b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc";
const nonce = "42";
const clientSeed = "candidate-hello";

const combinedSeed = sha256(serverSeed + ":" + clientSeed + ":" + nonce);
const prngSeed = extractSeed(combinedSeed);
const rand = xorshift32(prngSeed);

const pegMap = generatePegMap(rand, 12);

console.log("Row 0:", JSON.stringify(pegMap[0]));
console.log("Row 1:", JSON.stringify(pegMap[1]));
console.log("Row 2:", JSON.stringify(pegMap[2]));

const targets = [
  [0.422123],
  [0.552503, 0.408786],
  [0.491574, 0.468780, 0.436540]
];

console.log("\nVerifying Peg Map values:");
for (let i = 0; i < 3; i++) {
  const match = JSON.stringify(pegMap[i]) === JSON.stringify(targets[i]);
  console.log(`Row ${i} Match: ${match ? '✅' : '❌'}`);
}
