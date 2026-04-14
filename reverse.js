function reverse_xorshift32(state) {
    // state ^= state << 5;
    let s = state;
    s ^= (s << 5) >>> 0; s ^= (s << 5) >>> 0; s ^= (s << 5) >>> 0; s ^= (s << 5) >>> 0; s ^= (s << 5) >>> 0; s ^= (s << 5) >>> 0; // 6 times is enough for << 5 (5*7=35 > 32)
    s = s >>> 0;
    
    // state ^= state >>> 17;
    s ^= s >>> 17;
    s = s >>> 0;
    
    // state ^= state << 13;
    s ^= (s << 13) >>> 0; s ^= (s << 13) >>> 0; s ^= (s << 13) >>> 0;
    s = s >>> 0;
    return s;
}
console.log("Original seed:", reverse_xorshift32(475094958));
