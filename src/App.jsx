import { useState, useMemo } from 'react'
import { search, typeSprite, categorySprite, getEvoChain, pokemonById, getLearnset } from './pokemon'
import './App.css'

const STAT_MAX = 255
const STAT_REF = 75
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
  // Offset from the bottom of .stat-tracks to where the 75 line should sit
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
  if (moves.length === 0) return null

  return (
    <div className="move-table-wrap">
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
          {moves.map(({ move, level, type, category, power, accuracy, pp }, i) => (
            <tr key={i}>
              <td>{level}</td>
              <td>{move}</td>
              <td>
                {type && typeSprite[type.toLowerCase()]
                  ? <img src={typeSprite[type.toLowerCase()]} alt={type} className="move-type-badge" />
                  : type ?? ''}
              </td>
              <td>
                {category && categorySprite[category.toLowerCase()]
                  ? <img src={categorySprite[category.toLowerCase()]} alt={category} className="move-type-badge" />
                  : category ?? ''}
              </td>
              <td>{power ? power : '—'}</td>
              <td>{accuracy ? accuracy : '—'}</td>
              <td>{pp ?? ''}</td>
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

  return (
    <div className="evo-section">
      <div className="evo-chain">
        {chain.chain.map((member, i) => (
          <>
            <div
              key={member.id}
              className={`evo-member${member.id === pokemon.id ? ' evo-member--current' : ' evo-member--selectable'}`}
              onClick={member.id !== pokemon.id ? () => onSelect(pokemonById[member.id]) : undefined}
            >
              {member.sprite
                ? <img src={member.sprite} alt={member.displayName} />
                : <div className="evo-member-placeholder" />
              }
              <span className="evo-member-name">{member.displayName}</span>
            </div>

            {i < chain.transitions.length && (
              <div key={`t${i}`} className="evo-transition">
                <div className="evo-arrow">
                  {chain.transitions[i].required && chain.transitions[i].required !== '0'
                    ? chain.transitions[i].required
                    : null}
                </div>
                <span className="evo-method">{chain.transitions[i].method}</span>
              </div>
            )}
          </>
        ))}
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
              className={`result-row ${pokemon.isPrimary ? '' : 'result-row--secondary'} ${selected?.id === pokemon.id ? 'result-row--active' : ''}`}
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
