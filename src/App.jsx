import { useState, useMemo, useRef, useEffect, Fragment } from 'react'
import { search, typeSprite, categorySprite, getEvoChain, pokemonById, getLearnset } from './pokemon'
import './App.css'

const STAT_MAX = 255
const STAT_REF = 75 // reference line — roughly "average" single base stat
const STAT_ENTRIES = [
  { key: 'hp',      label: 'HP'  },
  { key: 'attack',  label: 'Atk' },
  { key: 'defense', label: 'Def' },
  { key: 'spAtk',   label: 'SpA' },
  { key: 'spDef',   label: 'SpD' },
  { key: 'speed',   label: 'Spe' },
]

const TRACK_HEIGHT_PX = 80  // must match .stat-track height in CSS
const BELOW_TRACK_PX   = 18  // stat-label (~14px) + gap (4px) below the track

function StatGraph({ pokemon }) {
  // Offset from the bottom of .stat-tracks to where the reference line should sit
  const refBottom = BELOW_TRACK_PX + (STAT_REF / STAT_MAX) * TRACK_HEIGHT_PX

  return (
    <div className="stat-wrap">
      <div className="stat-bst-col">
        <span className="stat-bst-value">{pokemon.stats.bst}</span>
        <span className="stat-bst-label">BST</span>
      </div>
      <div className="stat-graph">
        <div className="stat-tracks">
          <div className="stat-ref-line" style={{ bottom: refBottom }} />
          {STAT_ENTRIES.map(({ key, label }) => (
            <div key={key} className="stat-col">
              <span className="stat-value">{pokemon.stats[key]}</span>
              <div className="stat-track">
                <div
                  className="stat-fill"
                  style={{ height: `${(pokemon.stats[key] / STAT_MAX) * 100}%` }}
                />
              </div>
              <span className="stat-label">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MoveTable({ pokemon }) {
  const moves = useMemo(() => getLearnset(pokemon.id), [pokemon.id])
  const [tooltip, setTooltip] = useState(null)
  const timerRef = useRef(null)
  const posRef = useRef({ x: 0, y: 0 })

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function handleMouseMove(e) {
    posRef.current = { x: e.clientX, y: e.clientY }
  }

  function handleRowEnter(move) {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const priorityStr = move.priority > 0 ? `+${move.priority}` : String(move.priority ?? 0)
      setTooltip({
        x: posRef.current.x,
        y: posRef.current.y,
        text: `${move.targets}; ${move.additionalEffect}; (${priorityStr})`,
      })
    }, 1000)
  }

  function handleRowLeave() {
    clearTimeout(timerRef.current)
    setTooltip(null)
  }

  if (moves.length === 0) return null

  return (
    <div className="move-table-wrap" onMouseMove={handleMouseMove}>
      {tooltip && (
        <div className="move-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
          {tooltip.text}
        </div>
      )}
      <table className="move-table">
        <thead>
          <tr>
            <th>Level</th>
            <th>Name</th>
            <th>Type</th>
            <th>Cat.</th>
            <th>Pow.</th>
            <th>Acc.</th>
            <th>PP</th>
          </tr>
        </thead>
        <tbody>
          {moves.map((move, i) => (
            <tr key={i} onMouseEnter={() => handleRowEnter(move)} onMouseLeave={handleRowLeave}>
              <td>{move.level}</td>
              <td>{move.move}</td>
              <td>
                {move.type && typeSprite[move.type.toLowerCase()]
                  ? <img src={typeSprite[move.type.toLowerCase()]} alt={move.type} className="move-type-badge" />
                  : move.type ?? ''}
              </td>
              <td>
                {move.category && categorySprite[move.category.toLowerCase()]
                  ? <img src={categorySprite[move.category.toLowerCase()]} alt={move.category} className="move-type-badge" />
                  : move.category ?? ''}
              </td>
              <td>{move.power || '—'}</td>
              <td>{move.accuracy || '—'}</td>
              <td>{move.pp ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EvolutionChain({ pokemon, onSelect }) {
  const chain = useMemo(() => getEvoChain(pokemon.id), [pokemon.id])
  if (!chain) return null

  function renderMember(member) {
    const isCurrent = member.id === pokemon.id
    return (
      <div
        className={`evo-member${isCurrent ? ' evo-member--current' : ' evo-member--selectable'}`}
        onClick={!isCurrent ? () => onSelect(pokemonById[member.id]) : undefined}
      >
        {member.sprite
          ? <img src={member.sprite} alt={member.displayName} />
          : <div className="evo-member-placeholder" />
        }
        <span className="evo-member-name">{member.displayName}</span>
      </div>
    )
  }

  function renderTransition(transition) {
    if (!transition) return null
    return (
      <div className="evo-transition">
        <div className="evo-arrow">
          {transition.required && transition.required !== '0' ? transition.required : null}
        </div>
        <span className="evo-method">{transition.method}</span>
      </div>
    )
  }

  return (
    <div className="evo-section">
      <div className="evo-chain">
        {chain.chain.map((member, i) => (
          <Fragment key={member.id}>
            {renderMember(member)}
            {i < chain.chain.length - 1 && renderTransition(chain.transitions[i])}
          </Fragment>
        ))}

        {chain.branches && (
          <div className="evo-branches">
            {chain.branches.map(branch => (
              <div key={branch.member.id} className="evo-branch">
                {renderTransition(branch.transition)}
                {renderMember(branch.member)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PokemonDetail({ pokemon, onSelect }) {
  return (
    <div className="detail-pane">
      <div className="detail-header">
        <div className="detail-sprite-wrap">
          {pokemon.sprite && (
            <img src={pokemon.sprite} alt={pokemon.displayName} className="detail-sprite" />
          )}
        </div>
        <div className="detail-info">
          <h2 className="detail-name">{pokemon.displayName}</h2>
          <div className="detail-types">
            {pokemon.types.map(type => {
              const url = typeSprite[type.toLowerCase()]
              return url
                ? <img key={type} src={url} alt={type} className="type-badge" />
                : <span key={type} className="type-badge-text">{type}</span>
            })}
          </div>
          <div className="detail-abilities">
            {pokemon.abilities.join(' / ')}
          </div>
        </div>
      </div>

      <StatGraph pokemon={pokemon} />
      <EvolutionChain pokemon={pokemon} onSelect={onSelect} />
      <MoveTable pokemon={pokemon} />
    </div>
  )
}

function App() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const results = useMemo(() => search(query), [query])

  return (
    <div className="app-window">
      <div className="panel-left">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search Pokémon..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="search-results">
          {results.map(pokemon => (
            <div
              key={pokemon.id}
              className={[
                'result-row',
                !pokemon.isPrimary && 'result-row--secondary',
                selected?.id === pokemon.id && 'result-row--active',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelected(pokemon)}
            >
              <div className="result-sprite">
                {pokemon.sprite
                  ? <img src={pokemon.sprite} alt={pokemon.displayName} />
                  : <div className="result-sprite-placeholder" />
                }
              </div>
              <span className="result-name">{pokemon.displayName}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-right">
        {selected && <PokemonDetail pokemon={selected} onSelect={setSelected} />}
      </div>
    </div>
  )
}

export default App
