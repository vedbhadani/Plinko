# Provably Fair Plinko

A production-ready, provably fair Plinko web application built with Next.js, Prisma, and Canvas, implementing a cryptographic commit-reveal schema ensuring completely deterministic and verifiable round outcomes.

## Technical Architecture

### Core Fairness Implementation
- **PRNG**: Strict implementation of the `xorshift32` algorithm (using constants 13, 17, 5) ensuring cycle accuracy and handling Javascript unsigned bitwise quirks. The PRNG prevents a starting seed of `0` by automatically bumping it to `1`.
- **Hash function**: Synchronous SHA-256 via Node.js `crypto` with explicit `'utf8'` encoding to guarantee cross-environment determinism.
- **Serialization**: A strict canonical serialization (`JSON.stringify`) generates the deterministic target layout, immune to object key reordering quirks across different parser engines.

### Protocol Flow
1. **Commit Phase (`/api/rounds/commit`)**
   - System securely rolls a 32-byte `serverSeed`.
   - A random `nonce` is selected.
   - The system returns only the SHA-256 hash `commitHex = SHA256(serverSeed + ":" + nonce)`.
2. **Start Phase (`/api/rounds/[id]/start`)**
   - User inputs a `clientSeed` and `dropColumn`.
   - Target generation: `combinedSeed = SHA256(serverSeed + ":" + clientSeed + ":" + nonce)`.
   - The first 8 hexadecimal characters of `combinedSeed` construct a 32-bit unsigned PRNG seed for `xorshift32`.
   - The engine generates a deterministic `pegMap` and computes a `pegMapHash`.
   - Plinko drops ball calculating each bounce. Bounces mapping to `NaN` use fallback direction 'R'.
3. **Reveal Phase (`/api/rounds/[id]/reveal`)**
   - The system reveals the unhashed `serverSeed` to the client.
4. **Verification Phase (`/verify`)**
   - Users can mathematically reproduce the `commitHex`, initial seed, `pegMapHash`, path array, and bin index fully client-side.

### Determinism Guarantee

Given identical inputs:
(serverSeed, clientSeed, nonce, dropColumn)

This system guarantees:

* Identical pegMapHash
* Identical binIndex
* Identical path

Across all executions and environments.

This ensures full reproducibility and verifiability of every round.

## Setup & Running

```bash
# 1. Install dependencies
npm install

# 2. Setup SQLite database / Generates client
npx prisma db push

# 3. Start development server
npm run dev
```

Visit `http://localhost:3000` to play.
Visit `http://localhost:3000/verify` for the mathematical verifier GUI.

## Testing

The core engine tests strictly validate against assignment test vectors.

```bash
# Run unit and integration tests
npx vitest
```

## Features
- Hardware-accelerated HTML5 Canvas visualization wrapper.
- Automatic Window DPR scaling.
- CSV Session history exporting.
- Verifier deep-linking.
- Sub-millisecond physics routing using mathematical easing curves.
- **Easter Eggs:** Use the TILT or Debug view toggle in the game view.
