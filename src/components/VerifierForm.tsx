'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function VerifierForm() {
  const searchParams = useSearchParams();
  
  const [serverSeed, setServerSeed] = useState('');
  const [clientSeed, setClientSeed] = useState('');
  const [nonce, setNonce] = useState('');
  const [dropColumn, setDropColumn] = useState('6');
  
  const [actualCommitHex, setActualCommitHex] = useState('');
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<any>(null);

  // Auto-fill from query params if roundId is present
  useEffect(() => {
    const roundId = searchParams.get('roundId');
    if (roundId) {
      // Fetch round details to pre-populate
      fetch(`/api/rounds/${roundId}`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            setServerSeed(data.serverSeed || '');
            setClientSeed(data.clientSeed || '');
            setNonce(data.nonce || '');
            setDropColumn(data.dropColumn?.toString() || '6');
            setActualCommitHex(data.commitHex || '');
            if (!data.serverSeed) {
               setStatusText('Round is not REVEALED yet. Server seed is hidden.');
            }
          }
        });
    }
  }, [searchParams]);

  const handleVerify = async () => {
    try {
      setStatusText('Verifying deterministically...');
      setResult(null);

      const url = new URL(window.location.origin + '/api/verify');
      url.searchParams.set('serverSeed', serverSeed);
      url.searchParams.set('clientSeed', clientSeed);
      url.searchParams.set('nonce', nonce);
      url.searchParams.set('dropColumn', dropColumn);

      const res = await fetch(url);
      const data = await res.json();
      
      if (!res.ok) {
        setStatusText(`Error: ${data.error}`);
        return;
      }

      setResult(data);
      
      let isVerified = true;
      let msg = 'Verification successful! Deterministic outcomes match.';
      
      if (actualCommitHex && actualCommitHex !== data.commitHex) {
         isVerified = false;
         msg = 'Verification FAILED: Recomputed commit hash does not match original.';
      }

      setStatusText(msg);

    } catch(err) {
      console.error(err);
      setStatusText('An error occurred during verification.');
    }
  };

  return (
    <div className="card flex flex-col gap-md">
       <div>
         <label>Server Seed (Revealed after round)</label>
         <input 
           type="text" 
           value={serverSeed} 
           onChange={e => setServerSeed(e.target.value)} 
           placeholder="64-character hex string"
         />
       </div>

       <div>
         <label>Client Seed</label>
         <input 
           type="text" 
           value={clientSeed} 
           onChange={e => setClientSeed(e.target.value)} 
         />
       </div>

       <div>
         <label>Nonce</label>
         <input 
           type="text" 
           value={nonce} 
           onChange={e => setNonce(e.target.value)} 
         />
       </div>

       <div>
         <label>Drop Column</label>
         <input 
           type="text" 
           value={dropColumn} 
           onChange={e => setDropColumn(e.target.value)} 
         />
       </div>

       {actualCommitHex && (
         <div className="p-sm mt-2 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
           <label>Expected Commit Hash (From DB)</label>
           <div className="font-mono text-sm break-all">{actualCommitHex}</div>
         </div>
       )}

       <button className="btn btn-primary mt-4" onClick={handleVerify}>
         Verify Mathematically
       </button>

       {statusText && (
         <div className={`p-md rounded mt-4 ${statusText.includes('Error') || statusText.includes('FAILED') ? 'text-danger' : 'text-success'}`} style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
           <strong>{statusText}</strong>
         </div>
       )}

       {result && (
         <div className="p-sm mt-2 rounded flex flex-col gap-sm" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
           <div>
             <label>Recomputed Commit Hash</label>
             <div className="font-mono text-sm break-all" style={{color: actualCommitHex && result.commitHex === actualCommitHex ? 'var(--color-success)' : 'inherit'}}>
               {result.commitHex}
             </div>
           </div>
           
           <div>
             <label>Combined Seed Hex (SHA-256)</label>
             <div className="font-mono text-sm break-all">{result.combinedSeed}</div>
           </div>

           <div>
             <label>Peg Map Hash</label>
             <div className="font-mono text-sm break-all">{result.pegMapHash}</div>
           </div>

           <div className="flex gap-md">
             <div>
               <label>Result Bin Index</label>
               <div className="font-bold text-lg">{result.binIndex}</div>
             </div>
           </div>

           <div>
             <label>Path (Directions)</label>
             <div className="font-mono text-sm break-all">{result.path?.join(', ')}</div>
           </div>
         </div>
       )}
    </div>
  );
}
