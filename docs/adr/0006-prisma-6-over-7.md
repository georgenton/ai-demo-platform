# ADR-0006 — Prisma 6 en lugar de Prisma 7

- **Estado:** Aceptado
- **Fecha:** 2026-05-23
- **Decisores:** Jorge

## Contexto

Prisma 7 fue lanzada con cambios significativos en el modelo de
configuración:

- El `url` ya no se declara en `schema.prisma`; se mueve a un
  `prisma.config.ts` separado.
- Las queries en runtime requieren un **driver adapter** explícito
  (`@prisma/adapter-pg` + `pg`) que se pasa al constructor de
  `PrismaClient`.

Es un cambio de paradigma en transición — docs y ecosistema todavía
acomodándose. Cuando intentamos instalar `prisma@latest` (que dio v7),
el schema con `url = env("DATABASE_URL")` falló inmediatamente con un
error explícito sobre el nuevo modelo de config.

## Decisión

**Prisma 6 (línea 6.x)** para todo el proyecto, tanto el CLI como
`@prisma/client`. Pinned con `^6` para recibir patches sin saltar a v7.

## Alternativas consideradas

### Opción A — Prisma 7 con el patrón adapter-based

- **Pros:** es el futuro de Prisma. Adoptar temprano evita una
  migración después.
- **Contras:**
  - Más conceptos para introducir (config file separado, adapter,
    paquete `pg` adicional).
  - Docs y ejemplos del ecosistema todavía mayoritariamente en v6.
  - Para una base de mentoría, el patrón estable es mejor que el
    patrón nuevo en transición.
  - Fricción inmediata: cada cosa nueva requiere reconfirmar que la
    docs aplica a v7.

### Opción B — Prisma 6

- **Pros:**
  - Estable, maduro, documentación sólida.
  - Tiene **todo lo que necesitamos**: `postgresqlExtensions` preview
    (para declarar `extensions = [vector]`), modelos, migraciones,
    `Unsupported("vector(N)")`, `$queryRaw`.
  - Patrones de aprendizaje 100% transferibles a v7 después (el API
    del cliente es casi igual; solo cambió la config).
- **Contras:** habrá que migrar a v7 eventualmente.

### Opción elegida — Prisma 6

- **Por qué ganó:** estabilidad y madurez ganan en una base que va a
  enseñarse. La migración a v7 puede planificarse cuando el ecosistema
  se estabilice y la app esté más establecida — un upgrade planeado es
  mucho más fácil que arrancar greenfield contra un objetivo movedizo.

## Consecuencias

### Positivas

- Setup sin fricción: `npm install -D prisma@^6` + un schema estándar
  funcionó al primer intento.
- Docs y Stack Overflow apuntan mayoritariamente a v6 — debugging es
  rápido.
- pgvector vía `extensions = [vector]` funciona out-of-the-box.

### Negativas / costos

- Eventualmente hay que migrar a v7. El esfuerzo dependerá de cuán
  estable sea v7 para entonces.
- Si Prisma 6 deja de recibir patches (típicamente mantienen N-1 por
  ~12 meses post-N), tenemos un horizonte.

### Riesgos / cosas a vigilar

- Fecha de fin de soporte de la línea 6.x.
- Si una feature importante (ej: soporte nativo de `vector`) llega solo
  a v7+.

## Cuándo revisar

- Cuando Prisma 7 esté lo suficientemente maduro (docs sólidas,
  ejemplos abundantes, < 6 meses sin breaking changes en el modelo de
  config).
- Cuando Prisma 6 anuncie EOL.
- Si necesitamos una feature exclusiva de v7.

## Referencias

- [Prisma — release notes](https://www.prisma.io/blog) (consultar al
  momento de revisar)
- [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma)
- PR donde se materializó esta decisión:
  [#2 — capa de DB del Demo 01](https://github.com/georgenton/ai-demo-platform/pull/2)
