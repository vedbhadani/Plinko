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
const rng = xorshift32(4177974857);
for(let i=0; i<5; i++) console.log(rng().toFixed(10));
