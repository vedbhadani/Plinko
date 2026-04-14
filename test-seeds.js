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

const target = 0.1106166649;
for(let i=0; i<1000000; i++) {
   const rng = xorshift32(i);
   if(Math.abs(rng() - target) < 0.000001) {
       console.log("Found seed:", i);
   }
}
