@../CLAUDE.md

# Matchmaker — CLAUDE.md
**REF-DS/CLAUDE/MATCHMAKER v1.0**

## Identité

- **Code agent :** AG003
- **Tier design :** T2 — Product
- **Couleur accent :** Green `#A5D900` (`--color-green`)
- **Périmètre :** Besoin → ressource idéale → score radar expliqué

## Stack technique

| Couche | Tech |
|--------|------|
| Frontend | React + Vite (`matchmaker/app/`) |
| Backend | Express.js (`matchmaker/server/`) |
| Build | Vite |

## Structure

```
matchmaker/
├── app/          ← Frontend React
└── server/       ← API Express
```

## Opérateurs utilisés

`OP-008 Embedding`, `OP-011 Vector Store`, `OP-002 LLM`

Modules : `MA-01 RH`, `MA-02 Conseil`

## Règles UX spécifiques

- Le **score radar** est l'élément central de Matchmaker — il doit être visible, lisible, expliqué.
- Chaque dimension du radar porte un label JetBrains Mono UPPERCASE.
- L'accent green `#A5D900` est utilisé pour les scores positifs et le CTA principal.
- Les ressources matchées sont présentées avec un score numérique + explication textuelle.

## État design

⚠️ À explorer et aligner avec T2 — border-radius 6px, accent green, tokens `@liteops/ds`.
