import { PAYTABLE } from '@/lib/paytable';

interface PaytableDisplayProps {
  activeBinIndex?: number | null;
}

export default function PaytableDisplay({ activeBinIndex }: PaytableDisplayProps) {
  // We have 13 bins (0-12)
  return (
    <div className="flex justify-between items-center gap-xs" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      {PAYTABLE.map((multiplier, i) => {
        // Color coding logic:
        // Hotter colors for higher multipliers
        let bgColor = '#12122a'; // Default surface
        let borderColor = 'rgba(255,255,255,0.1)';
        
        if (multiplier >= 100) {
          bgColor = '#e17055'; // Danger (red)
        } else if (multiplier >= 10) {
          bgColor = '#fdcb6e'; // Warning (yellow)
        } else if (multiplier >= 3) {
          bgColor = '#00b894'; // Success (green)
        } else if (multiplier < 2) {
          bgColor = '#6c5ce7'; // Primary (purple/blue for low bounds)
        }

        const isActive = activeBinIndex === i;

        return (
          <div
            key={i}
            className={`flex flex-col items-center justify-center rounded p-sm`}
            style={{
              backgroundColor: isActive ? '#fff' : bgColor,
              color: isActive ? '#000' : '#fff',
              border: `1px solid ${borderColor}`,
              boxShadow: isActive ? '0 0 15px rgba(255,255,255,0.8)' : 'none',
              transform: isActive ? 'scale(1.1) translateY(-10px)' : 'scale(1)',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              fontWeight: 'bold',
              flex: 1,
              fontSize: '0.8rem',
              zIndex: isActive ? 10 : 1
            }}
          >
            {multiplier}x
          </div>
        );
      })}
    </div>
  );
}
