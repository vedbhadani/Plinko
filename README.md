# 🟣 Provably Fair Plinko Lab

A high-performance, provably fair Plinko web application built with **Next.js 16**, **Prisma**, and **HTML5 Canvas**. This project implements a rigorous cryptographic commit-reveal protocol to ensure every round is 100% deterministic and verifiable.

## 🏗️ Technical Architecture

### Tech Stack
- **Frontend**: Next.js 16.2.3 (App Router), React, TypeScript.
- **Visuals**: High-performance HTML5 Canvas with automatic Device Pixel Ratio (DPR) scaling for sharp rendering.
- **Backend**: Next.js API Routes with strict input validation.
- **Database**: PostgreSQL with Prisma ORM for session logging and round persistence.
- **Audio**: Web Audio API for procedural sound synthesis (no external assets needed).

### Core Fairness Implementation
- **Hashing**: SHA-256 (synchronous) using Node.js `crypto` with explicit UTF-8 encoding.
- **PRNG**: `xorshift32` (Shift constants: 13, 17, 5). Ensures cycle accuracy and handles 32-bit unsigned integer wrapping.
- **Deterministic Engine**: 
  - Triangular peg layout (12 rows, 13 bins).
  - Peg-specific `leftBias` generated deterministically at the start of each round.
  - Formula: `leftBias = 0.5 + (rand() - 0.5) * 0.2` (rounded to 6 decimal places).
  - Deterministic PRNG stream order: 1. Peg Map generation → 2. Path decisions.

## 🛡️ Fairness Specification

This project follows a standard **Commit-Reveal** protocol:

1. **Commit**: Server generates a `serverSeed` (32-byte hex) and a `nonce`. It publishes `commitHex = SHA256(serverSeed + ":" + nonce)`.
2. **Contribution**: Player provides a `clientSeed`.
3. **Combination**: `combinedSeed = SHA256(serverSeed + ":" + clientSeed + ":" + nonce)`.
4. **Outcome**: The `combinedSeed` is used to seed the `xorshift32` PRNG, which determines every peg bias and ball bounce.
5. **Reveal**: After the round, the `serverSeed` is revealed. Users can verify the outcome on the `/verify` page.

## 🕹️ Features & Easter Eggs

### Easter Eggs
- **TILT Mode**: Press **`T`** to rotate the board and apply a vintage arcade CRT filter.
- **Debug Grid**: Press **`G`** to overlay peg coordinates and RNG values.
- **Golden Ball**: Land 3 consecutive balls in the center bin (index 6) to trigger a Golden Ball with a trailing effect.
- **Secret Theme**: Type `open sesame` to enable a dungeon theme for the next round.

### Accessibility
- **Keyboard Controls**: 
  - `A` / `ArrowLeft`: Move drop column left.
  - `D` / `ArrowRight`: Move drop column right.
  - `Space` / `Enter`: Drop ball.
- **Reduced Motion**: Respects browser `prefers-reduced-motion` settings by skipping confetti/trails and shortening the drop animation.

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Create a PostgreSQL database and point .env at it

# 3. Apply the Prisma migration
npx prisma migrate deploy

# 4. Start development
npm run dev
```

### Environment Variables

Create `.env` from `.env.example`:

```env
DATABASE_URL="postgresql://postgres@localhost:54329/plinko_lab?schema=public"
DIRECT_URL="postgresql://postgres@localhost:54329/plinko_lab?schema=public"
```

## 🧪 Testing

Verified against assignment test vectors.

```bash
npm test
```

### Standalone Validation Scripts

The repository includes several standalone scripts for manual verification and engine auditing:

- **`scratch/`**: Contains core logic validation tools.
  - `scratch/verify_spec.js`: Automates verification against the assignment's official test vectors.
  - `scratch/determinism_test.js`: Validates that the engine produces identical results for identical seeds across multiple runs.
  - `scratch/verify_pegmap.js`: Visualizes and verifies the integrity of the generated peg bias map.
- **Root Scripts**:
  - `test-prng.js`: Unit test for the `xorshift32` implementation.
  - `verify.js`: A command-line version of the verification logic.
  - `reverse.js` / `test-reverse.js`: Tools used during development to verify path reconstruction from drop positions.

### Assignment Test Vectors

- `serverSeed`: `b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc`
- `clientSeed`: `candidate-hello`
- `nonce`: `42`
- `commitHex`: `bb9acdc67f3f18f3345236a01f0e5072596657a9005c7d8a22cff061451a6b34`
- `combinedSeed`: `e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0`
- `prngSeed`: `3789414263`
- First five PRNG values: `0.1106166649`, `0.7625129214`, `0.0439292176`, `0.4578678815`, `0.3438999297`
- First peg rows: `[0.422123]`, `[0.552503,0.408786]`, `[0.491574,0.46878,0.43654]`

## 🌐 Live Deployment

- **GitHub Repo**: https://github.com/vedbhadani/Plinko
- **Live App**: https://plinko-lab.vercel.app
- **Verifier Page**: https://plinko-lab.vercel.app/verify
- **Local Example Round Permalink**: http://localhost:3000/verify?roundId=cmnzvizvt000fpptvffcrk5gg
- **Production Permalink Format**: `https://plinko-lab.vercel.app/verify?roundId=<revealed-round-id>`

After creating and revealing a round, open `/verify?roundId=<roundId>` to prefill the stored round and show a field-by-field PASS/FAIL comparison with replay.

## 📝 Submission Details

### AI Usage Log
- **Role**: Antigravity AI was used as a senior pair programmer and auditor.
- **Key Contributions**:
  - Implemented the core `xorshift32` logic and verified against spec test vectors.
  - Audited and fixed 6 "Critical Blockers" related to seed extraction and database types.
  - Developed the Canvas animation system and landing confetti.
  - Automated the verification suite (`scratch/verify_spec.js`) to ensure math parity.
  - Compared the implementation against the assignment PDF and tightened verifier, replay, validation, responsive layout, and README deliverables.

### Time Log
- **Total Time**: ~5 hours.
- **Phase 1 (Setup & Engine)**: 2 hours.
- **Phase 2 (Audit & Refactoring)**: 1.5 hours.
- **Phase 3 (Polish & Accessibility)**: 1.5 hours.

### With More Time
- Add a compact bias heatmap view to the verifier so peg-level bias and RNG flow are visible at a glance.
- Add Playwright coverage for `/verify?roundId=...` and mobile layout screenshots.
- Add a cleaner realtime transport for the session log instead of lightweight polling.
