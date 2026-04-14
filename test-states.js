let state = 475096685 >>> 0;
state ^= state << 13;
state ^= state >>> 17;
state ^= state << 5;
state = state >>> 0;
console.log(state);
