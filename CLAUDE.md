# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (http://localhost:5173)
npm run build    # production build
npm run preview  # preview production build
npm run lint     # ESLint
```

## Stack

React 19 + Vite 8. No router — single screen app.

## Layout

The app renders a single centered window (`app-window`) split into two columns:

- **Left (30%)** — `panel-left`: search input at top, scrollable results list below
- **Right (70%)** — `panel-right`: the **detailed view**, shown when the user selects a Pokémon from the results list. Displays full information about the selected Pokémon.

Styles live in `src/App.css`. Global reset and body centering are in `src/index.css`.

## Data

### `assets/docs/Personal.csv`

The primary lookup table for Pokémon information. Contains one row per Pokémon (and alternate form), with the following key columns:

- **ID Number** — numeric Pokémon ID
- **Name** — Pokémon name
- **HP, Attack, Defense, Sp. Atk, Sp. Def, Speed** — the six base stats. Each stat's value is the integer portion of the column. Some cells contain a differential in parentheses (e.g. `92 (+10)`); the actual stat value is the number outside the parentheses, and the parenthetical differential is only used when explicitly specified.
- **Type 1 / Type 2** — typing. If a Pokémon has only one type, both columns will contain the same value — this does not mean the Pokémon has two types.
- **Ability 1 / Ability 2** — abilities. If a Pokémon has only one ability, both columns will contain the same value — this does not mean the Pokémon has two abilities.

Alternate forms (IDs 494+) do not have sprite filenames that match their CSV ID; see `src/pokemon.js` for the manual mapping.

### `assets/docs/Evolutions.csv`

Describes direct evolution relationships. Each row corresponds to one Pokémon and contains up to 7 evolution slots. Each slot is a triplet of columns: `Method, Required, Result`. A slot is inactive when Method is `None` and Result is `-----`. A Pokémon has a **branching evolution** when it has 2+ slots with distinct Result names (e.g. Eevee, Slowpoke, Gloom). The detailed view displays a full evolution chain only for species without branching.
