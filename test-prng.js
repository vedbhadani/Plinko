const { createHash } = require('crypto');
function sha256(input) { return createHash('sha256').update(input, 'utf8').digest('hex'); }
const comb = sha256("b2a53f52a46c0ea7ab1c63349077808abcbfe5a1ca398755c32ffeedbc1:candidate-hello:42");
console.log("combinedSeed", comb);
const seed = parseInt(comb.slice(0, 8), 16);
console.log("seed", seed);

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
const rng = xorshift32(seed);
for(let i=0; i<5; i++) console.log(rng());
