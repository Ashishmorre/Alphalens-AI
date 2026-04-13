'use client'

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'monospace' }}>
          <h2>Critical System Error</h2>
          <button onClick={() => reset()} style={{ padding: '0.5rem 1rem' }}>
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
