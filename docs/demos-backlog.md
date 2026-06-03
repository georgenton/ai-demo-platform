# Backlog de demos — futuras adiciones al catálogo

> Documento vivo. Cuando un demo del backlog entra a desarrollo, se le
> asigna un Demo ID (`demo-06`, `demo-07`, …), se crea su ADR y se mueve
> a "En desarrollo" antes de pasar a "Mergeado" cuando salga a producción.
>
> **Próximo demo a desarrollar:** Demo 06 — Asistente clínico (ver
> [ADR-0016](./adr/0016-demo-06-clinical-assistant.md)).

---

## Framework de priorización

Un demo se vuelve **comercialmente fuerte** cuando activa al menos 3 de
estas 5 dimensiones donde NAI on-prem gana a Anthropic / OpenAI cloud:

| Dimensión               | Aplica cuando…                                                   | Peso comercial |
| ----------------------- | ---------------------------------------------------------------- | -------------- |
| Privacidad / compliance | Datos sensibles que no pueden salir de la nube del cliente       | 🔥🔥🔥         |
| Costo predecible        | Volumen alto de tokens (>100K calls/mes); NAI = $0 variable      | 🔥🔥🔥         |
| Latencia                | Red local << round-trip a US (~50ms vs ~600ms); crítico para voz | 🔥             |
| Disponibilidad          | "No depender de outages de Anthropic" para cumplir SLA crítico   | 🔥🔥           |
| Customización           | Fine-tuning con corpus interno sin enviar datos al provider      | 🔥🔥           |

---

## Activos hoy (en producción)

| ID           | Nombre                          | Industries habilitadas    |
| ------------ | ------------------------------- | ------------------------- |
| `rag`        | Chat con documentos             | Todas                     |
| `comparator` | Comparador de documentos        | universidad, banca, legal |
| `corpus`     | Corpus académico                | universidad, legal        |
| `agent`      | Agente NL→SQL                   | Todas                     |
| `tutor`      | Tutor de inglés + costo on-prem | universidad, gobierno     |

---

## Backlog priorizado

### Sprint próximo (en desarrollo)

#### Demo 06 — Asistente clínico

- **Score:** 5/5 dimensiones (privacidad + costo + latencia + disponibilidad + customización)
- **Industria primaria:** salud
- **Estado:** Pendiente kick-off (ADR-0016, plan inicial en este chat)
- **Esfuerzo estimado:** 1-1.5 semanas
- **Qué hace:** el médico escribe el motivo de consulta + datos del paciente. El asistente:
  1. Resume historia clínica relevante (RAG sobre consultas previas).
  2. Sugiere diagnósticos diferenciales con criterios de exclusión.
  3. Alerta sobre interacciones medicamentosas.
  4. Cita protocolos clínicos del hospital.
- **Por qué brilla en NAI:** Ecuador prohíbe enviar historia clínica fuera de la
  red privada (Ley Orgánica de Salud, Art. 7). **No vendible en cloud — solo NAI.**
- **Audiencia:** clínicas privadas (Pichincha, Metropolitano, Cruz Roja), hospitales públicos, IESS.

---

### Q1 — Después del Demo 06

#### Demo 07 — Avatar entrevistador HR (screening de candidatos)

- **Score:** 4/5 dimensiones (privacidad + costo + latencia + disponibilidad)
- **Industria primaria:** universidad (admisiones), banca, retail, gobierno
- **Esfuerzo estimado:** 1 semana
- **Qué hace:** chat con voz + un set estructurado de preguntas. El sistema:
  1. Hace 6-10 preguntas adaptativas según el rol (técnico, comercial, soft skills).
  2. Transcribe + analiza respuestas (claridad, completitud, marcadores de mentira).
  3. Genera scoring por dimensión + recomendación final.
  4. Exporta resumen en PDF para el reclutador.
- **Por qué brilla en NAI:** datos personales del candidato (cédula, salario previo, ubicación) bajo Ley de Protección de Datos Personales (Ecuador 2021).
  Volumen alto: 500-2000 entrevistas/mes en una empresa grande.
- **Riesgo regulatorio:** medio (datos personales pero no historia médica).
- **Cómo encadena con Demo 05:** reutiliza voz nativa del browser ya integrada.

#### Demo 08 — Helpdesk corporativo interno

- **Score:** 4/5 dimensiones (privacidad + costo + customización + disponibilidad)
- **Industria primaria:** cross-industry (banca, retail, gobierno, salud, universidad)
- **Esfuerzo estimado:** 5 días
- **Qué hace:** chat sobre el conocimiento interno de la empresa (RRHH, IT, políticas, beneficios). El sistema:
  1. Responde preguntas frecuentes con cita al documento fuente.
  2. Detecta consultas que requieren escalada y abre ticket a humano.
  3. Track de unanswered questions para retroalimentar la base de conocimiento.
- **Por qué brilla en NAI:** alto volumen (cada empleado pregunta 3-5 veces/día). Datos sensibles (salarios, organigrama, políticas internas). En empresas grandes ahorra USD 30-80K/mes en cloud.
- **Audiencia:** banca + retail + gobierno + universidades (helpdesk a estudiantes).
- **Cómo encadena con el catálogo:** extensión natural del Demo 01 (RAG) con escalada.

---

### Q2 — Sprint medio

#### Demo 09 — Analizador de licitaciones públicas

- **Score:** 4/5 dimensiones (privacidad + costo + disponibilidad + customización)
- **Industria primaria:** gobierno
- **Esfuerzo estimado:** 3-5 días (reutiliza Comparator + RAG)
- **Qué hace:** el funcionario sube bases + propuestas. El sistema:
  1. Resume cada propuesta (precio, plazo, garantías, experiencia).
  2. Detecta desviaciones de las bases y cláusulas ambiguas.
  3. Genera tabla comparativa con scoring por criterio.
  4. Prepara el informe preliminar del comité evaluador.
- **Por qué brilla en NAI:** contratación pública es secreto industrial estricto (presupuestos reservados, criterios de evaluación). Imposible enviar a cloud sin violar normativa.
- **Audiencia:** SERCOP, gobiernos seccionales (municipios, prefecturas), ministerios.

---

### Q3 — Cuando haya acceso a partner bancario

#### Demo 10 — Detector de anomalías en transacciones (banca)

- **Score:** 5/5 dimensiones (privacidad + costo + latencia + disponibilidad + customización)
- **Industria primaria:** banca, cooperativas grandes
- **Esfuerzo estimado:** 2-3 semanas
- **Qué hace:** stream de transacciones en tiempo real. Para cada una:
  1. Clasifica (normal / sospechosa / lavado / fraude).
  2. Explica el razonamiento en lenguaje natural.
  3. Genera ticket automático al área de cumplimiento.
  4. Dashboard con métricas en vivo (heatmap por sucursal, top alerts del día).
- **Por qué brilla en NAI:** volumen masivo (millones de tx/día), datos bajo Ley de Mercado de Valores + LGPD, latencia crítica (<100ms para aprobar/rechazar).
- **Audiencia:** Pichincha, Pacífico, Produbanco, Guayaquil, JEP, CACPECO.
- **Pre-requisito:** partner bancario para acceso a datos sintéticos realistas.
- **Ticket de venta:** el más alto del catálogo. Un banco grande paga lo que sea por esto.

---

## Otros demos considerados (NO priorizados, archivo)

Demos discutidos pero descartados (al menos por ahora). Razón documentada para
revisitar si el contexto cambia.

| Demo                                                 | Por qué se difirió                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Generador de respuestas legales a tickets            | Competencia fuerte de soluciones legaltech existentes (DoNotPay, etc.). Solo vendible con un ángulo muy específico de Ecuador. |
| Asistente médico para historia clínica genérico      | Reemplazado por Demo 06 (más enfocado).                                                                                        |
| Generador / revisor de informes técnicos             | Caso de uso muy nicho. Mejor como feature dentro de Demo 01 (RAG).                                                             |
| Clasificador y resumen de prensa / noticias internas | Bajo ROI en volumen vs casos de uso B2B internos. Posible para gobierno (monitoreo de menciones).                              |
| Soporte al cliente externo (e-commerce)              | Compite con chatbots existentes baratos (Tidio, Intercom). Privacidad media. Poco diferenciador NAI.                           |

---

## Cómo agregar un demo nuevo al backlog

1. Pensalo según el framework de las 5 dimensiones. Si activa <3, no entra.
2. Defini la industria primaria + secundarias del catálogo
   (`universidad | banca | legal | salud | gobierno | retail`).
3. Estima esfuerzo en días/semanas asumiendo el stack actual
   (NestJS + Next + Prisma + pgvector + LLMAdapter).
4. Documenta el "por qué brilla en NAI" — sin un ángulo claro acá, el demo no
   vende y no entra.
5. Agregalo a la sección correcta (sprint próximo / Q1 / Q2 / Q3) según urgencia
   comercial vs esfuerzo técnico.
6. Cuando arranca su desarrollo, le creas el ADR (`docs/adr/00NN-demo-XX-<slug>.md`)
   y movés su entrada de "Backlog priorizado" a "En desarrollo".
