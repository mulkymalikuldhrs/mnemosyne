'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Report to error monitoring
  if (typeof window !== 'undefined') {
    fetch('/api/system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'error_report',
        value: JSON.stringify({
          message: error.message,
          digest: error.digest,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      }),
    }).catch(() => {})
  }

  return (
    <html lang="en">
      <body>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f87171', marginBottom: '1rem' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
              {error.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#14b8a6',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
