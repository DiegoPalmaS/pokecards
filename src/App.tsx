import { useEffect, useMemo, useState } from 'react'
import { MetricCard } from './components/MetricCard'
import { PaginationControls } from './components/PaginationControls'
import { PokemonCard } from './components/PokemonCard'
import {
  loadPokemonDetails,
  loadPokemonIndex,
  loadPokemonTypeMap,
  type PokemonEntry,
  type PokemonIndexEntry,
  type PokemonTypeMap,
} from './data/pokedex'
import './App.css'

type ViewFilter = 'all' | 'caught' | 'missing'

const STORAGE_KEY = 'pokecard-caught-v1'
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
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewFilter>('all')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadedPageKey, setLoadedPageKey] = useState('')

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

  const caughtCount = useMemo(
    () => Math.min(caughtIds.size, totalCount),
    [caughtIds, totalCount],
  )

  const completion = totalCount > 0 ? (caughtCount / totalCount) * 100 : 0

  function toggleCaught(id: number) {
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

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <h1>Pokédex Personal</h1>
        </div>

        <div className="hero-stats">
          <MetricCard
            label="Capturados"
            value={`${caughtCount}`}
            hint={`${totalCount > 0 ? totalCount : '--'} en la colección`}
          />
          <MetricCard
            label="Pendientes"
            value={`${Math.max(totalCount - caughtCount, 0)}`}
            hint="Carta faltante"
          />
          <MetricCard
            label="Progreso"
            value={`${completion.toFixed(0)}%`}
            hint="Guardado automáticamente"
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
