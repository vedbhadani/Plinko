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

const serverSeed = "b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc";
const nonce = "42";
const clientSeed = "candidate-hello";

const combinedSeed = sha256(serverSeed + ":" + clientSeed + ":" + nonce);
console.log("Combined Seed:", combinedSeed);

const prngSeed = extractSeed(combinedSeed);
const rand = xorshift32(prngSeed);

const targets = [
  "0.1106166649",
  "0.7625129214",
  "0.0439292176",
  "0.4578678815",
  "0.3438999297"
];

let allMatch = true;
console.log("\nVerifying first 5 PRNG values:");
for (let i = 0; i < 5; i++) {
  const val = rand().toFixed(10);
  const match = val === targets[i];
  console.log(`${i+1}. Got: ${val} | Expected: ${targets[i]} | Match: ${match ? '✅' : '❌'}`);
  if (!match) allMatch = false;
}

if (allMatch) {
  console.log("\nSUCCESS: All PRNG test vectors match 100%.");
} else {
  console.log("\nFAILURE: One or more PRNG test vectors failed.");
  process.exit(1);
}
