import type { PokemonEntry } from '../data/pokedex'

type PokemonCardProps = {
  entry: PokemonEntry
  caught: boolean
  onToggle: (id: number) => void
}

export function PokemonCard({ entry, caught, onToggle }: PokemonCardProps) {
  return (
    <article className={caught ? 'pokemon-card caught' : 'pokemon-card'}>
      <div className="pokemon-card__art">
        <span className="pokemon-id">#{String(entry.id).padStart(3, '0')}</span>
        <img src={entry.sprite} alt={entry.name} loading="lazy" />
      </div>

      <div className="pokemon-card__body">
        <div className="pokemon-card__heading">
          <h3>{entry.name}</h3>
          <p className={caught ? 'status-badge caught' : 'status-badge missing'}>
            {caught ? 'Tengo' : 'Me falta'}
          </p>
        </div>

        {/* <div className="type-row" aria-label={`Tipos de ${entry.name}`}>
          {entry.types.map((type) => (
            <span key={type} className="type-chip">
              {type}
            </span>
          ))}
        </div> */}

        <button
          type="button"
          className={caught ? 'toggle-button caught' : 'toggle-button'}
          onClick={() => onToggle(entry.id)}
          aria-pressed={caught}
        >
          {caught ? 'Marcar como faltante' : 'Marcar como capturado'}
        </button>
      </div>
    </article>
  )
}