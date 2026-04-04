import csvText from '../assets/docs/Personal.csv?raw'
import evoCsvText from '../assets/docs/Evolutions.csv?raw'

// Type sprites — keyed by lowercase type name
const typeModules = import.meta.glob('../assets/sprites/types/*.png', { eager: true })
export const typeSprite = {}
for (const [path, mod] of Object.entries(typeModules)) {
  const filename = path.split('/').pop()
  // Filename format: "{n}_{type}.png"
  const typeName = filename.replace(/^\d+_/, '').replace('.png', '')
  typeSprite[typeName] = mod.default
}

// Form entries (IDs 494+) don't have matching sprite IDs — map them manually
const FORM_SPRITE_FILENAMES = {
  496: '386_deoxys-normal_deoxys-attack.png',
  497: '386_deoxys-normal_deoxys-defense.png',
  498: '386_deoxys-normal_deoxys-speed.png',
  499: '413_wormadam-plant_wormadam-sandy.png',
  500: '413_wormadam-plant_wormadam-trash.png',
  501: '487_giratina-altered_giratina-origin.png',
  502: '492_shaymin-land_shaymin-sky.png',
  503: '479_rotom_heat.png',
  504: '479_rotom_wash.png',
  505: '479_rotom_frost.png',
  506: '479_rotom_fan.png',
  507: '479_rotom_mow.png',
}

const spriteModules = import.meta.glob('../assets/sprites/pokemon/*.png', { eager: true })

const spriteUrlByFilename = {}
for (const [path, mod] of Object.entries(spriteModules)) {
  const filename = path.split('/').pop()
  spriteUrlByFilename[filename] = mod.default
}

function getSpriteUrl(id) {
  if (FORM_SPRITE_FILENAMES[id]) {
    return spriteUrlByFilename[FORM_SPRITE_FILENAMES[id]] ?? null
  }
  // Base pokemon sprites are named "{id}_{name}.png" with no extra underscores in the name part
  const prefix = `${id}_`
  for (const filename of Object.keys(spriteUrlByFilename)) {
    if (!filename.startsWith(prefix)) continue
    const namePart = filename.slice(prefix.length, -4) // strip prefix and .png
    if (!namePart.includes('_')) return spriteUrlByFilename[filename]
  }
  return null
}

function getBaseName(name) {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase()
}

function formatName(name) {
  // CSV stores base pokemon in ALL CAPS — convert to title case for display
  if (name === name.toUpperCase()) {
    return name.charAt(0) + name.slice(1).toLowerCase()
  }
  return name
}

const EXCLUDED_NAMES = new Set(['-----', 'Egg', 'Bad Egg'])

const ALL_POKEMON = csvText
  .trim()
  .split('\n')
  .slice(1)
  .filter(line => line.trim())
  .map(line => {
    const parts = line.split(',')
    const id = parseInt(parts[0])
    const name = parts[1]?.trim() ?? ''
    const type1 = parts[9]?.trim() ?? ''
    const type2 = parts[10]?.trim() ?? ''
    const ability1 = parts[21]?.trim() ?? ''
    const ability2 = parts[22]?.trim() ?? ''
    // parseInt handles "92 (+10)" correctly — stops at the space
    const stats = {
      hp:      parseInt(parts[2]) || 0,
      attack:  parseInt(parts[3]) || 0,
      defense: parseInt(parts[4]) || 0,
      spAtk:   parseInt(parts[5]) || 0,
      spDef:   parseInt(parts[6]) || 0,
      speed:   parseInt(parts[7]) || 0,
      bst:     parseInt(parts[8]) || 0,
    }
    return { id, name, type1, type2, ability1, ability2, stats }
  })
  .filter(p => p.name && !EXCLUDED_NAMES.has(p.name))
  .map(p => {
    // Deduplicate types and abilities (single-type/ability pokemon repeat the value)
    const types = p.type1 === p.type2 ? [p.type1] : [p.type1, p.type2]
    const abilities = [p.ability1]
    if (p.ability2 && p.ability2 !== '-' && p.ability2 !== p.ability1) abilities.push(p.ability2)
    return {
      id: p.id,
      name: p.name,
      displayName: formatName(p.name),
      baseName: getBaseName(p.name),
      sprite: getSpriteUrl(p.id),
      types,
      abilities,
      stats: p.stats,
    }
  })

// Damerau-Levenshtein distance (handles transpositions as single edits)
function dlDistance(a, b) {
  const m = a.length, n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[m][n]
}

// Max edit distance allowed before a match is rejected
function threshold(len) {
  if (len <= 2) return 0
  if (len <= 4) return 1
  return 2
}

// Returns match score: 0 = exact substring, 1+ = fuzzy edit distance, Infinity = no match
function matchScore(query, name) {
  if (name.includes(query)) return 0

  const t = threshold(query.length)
  if (t === 0) return Infinity

  // Compare query against sliding prefixes of the name at similar lengths
  let best = Infinity
  for (let len = Math.max(1, query.length - 1); len <= Math.min(name.length, query.length + 2); len++) {
    best = Math.min(best, dlDistance(query, name.slice(0, len)))
  }
  // Also compare against the full name when lengths are close
  if (Math.abs(query.length - name.length) <= 2) {
    best = Math.min(best, dlDistance(query, name))
  }

  return best <= t ? best : Infinity
}

// --- Evolution chain ---

// Parse Evolutions.csv: id → { name, evolutions: [{method, required, result}] }
const evoById = {}
const nameToEvoId = {}

evoCsvText
  .trim()
  .split('\n')
  .slice(1)
  .forEach(line => {
    const parts = line.split(',')
    const id = parseInt(parts[0])
    const name = parts[1]?.trim()
    if (!name) return

    const evolutions = []
    for (let slot = 0; slot < 7; slot++) {
      const base = 2 + slot * 3
      const method = parts[base]?.trim()
      const required = parts[base + 1]?.trim() ?? ''
      const result = parts[base + 2]?.trim()
      if (method && method !== 'None' && result && result !== '-----') {
        evolutions.push({ method, required, result })
      }
    }

    evoById[id] = { name, evolutions }
    nameToEvoId[name.toLowerCase()] = id
  })

// Reverse map: lowercase result name → source pokemon id
const prevEvoById = {}
for (const [id, { evolutions }] of Object.entries(evoById)) {
  for (const evo of evolutions) {
    prevEvoById[evo.result.toLowerCase()] = parseInt(id)
  }
}

// Fast lookup: id → full pokemon data (sprite, displayName, etc.)
export const pokemonById = Object.fromEntries(ALL_POKEMON.map(p => [p.id, p]))

// Returns the full linear evolution chain for a given pokemon ID, or null for
// pokemon with branching evolutions or chains of length < 2.
export function getEvoChain(pokemonId) {
  // Walk backwards to find the root of the chain
  let rootId = pokemonId
  const seen = new Set()
  while (true) {
    seen.add(rootId)
    const entry = evoById[rootId]
    if (!entry) break
    const prevId = prevEvoById[entry.name.toLowerCase()]
    if (prevId === undefined || seen.has(prevId)) break
    rootId = prevId
  }

  // Walk forward from root, building chain + transitions
  const chain = []
  const transitions = []
  let currentId = rootId
  seen.clear()

  while (true) {
    if (seen.has(currentId)) break
    seen.add(currentId)

    const entry = evoById[currentId]
    if (!entry) break

    // Branching: multiple distinct result pokemon
    const distinctResults = new Set(entry.evolutions.map(e => e.result.toLowerCase()))
    if (distinctResults.size > 1) return null

    const pkData = pokemonById[currentId]
    chain.push({
      id: currentId,
      displayName: pkData?.displayName ?? formatName(entry.name),
      sprite: pkData?.sprite ?? null,
    })

    if (entry.evolutions.length === 0) break

    const evo = entry.evolutions[0]
    transitions.push({ method: evo.method, required: evo.required })

    const nextId = nameToEvoId[evo.result.toLowerCase()]
    if (nextId === undefined) break
    currentId = nextId
  }

  return chain.length > 1 ? { chain, transitions } : null
}

export function search(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const scored = ALL_POKEMON
    .map(p => ({ ...p, score: matchScore(q, p.name.toLowerCase()) }))
    .filter(p => p.score < Infinity)

  if (scored.length === 0) return []

  scored.sort((a, b) => a.score - b.score)

  const directIds = new Set(scored.map(p => p.id))
  const matchedBaseNames = new Set(scored.map(p => p.baseName))

  const speciesMates = ALL_POKEMON.filter(
    p => !directIds.has(p.id) && matchedBaseNames.has(p.baseName)
  )

  return [
    ...scored.map(p => ({ ...p, isPrimary: true })),
    ...speciesMates.map(p => ({ ...p, isPrimary: false })),
  ]
}
