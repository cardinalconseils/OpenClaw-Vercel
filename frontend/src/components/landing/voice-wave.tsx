'use client'

export function VoiceWave() {
  const bars = [
    { delay: '0s', height: '60%' },
    { delay: '0.15s', height: '85%' },
    { delay: '0.3s', height: '100%' },
    { delay: '0.45s', height: '75%' },
    { delay: '0.6s', height: '55%' },
    { delay: '0.75s', height: '80%' },
    { delay: '0.9s', height: '65%' },
  ]

  return (
    <>
      <style>{`
        @keyframes voiceBar {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .voice-bar {
            animation: none !important;
            transform: scaleY(0.6) !important;
          }
        }
      `}</style>
      <div
        className="w-48 h-12 flex items-center justify-center gap-1"
        aria-label="Voice wave animation"
        role="img"
      >
        {bars.map((bar, i) => (
          <span
            key={i}
            className="voice-bar inline-block w-1.5 rounded-full bg-primary"
            style={{
              height: bar.height,
              animation: `voiceBar 2s ease-in-out infinite`,
              animationDelay: bar.delay,
              transformOrigin: 'center',
            }}
          />
        ))}
      </div>
    </>
  )
}
