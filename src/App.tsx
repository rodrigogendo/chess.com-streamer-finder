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
  index: number
}

type ViewMode = 'all' | 'live-only' | 'favorites'

const STREAMERS_URL = 'https://api.chess.com/pub/streamers'
const POPULAR_USERNAMES = new Set([
  'magnuscarlsen',
  'nihalsarin',
  'gothamchess',
  'hikaru',
  'anastasiia',
])

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'live-only', label: 'Live Only' },
  { value: 'favorites', label: 'Favorites' },
]

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

const getPreferredStreamAction = (streamer: { streamUrl?: string; url?: string; isLive: boolean }) => {
  if (streamer.isLive) {
    return { href: streamer.streamUrl, label: 'Watch stream', isProfile: false }
  }

  if (typeof streamer.url === 'string' && streamer.url.trim()) {
    return { href: streamer.url, label: 'View Chess.com Profile', isProfile: true }
  }

  return { href: undefined, label: 'View Chess.com Profile', isProfile: true }
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

        const mappedStreamers = validEntries.map((entry, index) => {
          const username = entry.username.trim()

          return {
            username,
            displayName: entry.name?.trim() || username,
            avatar: entry.avatar,
            url: entry.url,
            streamUrl: entry.twitch_url ?? entry.stream_url,
            isLive: Boolean(entry.is_live),
            index,
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

        return true
      })
      .sort((left, right) => {
        if (view === 'all') {
          const leftPopular = POPULAR_USERNAMES.has(left.username.toLowerCase()) ? 0 : 1
          const rightPopular = POPULAR_USERNAMES.has(right.username.toLowerCase()) ? 0 : 1

          if (leftPopular !== rightPopular) {
            return leftPopular - rightPopular
          }

          if (left.isLive !== right.isLive) {
            return Number(right.isLive) - Number(left.isLive)
          }

          return left.index - right.index
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
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={view === option.value}
                    aria-pressed={view === option.value}
                    className={view === option.value ? 'view-button active' : 'view-button'}
                    onClick={() => setView(option.value)}
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
                {visibleStreamers.map(({ username, displayName, avatar, streamUrl, isLive, url }) => {
                  const isFavorite = favoriteSet.has(username)
                  const preferredAction = getPreferredStreamAction({ streamUrl, url, isLive })
                  const streamLinkAvailable = hasUsableStreamUrl(preferredAction.href)

                  return (
                    <li key={username} className="streamer-card">
                      <div className="streamer-topline">
                        <div className="streamer-identity">
                          <div className="streamer-avatar-wrap">
                            {avatar ? (
                              <img className="streamer-avatar" src={avatar} alt="" />
                            ) : (
                              <div className="streamer-avatar-fallback" aria-hidden="true">
                                {username.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
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
                        <h2 title={displayName}>{displayName}</h2>
                        <span
                          className={isLive ? 'status-badge live' : 'status-badge offline'}
                          aria-label={isLive ? 'Streamer is live' : 'Streamer is offline'}
                        >
                          <span className="status-dot" aria-hidden="true" />
                          {isLive ? 'Live' : 'Offline'}
                        </span>
                      </div>

                      <div className="streamer-actions">
                        {streamLinkAvailable ? (
                          <a
                            href={preferredAction.href}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="watch-link"
                            aria-label={
                              preferredAction.isProfile
                                ? `Open ${displayName}'s Chess.com profile in a new tab`
                                : `Open ${displayName}'s stream in a new tab`
                            }
                          >
                            {preferredAction.label}
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="watch-link unavailable"
                            onClick={() =>
                              window.alert(
                                preferredAction.isProfile
                                  ? 'This profile link is unavailable at the moment.'
                                  : 'This stream link is unavailable at the moment.',
                              )
                            }
                            aria-label={
                              preferredAction.isProfile
                                ? `Profile link unavailable for ${displayName}`
                                : `Stream link unavailable for ${displayName}`
                            }
                          >
                            {preferredAction.label}
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
