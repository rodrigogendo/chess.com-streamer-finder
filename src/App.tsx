import { useEffect, useRef, useState } from 'react'
import './App.css'

type StreamerApiItem = {
  username?: string
  name?: string
  avatar?: string
  url?: string
  stream_url?: string
}

type Streamer = {
  username: string
  displayName: string
  avatar?: string
  url?: string
  streamUrl?: string
  rating: number | null
}

const STREAMERS_URL = 'https://api.chess.com/pub/streamers'
const RATING_STATS_FIELD = 'chess_blitz.last.rating'

async function fetchRatingsByUsername(
  usernames: string[],
  signal: AbortSignal,
): Promise<Record<string, number | null>> {
  const entries = await Promise.all(
    usernames.map(async (username) => {
      try {
        const response = await fetch(
          `https://api.chess.com/pub/player/${username}/stats`,
          { signal },
        )

        if (!response.ok) {
          return [username, null] as const
        }

        const payload = (await response.json()) as {
          chess_blitz?: { last?: { rating?: number } }
        }

        return [username, payload?.chess_blitz?.last?.rating ?? null] as const
      } catch {
        return [username, null] as const
      }
    }),
  )

  return Object.fromEntries(entries)
}

function App() {
  const [streamers, setStreamers] = useState<Streamer[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const latestRequestRef = useRef(0)

  useEffect(() => {
    const currentRequestId = ++latestRequestRef.current
    const controller = new AbortController()

    const loadStreamers = async () => {
      setStatus('loading')
      setError(null)

      try {
        const response = await fetch(STREAMERS_URL, { signal: controller.signal })

        if (!response.ok) {
          throw new Error(`Streamers request failed (${response.status})`)
        }

        const payload = (await response.json()) as { streamers?: StreamerApiItem[] }
        const streamerItems = Array.isArray(payload?.streamers) ? payload.streamers : []
        const validEntries = streamerItems.filter(
          (streamer): streamer is StreamerApiItem & { username: string } =>
            typeof streamer?.username === 'string' && streamer.username.trim().length > 0,
        )

        if (currentRequestId !== latestRequestRef.current) {
          return
        }

        if (validEntries.length === 0) {
          setStreamers([])
          setStatus('success')
          return
        }

        const usernames = validEntries.map((entry) => entry.username.trim())
        const ratingsByUsername = await fetchRatingsByUsername(
          usernames,
          controller.signal,
        )

        if (currentRequestId !== latestRequestRef.current) {
          return
        }

        const mappedStreamers = validEntries.map((entry) => {
          const username = entry.username.trim()

          return {
            username,
            displayName: entry.name?.trim() || username,
            avatar: entry.avatar,
            url: entry.url,
            streamUrl: entry.stream_url,
            rating: ratingsByUsername[username] ?? null,
          }
        })

        setStreamers(mappedStreamers)
        setStatus('success')
      } catch (caughtError) {
        if (controller.signal.aborted || currentRequestId !== latestRequestRef.current) {
          return
        }

        setStreamers([])
        setStatus('error')
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Something went wrong while loading streamers.',
        )
      }
    }

    void loadStreamers()

    return () => {
      controller.abort()
    }
  }, [reloadKey])

  return (
    <div className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Chess.com</p>
          <h1>Live streamers</h1>
        </div>
      </header>

      <main className="page-content">
        {status === 'loading' && (
          <div className="state-panel" role="status" aria-live="polite">
            <div className="spinner" aria-hidden="true" />
            <p>Loading streamers…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="state-panel error-panel" role="alert">
            <p>We couldn't load the streamers list.</p>
            <p className="error-message">{error}</p>
            <button
              type="button"
              className="retry-button"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Try again
            </button>
          </div>
        )}

        {status === 'success' && streamers.length === 0 && (
          <div className="state-panel empty-panel">
            <p>No streamers are currently available.</p>
          </div>
        )}

        {status === 'success' && streamers.length > 0 && (
          <ul className="streamer-grid" aria-label="Chess.com streamers">
            {streamers.map(({ username, displayName, avatar, rating }) => (
              <li key={username} className="streamer-card">
                <div className="streamer-avatar-wrap">
                  {avatar ? (
                    <img className="streamer-avatar" src={avatar} alt="" />
                  ) : (
                    <div className="streamer-avatar-fallback" aria-hidden="true">
                      {username.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="streamer-details">
                  <h2>{displayName}</h2>
                  <p className="username">@{username}</p>
                  <p className="rating">
                    {rating === null ? `Blitz rating unavailable` : `${RATING_STATS_FIELD} ${rating}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

export default App
