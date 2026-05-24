# ADR-0007 — Conventional Commits y flujo de PR sobre rama protegida

- **Estado:** Aceptado
- **Fecha:** 2026-05-22
- **Decisores:** Jorge

## Contexto

El proyecto debe quedar como base de mentoría — eso incluye **demostrar
el flujo profesional** completo de desarrollo (no solo el código). Hay
varias dimensiones acopladas:

- Cómo se nombran las ramas.
- Cómo se escriben los mensajes de commit.
- Cómo se integra al `main`.
- Qué validaciones corren automáticamente.

Equipo actual: 1 developer (Jorge) + soporte comercial (Edguitar). El
flujo no puede bloquear el trabajo solo (no podemos requerir aprobaciones
de un segundo developer porque no hay).

## Decisión

Adoptamos el siguiente flujo, todo automatizado donde se puede:

1. **`main` está protegida** en GitHub. No se commitea directo. Aplica
   también para admins (`enforce_admins: true`).
2. **Trunk-based:** ramas cortas que salen de `main` con prefijos
   `feat/`, `fix/`, `chore/`, `docs/`.
3. **Commits** siguen **Conventional Commits**: `tipo(scope): descripción`.
   Validados por `commitlint` en el hook `commit-msg`. Tipos:
   `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`.
4. **Pre-commit hook**: `lint-staged` corre `eslint --fix` + `prettier`
   sobre los archivos staged.
5. **CI sobre el PR**: lint + typecheck + tests deben estar verdes para
   poder mergear. **0 aprobaciones requeridas** (no hay segundo dev).
6. **Merge:** squash + delete branch — un commit por PR, historia
   limpia en `main`.

## Alternativas consideradas

### Opción A — Trabajo directo sobre `main` sin PRs (válido para solo dev)

- **Pros:** cero ceremonia.
- **Contras:** no se demuestra el flujo profesional, no hay gate de CI,
  el día que entra otra persona hay que cambiar de hábito.

### Opción B — GitFlow (develop + main + release/\* + hotfix/\*)

- **Pros:** muy explícito, separa stages.
- **Contras:** overkill para equipo chico, mucha fricción.

### Opción C — Trunk-based con PR + CI + 1 aprobación requerida

- **Pros:** "lo correcto" en equipos grandes.
- **Contras:** **no funciona con 1 developer** — no hay quien apruebe.

### Opción elegida — Trunk-based con PR + CI + 0 aprobaciones + hooks locales

- **Por qué ganó:** demuestra el flujo profesional sin bloquear al
  developer único. Cuando entre un segundo developer, se sube el
  `required_approving_review_count` a 1 y listo.

## Consecuencias

### Positivas

- `main` siempre tiene CI verde.
- La historia de commits es legible (`feat:`, `fix:`, etc.) — facilita
  hacer changelogs y entender qué pasó.
- Los hooks atrapan errores antes de que se commiteen — feedback rápido.
- El flujo es **el mismo** que cualquier equipo profesional usa con
  GitHub — onboarding portable.

### Negativas / costos

- Husky + hooks agrega ~2 s por commit (manejable).
- Commits de tooling siguen pasando por un PR igual — un poco de
  ceremonia, pero educativa.

### Riesgos / cosas a vigilar

- `enforce_admins: true` puede bloquearte en una urgencia. La salida es
  desactivar la protección temporalmente en GitHub Settings (operación
  manual, deja audit log).

## Cuándo revisar

- Cuando entre un segundo developer: subir aprobaciones requeridas a 1.
- Si la fricción de los hooks se vuelve insoportable, evaluar moverlos
  a opcionales y delegar al CI.
- Si commitlint bloquea más de lo que ayuda, considerar relajar la
  config.

## Referencias

- [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
- [Conventional Commits — spec](https://www.conventionalcommits.org/)
- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
