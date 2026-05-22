# Guía de contribución

Cómo trabajar en este repositorio. Este documento también es una **referencia de
buenas prácticas** — el proyecto se usa como base de mentoría.

> Para las convenciones de **código y arquitectura** (nombrado, patrones, stack
> tecnológico), ver [`CLAUDE.md`](./CLAUDE.md).

## Flujo de trabajo

`main` es la rama estable y **no se commitea directo a `main`**. Cada cambio:

1. Sale de `main` en una rama corta y descriptiva.
2. Se trabaja y se commitea (los hooks de git validan automáticamente).
3. Se sube a GitHub y se abre un **Pull Request**.
4. El CI verifica el PR; al pasar en verde, se integra a `main`.

### Nombre de las ramas

| Prefijo  | Para                                  |
| -------- | ------------------------------------- |
| `feat/`  | nueva funcionalidad                   |
| `fix/`   | corrección de un bug                  |
| `chore/` | mantenimiento, tooling, configuración |
| `docs/`  | documentación                         |

Ejemplo: `feat/demo-01-ingesta-pdf`

## Mensajes de commit — Conventional Commits

Formato: **`<tipo>: <descripción>`** (con `(<alcance>)` opcional).

| Tipo       | Cuándo                                      |
| ---------- | ------------------------------------------- |
| `feat`     | nueva funcionalidad                         |
| `fix`      | corrección de un bug                        |
| `chore`    | mantenimiento / tooling                     |
| `docs`     | solo documentación                          |
| `refactor` | reordenar código sin cambiar comportamiento |
| `test`     | agregar o ajustar tests                     |
| `ci`       | cambios en el CI                            |

`commitlint` valida el formato automáticamente — un mensaje fuera de formato
**bloquea el commit**.

## Controles automáticos (git hooks)

Se instalan solos al correr `npm install` (vía Husky). En cada commit:

- **`pre-commit`** → `lint-staged`: linteo + formato de los archivos staged.
- **`commit-msg`** → `commitlint`: valida el mensaje.

Escape de emergencia: `git commit --no-verify` (usar con criterio, no de rutina).

## Comandos de calidad

| Comando              | Qué hace                                 |
| -------------------- | ---------------------------------------- |
| `npm run lint`       | ESLint sobre todo el repositorio         |
| `npm run lint:fix`   | ESLint + auto-arreglo de lo que se pueda |
| `npm test`           | corre los tests (Vitest)                 |
| `npm run test:watch` | tests en modo vigilancia                 |
| `npm run changeset`  | crea una nota de cambio (ver abajo)      |

Para `nx serve`, `nx build`, migraciones y demás, ver `CLAUDE.md`.

## Versionado — changesets

Si tu cambio afecta el comportamiento de un paquete (`packages/*`), agregá una
**nota de cambio**:

```bash
npm run changeset
```

Te preguntará qué paquetes cambian, qué tan grande es el cambio
(`patch` / `minor` / `major`) y una descripción para el changelog. Si el cambio
no necesita release (tooling, docs), usá `npx changeset add --empty`.

Al cerrar una versión, `npm run changeset:version` sube los números de versión
y genera los archivos CHANGELOG automáticamente.

## Pull Requests

- El CI corre **lint + typecheck + test** en cada PR.
- **Un PR no se integra con el CI en rojo.**
- Al abrir el PR aparece una plantilla — complétala.

## Configuración recomendada del repositorio

Activar la **protección de la rama `main`** en GitHub
(_Settings → Branches → Add rule_): requerir Pull Request y que el CI pase
antes de poder integrar. Es un ajuste único, manual, del repositorio.
