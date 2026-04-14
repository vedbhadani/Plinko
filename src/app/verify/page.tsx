'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import VerifierForm from '../../components/VerifierForm';

export default function VerifyPage() {
  return (
    <main className="flex flex-col items-center gap-lg p-lg" style={{ minHeight: '100vh' }}>
      <header className="flex justify-start w-full max-w-4xl">
        <Link href="/" className="btn text-sm">
          &larr; Back to Game
        </Link>
      </header>

      <div className="w-full max-w-4xl text-center">
        <h1 className="text-xl font-bold mb-2">Provably Fair Verifier</h1>
        <p className="text-muted text-sm">
          Plinko outcomes are determined by a SHA-256 commit-reveal scheme and a deterministic xorshift32 PRNG.
          You can use this tool to independently verify any completed round mathematically without trusting our database.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <Suspense fallback={<div>Loading verifier...</div>}>
          <VerifierForm />
        </Suspense>
      </div>
      
    </main>
  );
}
