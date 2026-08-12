import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MetricCard } from './components/MetricCard'
import { PaginationControls } from './components/PaginationControls.tsx'
import { PokemonCard } from './components/PokemonCard'
import {
  loadPokemonDetails,
  loadPokemonIndex,
  loadPokemonTypeMap,
  type PokemonEntry,
  type PokemonIndexEntry,
  type PokemonTypeMap,
} from './data/pokedex'
import {
  fetchSharedProgress,
  getCurrentUser,
  isSupabaseConfigured,
  onAuthStateChange,
  saveSharedProgress,
  signInOwner,
  signOutOwner,
} from './lib/supabase'
import './App.css'

type ViewFilter = 'all' | 'caught' | 'missing'
type AppView = 'home' | 'login'

const STORAGE_KEY = 'pokecard-caught-v1'
const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL ?? ''
const MAX_ROWS_PER_PAGE = 8
const MIN_CARD_WIDTH = 185
const GRID_GAP = 16
const PANEL_PADDING = 48
const SHELL_HORIZONTAL_PADDING = 32

function calculatePageSize(viewportWidth: number) {
  const shellWidth = Math.min(1180, Math.max(viewportWidth - SHELL_HORIZONTAL_PADDING, 320))
  const contentWidth = Math.max(shellWidth - PANEL_PADDING, MIN_CARD_WIDTH)
  const columns = Math.max(
    1,
    Math.floor((contentWidth + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP)),
  )

  return columns * MAX_ROWS_PER_PAGE
}

function readStoredCaughtIds() {
  if (typeof window === 'undefined') {
    return new Set<number>()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return new Set<number>()
    }

    const parsed: unknown = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return new Set<number>()
    }

    return new Set(
      parsed.filter((value): value is number => Number.isInteger(value)),
    )
  } catch {
    return new Set<number>()
  }
}

function getCurrentAppView(): AppView {
  if (typeof window === 'undefined') {
    return 'home'
  }

  return window.location.hash === '#/login' ? 'login' : 'home'
}

function App() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [catalogEntries, setCatalogEntries] = useState<PokemonIndexEntry[]>([])
  const [pokemonTypes, setPokemonTypes] = useState<PokemonTypeMap>(new Map())
  const [pagePokemon, setPagePokemon] = useState<PokemonEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [caughtIds, setCaughtIds] = useState<Set<number>>(
    () => readStoredCaughtIds(),
  )
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [appView, setAppView] = useState<AppView>(() => getCurrentAppView())
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewFilter>('all')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadedPageKey, setLoadedPageKey] = useState('')
  const [progressHydrated, setProgressHydrated] = useState(() => !isSupabaseConfigured)
  const normalizedOwnerEmail = OWNER_EMAIL.trim().toLowerCase()
  const ownerEmailIsConfigured =
    normalizedOwnerEmail.length > 0 &&
    !normalizedOwnerEmail.includes('tu-email-propietario')

  const pageSize = useMemo(
    () => calculatePageSize(viewportWidth),
    [viewportWidth],
  )
  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return catalogEntries.filter((entry) => {
      const matchesView =
        view === 'all' ||
        (view === 'caught' && caughtIds.has(entry.id)) ||
        (view === 'missing' && !caughtIds.has(entry.id))

      const pokemonTypeNames = pokemonTypes.get(entry.id) ?? []

      const matchesQuery =
        normalizedQuery.length === 0 ||
        entry.name.toLowerCase().includes(normalizedQuery) ||
        String(entry.id).includes(normalizedQuery) ||
        pokemonTypeNames.some((type) => type.toLowerCase().includes(normalizedQuery))

      return matchesView && matchesQuery
    })
  }, [caughtIds, catalogEntries, pokemonTypes, query, view])

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize))
  const safePage = Math.min(Math.max(currentPage, 1), totalPages)
  const pageEntries = useMemo(
    () =>
      filteredEntries.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize,
      ),
    [filteredEntries, pageSize, safePage],
  )
  const pageKey = useMemo(
    () => pageEntries.map((entry) => entry.id).join(','),
    [pageEntries],
  )
  const isPageLoading =
    status === 'ready' && pageEntries.length > 0 && loadedPageKey !== pageKey
  const canEdit = useMemo(() => {
    if (!ownerUserId) {
      return false
    }

    if (!ownerEmailIsConfigured) {
      return true
    }

    return loginEmail.trim().toLowerCase() === normalizedOwnerEmail
  }, [ownerUserId, loginEmail, normalizedOwnerEmail, ownerEmailIsConfigured])

  useEffect(() => {
    let isActive = true

    Promise.all([loadPokemonIndex({ limit: 1025, offset: 0 }), loadPokemonTypeMap()])
      .then(([index, typeMap]) => {
        if (!isActive) {
          return
        }

        setCatalogEntries(index.entries)
        setPokemonTypes(typeMap)
        setTotalCount(index.totalCount)
        setStatus('ready')
      })
      .catch(() => {
        if (!isActive) {
          return
        }

        setStatus('error')
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    let isActive = true

    getCurrentUser()
      .then((user) => {
        if (!isActive) {
          return
        }

        setOwnerUserId(user?.id ?? null)
        setLoginEmail(user?.email ?? '')

        if (user?.id && getCurrentAppView() === 'login') {
          navigateTo('home')
        }
      })
      .catch(() => {
        if (!isActive) {
          return
        }

        setLoginError('No se pudo recuperar la sesión.')
      })

    const {
      data: { subscription },
    } = onAuthStateChange(async (_event, session) => {
      if (!isActive) {
        return
      }

      setOwnerUserId(session?.user?.id ?? null)
      setLoginEmail(session?.user?.email ?? '')

      if (session?.user?.id && getCurrentAppView() === 'login') {
        navigateTo('home')
      }
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    let isActive = true

    fetchSharedProgress()
      .then((sharedIds) => {
        if (!isActive) {
          return
        }

        if (Array.isArray(sharedIds)) {
          setCaughtIds(new Set(sharedIds))
        }

        setProgressHydrated(true)
      })
      .catch(() => {
        if (!isActive) {
          return
        }

        setProgressHydrated(true)
      })

    return () => {
      isActive = false
    }
  }, [ownerUserId])

  useEffect(() => {
    let isActive = true

    if (pageEntries.length === 0) {
      return () => {
        isActive = false
      }
    }

    loadPokemonDetails(pageEntries)
      .then((entries) => {
        if (!isActive) {
          return
        }

        setPagePokemon(entries)
        setLoadedPageKey(pageKey)
        setStatus('ready')
      })
      .catch(() => {
        if (!isActive) {
          return
        }

        setStatus('error')
      })

    return () => {
      isActive = false
    }
  }, [pageEntries, pageKey])

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(caughtIds)),
    )
  }, [caughtIds])

  useEffect(() => {
    if (!isSupabaseConfigured || !canEdit || !ownerUserId || !progressHydrated) {
      return
    }

    const sorted = Array.from(caughtIds).sort((left, right) => left - right)

    saveSharedProgress(sorted, ownerUserId).catch(() => {
      return undefined
    })
  }, [canEdit, caughtIds, ownerUserId, progressHydrated])

  const caughtCount = useMemo(
    () => Math.min(caughtIds.size, totalCount),
    [caughtIds, totalCount],
  )

  const completion = totalCount > 0 ? (caughtCount / totalCount) * 100 : 0

  function navigateTo(view: AppView) {
    if (typeof window === 'undefined') {
      setAppView(view)
      return
    }

    const nextHash = view === 'login' ? '#/login' : '#/'
    window.location.hash = nextHash
    setAppView(view)
  }

  function toggleCaught(id: number) {
    if (!canEdit) {
      return
    }

    setCaughtIds((current) => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  function goToPage(page: number) {
    const nextPage = Math.min(Math.max(page, 1), totalPages)
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage)
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value)

    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }

  function handleViewChange(nextView: ViewFilter) {
    setView(nextView)

    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }

  function handleOwnerLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    signInOwner(loginEmail, loginPassword)
      .then(({ user }) => {
        setOwnerUserId(user?.id ?? null)
        setLoginPassword('')
        setLoginError('')
        navigateTo('home')
      })
      .catch(() => {
        setLoginError('No se pudo iniciar sesión.')
      })
  }

  function handleOwnerLogout() {
    signOutOwner()
      .then(() => {
        setOwnerUserId(null)
        setLoginPassword('')
        setLoginError('')
      })
      .catch(() => {
        setLoginError('No se pudo cerrar sesión.')
      })
  }

  useEffect(() => {
    const handleHashChange = () => {
      setAppView(getCurrentAppView())
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  if (appView === 'login') {
    return (
      <main className="auth-view">
        <section className="auth-card">
          <h1>Iniciar sesión</h1>
          <p>Acceso exclusivo del propietario para editar estados de la colección.</p>

          <form className="owner-login" onSubmit={handleOwnerLogin}>
            <label htmlFor="owner-email">Email</label>
            <input
              id="owner-email"
              type="email"
              autoComplete="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              required
            />
            <label htmlFor="owner-password">Contraseña</label>
            <input
              id="owner-password"
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              required
            />
            {loginError ? <p className="owner-login__error">{loginError}</p> : null}
            <div className="auth-actions">
              <button type="submit" className="owner-login__submit">
                Ingresar
              </button>
              <button
                type="button"
                className="owner-login__back"
                onClick={() => navigateTo('home')}
              >
                Volver
              </button>
            </div>
            {!isSupabaseConfigured ? (
              <p className="owner-login__error">
                Falta configuración para iniciar sesión.
              </p>
            ) : null}
            {!ownerEmailIsConfigured ? (
              <p className="owner-login__error">
                Falta configurar el email propietario.
              </p>
            ) : null}
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <h1>Pokédex Personal</h1>

          {canEdit ? (
            <div className="owner-panel">
              <p className="owner-message">
                Sesión de propietario activa.
              </p>
              <button
                type="button"
                className="owner-logout"
                onClick={handleOwnerLogout}
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="owner-login-cta"
              onClick={() => navigateTo('login')}
            >
              Iniciar sesión
            </button>
          )}
        </div>

        <div className="hero-stats">
          <MetricCard
            label="Capturados"
            value={`${caughtCount}`}
            hint={`de ${totalCount > 0 ? totalCount : '--'}`}
          />
          <MetricCard
            label="Pendientes"
            value={`${Math.max(totalCount - caughtCount, 0)}`}
            hint="Cartas faltantes"
          />
          <MetricCard
            label="Progreso"
            value={`${completion.toFixed(0)}%`}
            hint="Para completar la pokédex"
          />
        </div>
      </section>

      <section className="control-panel" aria-label="Filtros de colección">
        <label className="search-box" htmlFor="pokemon-search">
          <span>Buscar en toda la Pokédex</span>
          <input
            id="pokemon-search"
            type="search"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Nombre, número o tipo de cualquier Pokémon"
          />
        </label>

        <div className="filter-pills" role="tablist" aria-label="Filtrar pokémon">
          {[
            ['all', 'Todos'],
            ['caught', 'Tengo'],
            ['missing', 'Me faltan'],
          ].map(([filter, label]) => (
            <button
              key={filter}
              type="button"
              className={view === filter ? 'pill active' : 'pill'}
              onClick={() => handleViewChange(filter as ViewFilter)}
              aria-pressed={view === filter}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="collection-panel">
        <div className="section-header">
          <div>
            <span className="section-kicker">Colección</span>
          </div>
        </div>

        {status === 'error' ? (
          <div className="state-card error-card">
            <h3>La API no respondió.</h3>
            <p>
              Revisa tu conexión e inténtalo de nuevo. Cuando vuelva a estar
              disponible, la colección se cargará automáticamente.
            </p>
          </div>
        ) : status === 'loading' ? (
          <div className="loading-grid" aria-busy="true" aria-live="polite">
            {Array.from({ length: pageSize }).map((_, index) => (
              <article className="pokemon-card skeleton" key={index}>
                <div className="skeleton-sprite" />
                <div className="skeleton-line short" />
                <div className="skeleton-line" />
                <div className="skeleton-chip-row">
                  <span className="skeleton-chip" />
                  <span className="skeleton-chip" />
                </div>
              </article>
            ))}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="state-card empty-card">
            <h3>No hay coincidencias.</h3>
            <p>
              Cambia el filtro o borra la búsqueda para ver más Pokémon en tu
              Pokédex.
            </p>
          </div>
        ) : isPageLoading ? (
          <div className="loading-grid" aria-busy="true" aria-live="polite">
            {Array.from({ length: pageSize }).map((_, index) => (
              <article className="pokemon-card skeleton" key={index}>
                <div className="skeleton-sprite" />
                <div className="skeleton-line short" />
                <div className="skeleton-line" />
                <div className="skeleton-chip-row">
                  <span className="skeleton-chip" />
                  <span className="skeleton-chip" />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="pokemon-grid">
            {pagePokemon.map((entry) => (
              <PokemonCard
                key={entry.id}
                entry={entry}
                caught={caughtIds.has(entry.id)}
                onToggle={toggleCaught}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}

        <PaginationControls
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      </section>
    </main>
  )
}

export default App
