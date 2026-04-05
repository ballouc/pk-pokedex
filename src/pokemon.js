import csvText from '../assets/docs/Personal.csv?raw'
import evoCsvText from '../assets/docs/Evolutions.csv?raw'
import learnsetCsvText from '../assets/docs/Learnsets.csv?raw'
import movesCsvText from '../assets/docs/Moves.csv?raw'

// Type sprites — keyed by lowercase type name
const typeModules = import.meta.glob('../assets/sprites/types/*.png', { eager: true })
export const typeSprite = {}
for (const [path, mod] of Object.entries(typeModules)) {
  const filename = path.split('/').pop()
  const typeName = filename.replace(/^\d+_/, '').replace('.png', '')
  typeSprite[typeName] = mod.default
}

// Category sprites — keyed by lowercase category name (physical, special, status)
const categoryModules = import.meta.glob('../assets/sprites/categories/*.png', { eager: true })
export const categorySprite = {}
for (const [path, mod] of Object.entries(categoryModules)) {
  const filename = path.split('/').pop()
  categorySprite[filename.replace('.png', '')] = mod.default
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

// CSV parser that respects double-quoted fields containing commas
function parseCsvLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

function getBaseName(name) {
  // Returns lowercase base species name, stripping form suffixes like " (A)" or " (Heat)"
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
    const parts = parseCsvLine(line)
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
    const parts = parseCsvLine(line)
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

// Returns the evolution chain for a given pokemon ID, or null for chains of
// length < 2. For branching chains, shows all branches when the selected
// pokemon is at/before the branch point, or only the relevant branch otherwise.
// Return shape: { chain, transitions, branches } where branches is null for
// linear chains, or an array of { member, transition } for branching chains.
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

  // Pre-compute all ancestors of the selected pokemon (including itself) so
  // we can determine which branch leads to it when skipping alternate paths.
  const ancestorsOfSelected = new Set()
  {
    let id = pokemonId
    const walked = new Set()
    while (id !== undefined && !walked.has(id)) {
      ancestorsOfSelected.add(id)
      walked.add(id)
      const entry = evoById[id]
      if (!entry) break
      id = prevEvoById[entry.name.toLowerCase()]
    }
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

    const pkData = pokemonById[currentId]
    const member = {
      id: currentId,
      displayName: pkData?.displayName ?? formatName(entry.name),
      sprite: pkData?.sprite ?? null,
    }

    const distinctResults = [...new Set(entry.evolutions.map(e => e.result.toLowerCase()))]

    // Collect unique (method, required) pairs for a set of evolution entries
    function methodsFor(evos) {
      const seen = new Set()
      return evos.filter(e => {
        const key = `${e.method}|${e.required}`
        return seen.has(key) ? false : (seen.add(key), true)
      }).map(e => ({ method: e.method, required: e.required }))
    }

    if (distinctResults.length > 1) {
      chain.push(member)

      if (chain.some(m => m.id === pokemonId)) {
        // Selected pokemon is at or before this branch — show all branches
        const branches = distinctResults.map(result => {
          const branchId = nameToEvoId[result]
          if (branchId === undefined) return null
          const branchPkData = pokemonById[branchId]
          const branchEntry = evoById[branchId]
          const evosForResult = entry.evolutions.filter(e => e.result.toLowerCase() === result)
          return {
            member: {
              id: branchId,
              displayName: branchPkData?.displayName ?? (branchEntry ? formatName(branchEntry.name) : result),
              sprite: branchPkData?.sprite ?? null,
            },
            transition: methodsFor(evosForResult),
          }
        }).filter(Boolean)
        return { chain, transitions, branches }
      } else {
        // Selected pokemon is in one branch — follow only that branch
        const targetResult = distinctResults.find(result => {
          const branchId = nameToEvoId[result]
          return branchId !== undefined && ancestorsOfSelected.has(branchId)
        })
        if (!targetResult) break
        const evosForResult = entry.evolutions.filter(e => e.result.toLowerCase() === targetResult)
        transitions.push(methodsFor(evosForResult))
        currentId = nameToEvoId[targetResult]
        continue
      }
    }

    chain.push(member)

    if (entry.evolutions.length === 0) break

    transitions.push(methodsFor(entry.evolutions))

    const nextId = nameToEvoId[entry.evolutions[0].result.toLowerCase()]
    if (nextId === undefined) break
    currentId = nextId
  }

  return chain.length > 1 ? { chain, transitions, branches: null } : null
}

// --- Moves ---

// lowercase name → { additionalEffect, category, power, type, accuracy, pp, targets, priority }
const moveDataByName = {}

movesCsvText
  .trim()
  .split('\n')
  .slice(1)
  .forEach(line => {
    const parts = parseCsvLine(line)
    const name = parts[1]?.trim()
    if (!name || name === '-') return
    moveDataByName[name.toLowerCase()] = {
      additionalEffect: parts[2]?.trim() ?? '',
      category:         parts[3]?.trim() ?? '',
      power:            parseInt(parts[4]) || 0,
      type:             parts[5]?.trim() ?? '',
      accuracy:         parseInt(parts[6]) || 0,
      pp:               parseInt(parts[7]) || 0,
      targets:          parts[9]?.trim() ?? '',
      priority:         parseInt(parts[10]) || 0,
    }
  })

// --- Learnsets ---

// id → [{ move, level, ...moveData }]
const learnsetById = {}

learnsetCsvText
  .trim()
  .split('\n')
  .slice(1)
  .forEach(line => {
    const parts = parseCsvLine(line)
    const id = parseInt(parts[0])
    const moves = []
    // Pairs start at column 2: (move, level), (move, level), ...
    for (let i = 2; i < parts.length - 1; i += 2) {
      const move = parts[i]?.trim()
      const level = parseInt(parts[i + 1]) || null
      if (!move) continue
      moves.push({ move, level, ...(moveDataByName[move.toLowerCase()] ?? {}) })
    }
    learnsetById[id] = moves
  })

export function getLearnset(pokemonId) {
  return learnsetById[pokemonId] ?? []
}

export function search(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const scored = ALL_POKEMON
    .map(p => ({ ...p, score: matchScore(q, p.name.toLowerCase()) }))
    .filter(p => p.score < Infinity)

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
