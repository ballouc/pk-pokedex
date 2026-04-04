import { useState, useMemo } from 'react'
import { search, typeSprite, getEvoChain, pokemonById } from './pokemon'
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

function StatGraph({ pokemon }) {
  const refPct = (STAT_REF / STAT_MAX) * 100

  return (
    <div className="stat-wrap">
      <div className="stat-bst-col">
        <span className="stat-bst-value">{pokemon.stats.bst}</span>
        <span className="stat-bst-label">BST</span>
      </div>
      <div className="stat-graph">
        <div className="stat-tracks" style={{ '--ref-pct': `${refPct}%` }}>
          <div className="stat-ref-line" />
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
