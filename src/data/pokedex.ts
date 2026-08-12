export type PokemonEntry = {
  id: number
  name: string
  sprite: string
  types: string[]
}

export type PokemonIndexEntry = {
  id: number
  name: string
  url: string
}

export type PokemonPage = {
  entries: PokemonEntry[]
  totalCount: number
}

const POKEDEX_LIMIT = 1025
const DETAIL_BATCH_SIZE = 20

function formatName(rawName: string) {
  return rawName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

type LoadPokemonPageParams = {
  limit: number
  offset: number
}

type LoadPokemonIndexParams = {
  limit: number
  offset: number
}

export type PokemonTypeMap = Map<number, string[]>

type PokemonListPayload = {
  count: number
  results: Array<{ name: string; url: string }>
}

function getPokemonIdFromUrl(url: string) {
  const match = url.match(/\/pokemon\/(\d+)\/?$/)

  return match ? Number(match[1]) : 0
}

export async function loadPokemonIndex({
  limit,
  offset,
}: LoadPokemonIndexParams): Promise<{ entries: PokemonIndexEntry[]; totalCount: number }> {
  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`,
  )

  if (!response.ok) {
    throw new Error('Failed to load pokedex index')
  }

  const payload: PokemonListPayload = await response.json()

  return {
    totalCount: Math.min(payload.count, POKEDEX_LIMIT),
    entries: payload.results.map((item) => ({
      id: getPokemonIdFromUrl(item.url),
      name: formatName(item.name),
      url: item.url,
    })),
  }
}

function getPokemonIdFromIndexEntry(entry: PokemonIndexEntry) {
  if (entry.id > 0) {
    return entry.id
  }

  return getPokemonIdFromUrl(entry.url)
}

export async function loadPokemonTypeMap(): Promise<PokemonTypeMap> {
  const response = await fetch('https://pokeapi.co/api/v2/type')

  if (!response.ok) {
    throw new Error('Failed to load pokemon types')
  }

  const payload: { results: Array<{ name: string; url: string }> } =
    await response.json()

  const typeMap: PokemonTypeMap = new Map()

  for (const item of payload.results) {
    const typeResponse = await fetch(item.url)

    if (!typeResponse.ok) {
      throw new Error(`Failed to load type ${item.name}`)
    }

    const typeDetail: {
      pokemon: Array<{ pokemon: { name: string; url: string } }>
    } = await typeResponse.json()

    for (const pokemon of typeDetail.pokemon) {
      const id = getPokemonIdFromUrl(pokemon.pokemon.url)
      const normalizedType = formatName(item.name)
      const types = typeMap.get(id) ?? []

      if (!types.includes(normalizedType)) {
        types.push(normalizedType)
      }

      typeMap.set(id, types)
    }
  }

  return typeMap
}

export async function loadPokemonDetails(
  entries: PokemonIndexEntry[],
): Promise<PokemonEntry[]> {
  const detailedEntries: PokemonEntry[] = []

  for (let index = 0; index < entries.length; index += DETAIL_BATCH_SIZE) {
    const batch = entries.slice(index, index + DETAIL_BATCH_SIZE)

    const batchEntries = await Promise.all(
      batch.map(async (item) => {
        const detailResponse = await fetch(item.url)

        if (!detailResponse.ok) {
          throw new Error(`Failed to load ${item.name}`)
        }

        const detail: {
          id: number
          name: string
          sprites: { front_default: string | null }
          types: Array<{ type: { name: string } }>
        } = await detailResponse.json()

        return {
          id: detail.id || getPokemonIdFromIndexEntry(item),
          name: formatName(detail.name),
          sprite:
            detail.sprites.front_default ??
            `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${detail.id || getPokemonIdFromIndexEntry(item)}.png`,
          types: detail.types.map((type) => formatName(type.type.name)),
        }
      }),
    )

    detailedEntries.push(...batchEntries)
  }

  return detailedEntries.sort((left, right) => left.id - right.id)
}

export async function loadPokemonPage({
  limit,
  offset,
}: LoadPokemonPageParams): Promise<PokemonPage> {
  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`,
  )

  if (!response.ok) {
    throw new Error('Failed to load pokedex')
  }

  const payload: PokemonListPayload = await response.json()

  const entries: PokemonEntry[] = []

  for (let index = 0; index < payload.results.length; index += DETAIL_BATCH_SIZE) {
    const batch = payload.results.slice(index, index + DETAIL_BATCH_SIZE)

    const batchEntries = await Promise.all(
      batch.map(async (item) => {
        const detailResponse = await fetch(item.url)

        if (!detailResponse.ok) {
          throw new Error(`Failed to load ${item.name}`)
        }

        const detail: {
          id: number
          name: string
          sprites: { front_default: string | null }
          types: Array<{ type: { name: string } }>
        } = await detailResponse.json()

        return {
          id: detail.id,
          name: formatName(detail.name),
          sprite:
            detail.sprites.front_default ??
            `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${detail.id}.png`,
          types: detail.types.map((type) => formatName(type.type.name)),
        }
      }),
    )

    entries.push(...batchEntries)
  }

  return {
    entries: entries.sort((left, right) => left.id - right.id),
    totalCount: Math.min(payload.count, POKEDEX_LIMIT),
  }
}