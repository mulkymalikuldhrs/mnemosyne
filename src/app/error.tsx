'use client'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h2>
        <p className="text-slate-400 mb-6">{error.message}</p>
        <button onClick={reset} className="px-4 py-2 bg-teal-600 rounded hover:bg-teal-500">Try again</button>
      </div>
    </div>
  )
}
