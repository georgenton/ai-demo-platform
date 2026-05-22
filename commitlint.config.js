// -----------------------------------------------------------------------------
// Configuración de commitlint — valida el FORMATO del mensaje de cada commit.
//
// Extiende "Conventional Commits": la convención estándar de mensajes de commit.
// Formato:  <tipo>(<alcance opcional>): <descripción>
//
// Tipos más usados:
//   feat:     nueva funcionalidad
//   fix:      corrección de un bug
//   chore:    mantenimiento / tooling (no afecta código de producción)
//   docs:     solo documentación
//   refactor: cambio de código que no agrega feature ni corrige bug
//   test:     agregar o ajustar tests
//   ci:       cambios en la configuración de CI
//
//   Ejemplo válido:    feat: agrega endpoint de ingesta de documentos
//   Ejemplo inválido:  arregle cosas
// -----------------------------------------------------------------------------

module.exports = {
  extends: ['@commitlint/config-conventional'],
};
