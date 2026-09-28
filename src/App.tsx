import { useEffect, useMemo, useRef, useState } from 'react'
import chessLogo from './assets/chess-logo.png'
import './App.css'

type StreamerApiItem = {
  username?: string
  name?: string
  avatar?: string
  url?: string
  twitch_url?: string
  stream_url?: string
  is_live?: boolean
}

type Streamer = {
  username: string
  displayName: string
  avatar?: string
  url?: string
  streamUrl?: string
  isLive: boolean
  rating: number | null
}

type ViewMode = 'all' | 'top-rated' | 'live-only' | 'favorites'

const STREAMERS_URL = 'https://api.chess.com/pub/streamers'
const RATING_STATS_FIELD = 'chess_blitz.last.rating'
const FEATURED_USERNAMES = new Set([
  'magnuscarlsen',
  'nihalsarin',
  'gothamchess',
  'hikaru',
  'anastasiia',
])

const hasUsableStreamUrl = (value?: string) => {
  if (typeof value !== 'string') {
    return false
  }

  const trimmedValue = value.trim()

  if (!trimmedValue || !/^https?:\/\//i.test(trimmedValue)) {
    return false
  }

  try {
    new URL(trimmedValue)
    return true
  } catch {
    return false
  }
}

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
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<ViewMode>('all')
  const [favorites, setFavorites] = useState<string[]>([])
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
            streamUrl: entry.twitch_url ?? entry.stream_url,
            isLive: Boolean(entry.is_live),
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

    loadStreamers()

    return () => {
      controller.abort()
    }
  }, [reloadKey])

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])

  const visibleStreamers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return [...streamers]
      .filter((streamer) => {
        if (normalizedQuery.length > 0) {
          const queryTarget = `${streamer.displayName} ${streamer.username}`.toLowerCase()

          if (!queryTarget.includes(normalizedQuery)) {
            return false
          }
        }

        if (view === 'favorites' && !favoriteSet.has(streamer.username)) {
          return false
        }

        if (view === 'live-only' && !streamer.isLive) {
          return false
        }

        if (view === 'top-rated' && streamer.rating === null) {
          return false
        }

        return true
      })
      .sort((left, right) => {
        if (view === 'all') {
          const leftFeatured = FEATURED_USERNAMES.has(left.username.toLowerCase()) ? 0 : 1
          const rightFeatured = FEATURED_USERNAMES.has(right.username.toLowerCase()) ? 0 : 1

          if (leftFeatured !== rightFeatured) {
            return leftFeatured - rightFeatured
          }
        }

        const leftHasRating = typeof left.rating === 'number'
        const rightHasRating = typeof right.rating === 'number'

        if (leftHasRating !== rightHasRating) {
          return Number(rightHasRating) - Number(leftHasRating)
        }

        if (leftHasRating && rightHasRating) {
          return (right.rating ?? 0) - (left.rating ?? 0)
        }

        return left.displayName.localeCompare(right.displayName)
      })
  }, [streamers, favoriteSet, searchQuery, view])

  const toggleFavorite = (username: string) => {
    setFavorites((currentFavorites) => {
      if (currentFavorites.includes(username)) {
        return currentFavorites.filter((favorite) => favorite !== username)
      }

      return [...currentFavorites, username]
    })
  }

  return (
    <div className="app-shell">
      <header className="page-header">
        <div className="brand-block">
          <img className="brand-logo" src={chessLogo} alt="Chess.com logo" />
          <div>
            <p className="eyebrow">Chess.com</p>
            <h1>The Streamer&apos;s Gambit</h1>
          </div>
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

        {status === 'success' && (
          <>
            <div className="controls-panel">
              <label className="search-input" htmlFor="streamer-search">
                <span className="sr-only">Search streamers</span>
                <input
                  id="streamer-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search streamers"
                />
              </label>

              <div className="view-switcher" role="tablist" aria-label="Streamers views">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'top-rated', label: 'Top Rated' },
                  { value: 'live-only', label: 'Live Only' },
                  { value: 'favorites', label: 'Favorites' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={view === option.value}
                    aria-pressed={view === option.value}
                    className={view === option.value ? 'view-button active' : 'view-button'}
                    onClick={() => setView(option.value as ViewMode)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {streamers.length === 0 ? (
              <div className="state-panel empty-panel">
                <p>No streamers are currently available.</p>
              </div>
            ) : visibleStreamers.length === 0 ? (
              <div className="state-panel empty-panel">
                <p>
                  {view === 'favorites'
                    ? 'No favorites match your current search.'
                    : 'No streamers match your current filters.'}
                </p>
              </div>
            ) : (
              <ul className="streamer-grid" aria-label="Chess.com streamers">
                {visibleStreamers.map(({ username, displayName, avatar, rating, streamUrl, isLive }) => {
                  const isFavorite = favoriteSet.has(username)
                  const streamLinkAvailable = hasUsableStreamUrl(streamUrl)

                  return (
                    <li key={username} className="streamer-card">
                      <div className="streamer-topline">
                        <div className="streamer-avatar-wrap">
                          {avatar ? (
                            <img className="streamer-avatar" src={avatar} alt="" />
                          ) : (
                            <div className="streamer-avatar-fallback" aria-hidden="true">
                              {username.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className={isFavorite ? 'favorite-button active' : 'favorite-button'}
                          aria-label={
                            isFavorite ? `Remove ${username} from favorites` : `Add ${username} to favorites`
                          }
                          title={isFavorite ? 'Remove favorite' : 'Add favorite'}
                          onClick={() => toggleFavorite(username)}
                        >
                          ★
                        </button>
                      </div>

                      <div className="streamer-details">
                        <div className="streamer-header-row">
                          <h2>{displayName}</h2>
                          <span
                            className={isLive ? 'status-badge live' : 'status-badge offline'}
                            aria-label={isLive ? 'Streamer is live' : 'Streamer is offline'}
                          >
                            <span className="status-dot" aria-hidden="true" />
                            {isLive ? 'Live' : 'Offline'}
                          </span>
                        </div>
                        <p className="username">@{username}</p>
                        <p className="rating">
                          {rating === null
                            ? 'Blitz rating unavailable'
                            : `${RATING_STATS_FIELD} ${rating}`}
                        </p>
                      </div>

                      <div className="streamer-actions">
                        {streamLinkAvailable ? (
                          <a
                            href={streamUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="watch-link"
                            aria-label={`Open ${displayName}'s stream in a new tab`}
                          >
                            Watch stream
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="watch-link unavailable"
                            onClick={() => window.alert('This stream link is unavailable at the moment.')}
                            aria-label={`Stream link unavailable for ${displayName}`}
                          >
                            No stream link
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
