# Pokecard

App web para gestionar tu colección de cartas Pokémon usando PokeAPI y Supabase.

## Requisitos

- Node.js 20+
- Un proyecto de Supabase

## Configuración de Supabase

1. Copia [.env.example](.env.example) a `.env` y completa:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_OWNER_EMAIL` (tu email propietario)
2. En Supabase SQL Editor ejecuta el script de [supabase/schema.sql](supabase/schema.sql).
3. Crea tu usuario en Supabase Auth (Email/Password).

Con esto:
- Visitantes pueden ver el progreso.
- Solo el usuario autenticado propietario puede marcar capturado/faltante.

## Comandos

```bash
npm install
npm run dev
```

Build y validación:

```bash
npm run build
npm run lint
```
