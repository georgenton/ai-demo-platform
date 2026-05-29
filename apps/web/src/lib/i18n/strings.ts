// -----------------------------------------------------------------------------
// i18n strings — port literal de docs/design/ui_kit_web/i18n.jsx.
//
// Source of truth para TODO copy user-facing del producto. Cada string vive en
// `STRINGS.es` y `STRINGS.en` en paralelo; el switch ES/EN del header decide
// cuál se sirve.
//
// Convenciones (heredadas del DESIGN_SYSTEM):
//   - Sentence case en todo (botones, headings, badges). Nunca Title Case.
//   - Acrónimos preservan caso: SQL, API, LLM, PDF, NAI.
//   - "tú" neutro, nunca "usted". Buttons infinitivos: "Subir", "Generar".
//   - {placeholders} en interpolación; `t(key, { n: 5 })` los reemplaza.
//   - Fallback de key faltante: render del key (visible y ruidoso).
//
// Cuando agregues una key, SIEMPRE súmala a las DOS lenguas en el mismo
// commit. El compilador TS no detecta el drift por sí solo — la regla es
// social. (Si en el futuro queremos enforce, el tipo `StringKey` ya nos da
// autocomplete, falta sumar un test que verifique que `STRINGS.en` cubre
// todas las keys de `STRINGS.es`.)
// -----------------------------------------------------------------------------

const STRINGS_ES = {
  // --- Sidebar / shell
  'shell.demos': 'Demos',
  'shell.servicio': 'Servicio activo',
  'shell.servicio.meta': 'api.v1 · 200 ms',
  'shell.brand.tag': 'NUTANIX ENTERPRISE AI',
  'shell.coming': 'Pronto',
  'shell.dev': 'dev',
  'shell.theme.tip': 'Cambiar tema',
  'shell.lang.tip': 'Cambiar idioma',
  'shell.presentation.enter': 'Modo presentación (Shift + P)',
  'shell.presentation.exit': 'Salir del modo presentación (Shift + P)',

  // --- Shortcuts (overlay con ? y cheatsheet)
  'shortcuts.title': 'Atajos de teclado',
  'shortcuts.footer':
    'Los atajos no se disparan mientras escribes en un campo de texto.',
  'shortcuts.goto.rag': 'Ir a Demo 01 — RAG',
  'shortcuts.goto.comparator': 'Ir a Demo 02 — Comparador',
  'shortcuts.goto.agent': 'Ir a Demo 04 — Agente',
  'shortcuts.goto.corpus': 'Ir a Demo 03 — Corpus',
  'shortcuts.goto.home': 'Ir al inicio',
  'shortcuts.presentation': 'Modo presentación',
  'shortcuts.help': 'Mostrar / ocultar esta ayuda',
  'shortcuts.close': 'Cerrar diálogos',

  // --- Demo catalog
  'demos.rag.title': 'Chat con documentos',
  'demos.rag.tagline': 'Pregunta sobre un PDF en español',
  'demos.comparator.title': 'Comparador',
  'demos.comparator.tagline': 'Análisis lado a lado',
  'demos.corpus.title': 'Corpus académico',
  'demos.corpus.tagline': 'Tendencias en 500+ tesis',
  'demos.agent.title': 'Agente con datos',
  'demos.agent.tagline': 'Pregunta en español, genera SQL',
  'demos.tutor.title': 'Tutor de inglés',
  'demos.tutor.tagline': 'Practica inglés y mira el costo a escala',

  // --- Header
  'header.demo': 'Demo',

  // --- Demo 01 (RAG)
  'rag.eyebrow': 'Demo 01 · RAG',
  'rag.title': 'Chatea con tus documentos',
  'rag.subtitle':
    'Sube un reglamento, manual o contrato y pregúntale en lenguaje natural. La respuesta cita el artículo exacto del documento.',
  'rag.upload': 'Subir documento',
  'rag.docs.label': 'Documentos indexados',
  'rag.docs.empty': 'Arrastra un PDF o haz clic para subir',
  'rag.greeting':
    '¿Sobre qué quieres preguntar? Puedo buscar en el reglamento académico, el manual de matrículas o la política de propiedad intelectual.',
  'rag.composer.placeholder': 'Pregunta sobre el documento…',
  'rag.thinking': 'Buscando fragmentos relevantes…',
  'rag.suggested.1': '¿Cuál es el horario de matrícula?',
  'rag.suggested.2': '¿Cómo se solicita una recalificación?',
  'rag.suggested.3': '¿Qué dice sobre propiedad intelectual?',
  'rag.upload.title': 'Subir documento',
  'rag.upload.drop': 'Arrastra un PDF o haz clic para subir',
  'rag.upload.limits': 'Máx 10 MB · solo PDF',
  'rag.upload.or': 'o pega texto plano',
  'rag.upload.namePlaceholder': 'Nombre del documento',
  'rag.upload.contentPlaceholder': 'Pega el contenido aquí…',
  'rag.upload.submit': 'Indexar',
  'rag.doc.fragments': 'fragmentos',
  'rag.delete': 'Eliminar',

  // --- Demo 02 (Comparator)
  'cmp.eyebrow': 'Demo 02 · Comparador',
  'cmp.title': 'Comparador de documentos',
  'cmp.subtitle':
    'Selecciona 2–5 documentos, define qué dimensiones quieres comparar y obtén un análisis lado a lado con frases textuales y citas.',
  'cmp.generate': 'Generar análisis comparativo',
  'cmp.generating': 'Generando…',
  'cmp.step1.label': 'Documentos a comparar',
  'cmp.step1.hint': '{n} de 5 seleccionados',
  'cmp.step1.more': 'Cargar más documentos',
  'cmp.step2.label': 'Dimensiones a comparar',
  'cmp.step2.hint': '{n} de 10',
  'cmp.step2.empty': 'Sin dimensiones — agrega al menos una para empezar.',
  'cmp.step2.input': 'Por ejemplo: "plazos de entrega"…',
  'cmp.step2.add': 'Agregar',
  'cmp.step2.suggestions': 'Sugerencias',
  'cmp.step3.label': 'Análisis comparativo',
  'cmp.step3.pending': 'pendiente',
  'cmp.step3.streaming': 'streaming…',
  'cmp.step3.done': 'completado',
  'cmp.step3.docsXdim': '{docs} documentos × {dims} dimensiones',
  'cmp.step3.ready.title': 'Listo para comparar',
  'cmp.step3.ready.body':
    'Cuando hagas clic en Generar análisis comparativo, el LLM leerá cada documento, evaluará las dimensiones que elegiste y armará un análisis lado a lado con citas textuales.',
  'cmp.step3.cita': 'cláusula',

  // --- Demo 03 (Corpus)
  'corpus.eyebrow': 'Demo 03 · Corpus',
  'corpus.title': 'Analiza tendencias en tu corpus académico',
  'corpus.subtitle':
    'Carga tesis o papers en PDF. El sistema extrae metadata (título, año, autores, tópicos), genera estadísticas agregadas, permite buscar por significado y redacta un resumen ejecutivo del estado del arte.',

  'corpus.upload.button': 'Subir papers',
  'corpus.upload.modalTitle': 'Cargar papers al corpus',
  'corpus.upload.cta': 'Seleccionar PDFs',
  'corpus.upload.hint': 'Hasta 20 archivos por lote · máx 10 MB cada uno',
  'corpus.upload.selectMore': 'Seleccionar más archivos',
  'corpus.upload.progress': 'Procesando {current} de {total}…',
  'corpus.upload.uploading': 'Procesando {n} archivo(s)…',
  'corpus.upload.successCount': '{n} paper(s) indexados correctamente',
  'corpus.upload.failureCount': '{n} archivo(s) no se pudieron procesar',
  'corpus.upload.failureMore': '…y {n} más',

  'corpus.stats.total': 'Papers en el corpus',
  'corpus.stats.totalHelp':
    'Carga más PDFs para enriquecer las estadísticas y mejorar el resumen ejecutivo.',
  'corpus.chart.papersByYear': 'Papers por año',
  'corpus.chart.topTopics': 'Tópicos dominantes',
  'corpus.chart.papers': 'papers',
  'corpus.chart.empty': 'Sin datos todavía.',

  'corpus.search.title': 'Búsqueda semántica',
  'corpus.search.desc':
    'Pregunta en lenguaje natural — el sistema busca por significado en todos los papers, no por palabras exactas.',
  'corpus.search.placeholder': '¿Qué tendencias hay sobre…?',
  'corpus.search.submit': 'Buscar',
  'corpus.search.searching': 'Buscando…',
  'corpus.search.thinking': 'Analizando los fragmentos relevantes…',
  'corpus.search.s1': '¿Qué métodos de evaluación predominan?',
  'corpus.search.s2': '¿Qué temas emergen en los últimos años?',
  'corpus.search.s3': '¿Hay tesis sobre inteligencia artificial?',

  'corpus.summary.title': 'Resumen ejecutivo del corpus',
  'corpus.summary.desc':
    'El sistema resume cada paper, agrega las estadísticas y redacta un panorama del estado del arte en 2-3 párrafos. Tarda ~30-60s la primera vez.',
  'corpus.summary.generate': 'Generar resumen',
  'corpus.summary.generating': 'Generando…',
  'corpus.summary.reset': 'Limpiar',
  'corpus.summary.thinking':
    'Leyendo papers y redactando el panorama. Esto tarda un minuto…',
  'corpus.summary.tooFew':
    'Carga al menos {min} papers para que el resumen ejecutivo sea significativo.',

  'corpus.list.title': 'Papers cargados',
  'corpus.list.loading': 'Cargando lista…',
  'corpus.list.emptyTitle': 'Todavía no hay papers',
  'corpus.list.emptyBody':
    'Sube PDFs para empezar — el sistema extrae metadata automáticamente.',
  'corpus.list.rangeLabel': '{from}-{to} de {total}',
  'corpus.list.prev': 'Anterior',
  'corpus.list.next': 'Siguiente',
  'corpus.list.noAuthors': 'Sin autores extraídos',
  'corpus.list.etAl': 'et al.',

  // --- Demo 04 (Agent)
  'agent.eyebrow': 'Demo 04 · Agente',
  'agent.title': 'Pregunta en español, obtiene la respuesta',
  'agent.subtitle':
    'El agente traduce tu pregunta a SQL, la ejecuta contra la base académica real y explica el resultado en lenguaje natural — citando los números.',
  'agent.tab.console': 'Consola',
  'agent.tab.history': 'Historial de consultas',
  'agent.suggested': 'Preguntas sugeridas',
  'agent.empty.title': 'Listo para razonar',
  'agent.empty.body':
    'Elige una pregunta sugerida o escribe la tuya. El agente mostrará la SQL que genera, los resultados y la respuesta — paso por paso.',
  'agent.composer': 'Pregunta sobre estudiantes, materias, inscripciones…',
  'agent.schema': 'Schema accesible',
  'agent.schema.note':
    'El agente sólo puede leer estas 4 tablas. No puede modificar datos ni acceder a otras bases.',
  'agent.kicker.thinking': 'Pensando',
  'agent.kicker.sql': 'SQL generada',
  'agent.kicker.result': 'Resultado',
  'agent.kicker.answer': 'Respuesta',
  'agent.kicker.error': 'Error',
  'agent.thinking.default': 'Analizando la pregunta…',
  'agent.rows.one': 'fila',
  'agent.rows.many': 'filas',
  'agent.done': 'Listo · generado en {n} {turns}',
  'agent.turns.one': 'turno',
  'agent.turns.many': 'turnos',
  'agent.history.h.question': 'Pregunta',
  'agent.history.h.sql': 'SQL generada',
  'agent.history.h.rows': 'Filas',
  'agent.history.h.time': 'Tiempo',
  'agent.history.h.when': 'Cuándo',

  // --- Empty/common
  'common.streaming': 'streaming',
  'common.done': 'Listo',
  'common.send': 'Enviar',
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'common.remove': 'Quitar',

  // --- Relative time
  'time.seconds': 'hace unos segundos',
  'time.minutes': 'hace {n} min',
  'time.hours': 'hace {n} h',
  'time.days': 'hace {n} días',

  // --- Sample doc names (fallback usado solo cuando arrancamos sin docs reales)
  'sample.doc.reglamento': 'Reglamento académico 2025.pdf',
  'sample.doc.manual': 'Manual de matrículas — Vicerrectorado.pdf',
  'sample.doc.propiedad': 'Política de propiedad intelectual.pdf',
  'sample.doc.contratoA': 'Contrato proveedor A — Edificio Aulario.pdf',
  'sample.doc.contratoB': 'Contrato proveedor B — Edificio Aulario.pdf',
  'sample.doc.contratoC': 'Contrato proveedor C — Mantenimiento.pdf',
  'sample.doc.anexo': 'Anexo técnico — Pliegos 2025.pdf',

  // --- Demo 05 (Tutor de inglés)
  'tutor.eyebrow': 'Demo 05 · Tutor',
  'tutor.title': 'Practica inglés y mira el costo a escala',
  'tutor.subtitle':
    'Chat conversacional con corrección de gramática + calculadora de costo on-prem vs cloud.',
  'tutor.level.label': 'Nivel',
  'tutor.scenario.label': 'Escenario',
  'tutor.scenario.general': 'Conversación',
  'tutor.scenario.cafe': 'Café',
  'tutor.scenario.interview': 'Entrevista',
  'tutor.reset': 'Reiniciar',
  'tutor.chat.empty': 'Saluda en inglés o usa una de las pills para empezar.',
  'tutor.composer.placeholder': 'Escribe en inglés…',
  'tutor.feedback.lastTip': 'Último tip del tutor',
  'tutor.feedback.empty.title': 'Sin correcciones todavía',
  'tutor.feedback.empty.body':
    'Cuando el tutor detecte un error en tu frase, la corrección aparece acá.',
  'tutor.cost.title': 'Calculadora de costo',
  'tutor.cost.session.eyebrow': 'Esta sesión',
  'tutor.cost.tokensIn': 'Tokens entrada',
  'tutor.cost.tokensOut': 'Tokens salida',
  'tutor.cost.projection.eyebrow': 'Proyección semestre',
  'tutor.cost.students': 'Alumnos',
  'tutor.cost.sessionsPerWeek': 'Sesiones / sem',
  'tutor.cost.weeks': 'Semanas',
  'tutor.cost.tokens.caption': '{n} tokens proyectados',
  'tutor.cost.onprem.caption': 'Costo variable: $0 por consulta',
  'tutor.cost.source':
    'Pricing: ${priceIn}/M input + ${priceOut}/M output · capturado {capturedAt}',
  'tutor.voice.autoSpeak.label': 'Escuchar respuestas',
  'tutor.voice.autoSpeak.tip':
    'Cuando está activo, la app lee en voz alta cada respuesta del tutor (voz nativa del browser, sin API externa).',
  'tutor.voice.mic.start': 'Hablar (mic encendido)',
  'tutor.voice.mic.stop': 'Detener mic',

  // --- Audiencias (espejo de DemoRegistryService.audience del backend)
  'audience.label': 'Para quién:',
  'audience.rag.universities': 'Universidades',
  'audience.rag.hr': 'RRHH',
  'audience.rag.legal': 'Áreas legales',
  'audience.cmp.legal': 'Legal',
  'audience.cmp.procurement': 'Compras',
  'audience.cmp.audit': 'Auditoría',
  'audience.corpus.research': 'Vicerrectorado de investigación',
  'audience.corpus.gradschool': 'Posgrado',
  'audience.agent.cio': 'CIO',
  'audience.agent.rectorado': 'Rectorado',
  'audience.agent.academic': 'Dirección académica',
  'audience.tutor.langCenters': 'Centros de idiomas universitarios',
  'audience.tutor.corporate': 'Capacitación corporativa',
  'audience.tutor.cio': 'CIO evaluando build vs buy',

  // --- CostMiniWidget (sidebar de cada demo)
  'costMini.tokens': 'Tokens estimados',
  'costMini.session': 'Sesión:',
  'costMini.tokensShort': 'tokens',
  'costMini.scale.prefix': '{users} usuarios × {uses} {unit} →',
  'costMini.scale.perMonth': '/mes',
  'costMini.editor.title': 'Proyección a escala',
  'costMini.editor.open': 'Editar parámetros',
  'costMini.editor.users': 'Usuarios activos al mes',
  'costMini.editor.hint':
    'Los tokens/uso se toman de la sesión actual cuando hay datos; si está vacía, se usa un valor de referencia conservador del demo.',
  'costMini.uses.rag': 'consultas/mes',
  'costMini.uses.comparator': 'comparaciones/mes',
  'costMini.uses.corpus': 'búsquedas/mes',
  'costMini.uses.agent': 'queries/mes',
  'costMini.tooltip':
    'Estimación visual (~4 caracteres por token, regla de la industria). Cobro real de {provider}: ${priceIn}/M input + ${priceOut}/M output. NAI on-prem: $0 por consulta.',
} as const;

const STRINGS_EN: Record<keyof typeof STRINGS_ES, string> = {
  'shell.demos': 'Demos',
  'shell.servicio': 'Service active',
  'shell.servicio.meta': 'api.v1 · 200 ms',
  'shell.brand.tag': 'NUTANIX ENTERPRISE AI',
  'shell.coming': 'Soon',
  'shell.dev': 'dev',
  'shell.theme.tip': 'Toggle theme',
  'shell.lang.tip': 'Change language',
  'shell.presentation.enter': 'Presentation mode (Shift + P)',
  'shell.presentation.exit': 'Exit presentation mode (Shift + P)',

  'shortcuts.title': 'Keyboard shortcuts',
  'shortcuts.footer':
    'Shortcuts are disabled while you are typing in a text field.',
  'shortcuts.goto.rag': 'Go to Demo 01 — RAG',
  'shortcuts.goto.comparator': 'Go to Demo 02 — Comparator',
  'shortcuts.goto.agent': 'Go to Demo 04 — Agent',
  'shortcuts.goto.corpus': 'Go to Demo 03 — Corpus',
  'shortcuts.goto.home': 'Go to home',
  'shortcuts.presentation': 'Presentation mode',
  'shortcuts.help': 'Show / hide this help',
  'shortcuts.close': 'Close dialogs',

  'demos.rag.title': 'Document chat',
  'demos.rag.tagline': 'Ask a PDF in plain English',
  'demos.comparator.title': 'Comparator',
  'demos.comparator.tagline': 'Side-by-side analysis',
  'demos.corpus.title': 'Academic corpus',
  'demos.corpus.tagline': 'Trends across 500+ theses',
  'demos.agent.title': 'Data agent',
  'demos.agent.tagline': 'Ask in plain English, get SQL',
  'demos.tutor.title': 'English tutor',
  'demos.tutor.tagline': 'Practice English and see the cost at scale',

  'header.demo': 'Demo',

  'rag.eyebrow': 'Demo 01 · RAG',
  'rag.title': 'Chat with your documents',
  'rag.subtitle':
    'Upload a policy, manual or contract and ask it in plain English. Answers cite the exact article from the document.',
  'rag.upload': 'Upload document',
  'rag.docs.label': 'Indexed documents',
  'rag.docs.empty': 'Drop a PDF or click to upload',
  'rag.greeting':
    'What would you like to ask about? I can search the academic policy, the enrollment manual, or the IP policy.',
  'rag.composer.placeholder': 'Ask about the document…',
  'rag.thinking': 'Finding relevant fragments…',
  'rag.suggested.1': 'When is the enrollment window?',
  'rag.suggested.2': 'How do I request a grade review?',
  'rag.suggested.3': 'What does it say about intellectual property?',
  'rag.upload.title': 'Upload document',
  'rag.upload.drop': 'Drop a PDF or click to upload',
  'rag.upload.limits': 'Max 10 MB · PDF only',
  'rag.upload.or': 'or paste plain text',
  'rag.upload.namePlaceholder': 'Document name',
  'rag.upload.contentPlaceholder': 'Paste the content here…',
  'rag.upload.submit': 'Index',
  'rag.doc.fragments': 'fragments',
  'rag.delete': 'Delete',

  'cmp.eyebrow': 'Demo 02 · Comparator',
  'cmp.title': 'Document comparator',
  'cmp.subtitle':
    'Pick 2–5 documents, define the dimensions you want to compare, and get a side-by-side analysis with verbatim phrases and citations.',
  'cmp.generate': 'Generate comparison',
  'cmp.generating': 'Generating…',
  'cmp.step1.label': 'Documents to compare',
  'cmp.step1.hint': '{n} of 5 selected',
  'cmp.step1.more': 'Load more documents',
  'cmp.step2.label': 'Dimensions to compare',
  'cmp.step2.hint': '{n} of 10',
  'cmp.step2.empty': 'No dimensions yet — add at least one to start.',
  'cmp.step2.input': 'For example: "delivery deadlines"…',
  'cmp.step2.add': 'Add',
  'cmp.step2.suggestions': 'Suggestions',
  'cmp.step3.label': 'Comparative analysis',
  'cmp.step3.pending': 'pending',
  'cmp.step3.streaming': 'streaming…',
  'cmp.step3.done': 'done',
  'cmp.step3.docsXdim': '{docs} documents × {dims} dimensions',
  'cmp.step3.ready.title': 'Ready to compare',
  'cmp.step3.ready.body':
    'When you click Generate comparison, the LLM will read each document, evaluate the dimensions you chose and build a side-by-side analysis with verbatim citations.',
  'cmp.step3.cita': 'clause',

  'corpus.eyebrow': 'Demo 03 · Corpus',
  'corpus.title': 'Analyze trends in your academic corpus',
  'corpus.subtitle':
    'Upload theses or papers in PDF. The system extracts metadata (title, year, authors, topics), generates aggregated stats, lets you search by meaning and drafts an executive summary of the state of the art.',

  'corpus.upload.button': 'Upload papers',
  'corpus.upload.modalTitle': 'Add papers to the corpus',
  'corpus.upload.cta': 'Select PDFs',
  'corpus.upload.hint': 'Up to 20 files per batch · 10 MB max each',
  'corpus.upload.selectMore': 'Select more files',
  'corpus.upload.progress': 'Processing {current} of {total}…',
  'corpus.upload.uploading': 'Processing {n} file(s)…',
  'corpus.upload.successCount': '{n} paper(s) indexed successfully',
  'corpus.upload.failureCount': '{n} file(s) could not be processed',
  'corpus.upload.failureMore': '…and {n} more',

  'corpus.stats.total': 'Papers in the corpus',
  'corpus.stats.totalHelp':
    'Upload more PDFs to enrich the stats and improve the executive summary.',
  'corpus.chart.papersByYear': 'Papers by year',
  'corpus.chart.topTopics': 'Dominant topics',
  'corpus.chart.papers': 'papers',
  'corpus.chart.empty': 'No data yet.',

  'corpus.search.title': 'Semantic search',
  'corpus.search.desc':
    'Ask in plain English — the system searches by meaning across every paper, not by exact words.',
  'corpus.search.placeholder': 'What trends are there about…?',
  'corpus.search.submit': 'Search',
  'corpus.search.searching': 'Searching…',
  'corpus.search.thinking': 'Analyzing the relevant fragments…',
  'corpus.search.s1': 'What evaluation methods predominate?',
  'corpus.search.s2': 'What topics emerge in recent years?',
  'corpus.search.s3': 'Are there theses about artificial intelligence?',

  'corpus.summary.title': 'Executive summary of the corpus',
  'corpus.summary.desc':
    'The system summarizes each paper, aggregates the stats and drafts a state-of-the-art panorama in 2-3 paragraphs. Takes ~30-60s the first time.',
  'corpus.summary.generate': 'Generate summary',
  'corpus.summary.generating': 'Generating…',
  'corpus.summary.reset': 'Clear',
  'corpus.summary.thinking':
    'Reading papers and drafting the panorama. This takes about a minute…',
  'corpus.summary.tooFew':
    'Upload at least {min} papers so the executive summary is meaningful.',

  'corpus.list.title': 'Uploaded papers',
  'corpus.list.loading': 'Loading list…',
  'corpus.list.emptyTitle': 'No papers yet',
  'corpus.list.emptyBody':
    'Upload PDFs to get started — the system extracts metadata automatically.',
  'corpus.list.rangeLabel': '{from}-{to} of {total}',
  'corpus.list.prev': 'Previous',
  'corpus.list.next': 'Next',
  'corpus.list.noAuthors': 'No authors extracted',
  'corpus.list.etAl': 'et al.',

  'agent.eyebrow': 'Demo 04 · Agent',
  'agent.title': 'Ask in English, get the answer',
  'agent.subtitle':
    'The agent translates your question to SQL, runs it against the real academic database and explains the result in plain English — citing the numbers.',
  'agent.tab.console': 'Console',
  'agent.tab.history': 'Query history',
  'agent.suggested': 'Suggested questions',
  'agent.empty.title': 'Ready to reason',
  'agent.empty.body':
    'Pick a suggested question or write your own. The agent will show the SQL it generates, the results and the answer — step by step.',
  'agent.composer': 'Ask about students, courses, enrollments…',
  'agent.schema': 'Accessible schema',
  'agent.schema.note':
    'The agent can only read these 4 tables. It cannot modify data or access other databases.',
  'agent.kicker.thinking': 'Thinking',
  'agent.kicker.sql': 'SQL generated',
  'agent.kicker.result': 'Result',
  'agent.kicker.answer': 'Answer',
  'agent.kicker.error': 'Error',
  'agent.thinking.default': 'Analyzing the question…',
  'agent.rows.one': 'row',
  'agent.rows.many': 'rows',
  'agent.done': 'Done · in {n} {turns}',
  'agent.turns.one': 'turn',
  'agent.turns.many': 'turns',
  'agent.history.h.question': 'Question',
  'agent.history.h.sql': 'Generated SQL',
  'agent.history.h.rows': 'Rows',
  'agent.history.h.time': 'Time',
  'agent.history.h.when': 'When',

  'common.streaming': 'streaming',
  'common.done': 'Done',
  'common.send': 'Send',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.remove': 'Remove',

  'time.seconds': 'a few seconds ago',
  'time.minutes': '{n} min ago',
  'time.hours': '{n}h ago',
  'time.days': '{n} days ago',

  'sample.doc.reglamento': 'Academic policy 2025.pdf',
  'sample.doc.manual': 'Enrollment manual — Provost Office.pdf',
  'sample.doc.propiedad': 'Intellectual property policy.pdf',
  'sample.doc.contratoA': 'Vendor contract A — Classroom Building.pdf',
  'sample.doc.contratoB': 'Vendor contract B — Classroom Building.pdf',
  'sample.doc.contratoC': 'Vendor contract C — Maintenance.pdf',
  'sample.doc.anexo': 'Technical annex — Bids 2025.pdf',

  // --- Demo 05 (English tutor)
  'tutor.eyebrow': 'Demo 05 · Tutor',
  'tutor.title': 'Practice English and see the cost at scale',
  'tutor.subtitle':
    'Conversational chat with grammar correction + on-prem vs cloud cost calculator.',
  'tutor.level.label': 'Level',
  'tutor.scenario.label': 'Scenario',
  'tutor.scenario.general': 'Small talk',
  'tutor.scenario.cafe': 'Café',
  'tutor.scenario.interview': 'Interview',
  'tutor.reset': 'Reset',
  'tutor.chat.empty': 'Say hi in English or use one of the pills to start.',
  'tutor.composer.placeholder': 'Type in English…',
  'tutor.feedback.lastTip': "Tutor's last tip",
  'tutor.feedback.empty.title': 'No corrections yet',
  'tutor.feedback.empty.body':
    'When the tutor spots a mistake, the correction shows up here.',
  'tutor.cost.title': 'Cost calculator',
  'tutor.cost.session.eyebrow': 'This session',
  'tutor.cost.tokensIn': 'Input tokens',
  'tutor.cost.tokensOut': 'Output tokens',
  'tutor.cost.projection.eyebrow': 'Semester projection',
  'tutor.cost.students': 'Students',
  'tutor.cost.sessionsPerWeek': 'Sessions / wk',
  'tutor.cost.weeks': 'Weeks',
  'tutor.cost.tokens.caption': '{n} tokens projected',
  'tutor.cost.onprem.caption': 'Variable cost: $0 per query',
  'tutor.cost.source':
    'Pricing: ${priceIn}/M input + ${priceOut}/M output · captured {capturedAt}',
  'tutor.voice.autoSpeak.label': 'Read replies aloud',
  'tutor.voice.autoSpeak.tip':
    "When on, the app reads each tutor reply aloud (browser's native voice, no external API).",
  'tutor.voice.mic.start': 'Speak (mic on)',
  'tutor.voice.mic.stop': 'Stop mic',

  // --- Audiences (mirror of DemoRegistryService.audience on the backend)
  'audience.label': 'For:',
  'audience.rag.universities': 'Universities',
  'audience.rag.hr': 'HR',
  'audience.rag.legal': 'Legal departments',
  'audience.cmp.legal': 'Legal',
  'audience.cmp.procurement': 'Procurement',
  'audience.cmp.audit': 'Audit',
  'audience.corpus.research': 'Research office',
  'audience.corpus.gradschool': 'Graduate school',
  'audience.agent.cio': 'CIO',
  'audience.agent.rectorado': 'Rector’s office',
  'audience.agent.academic': 'Academic affairs',
  'audience.tutor.langCenters': 'University language centers',
  'audience.tutor.corporate': 'Corporate training',
  'audience.tutor.cio': 'CIO evaluating build vs buy',

  // --- CostMiniWidget (each demo header)
  'costMini.tokens': 'Estimated tokens',
  'costMini.session': 'Session:',
  'costMini.tokensShort': 'tokens',
  'costMini.scale.prefix': '{users} users × {uses} {unit} →',
  'costMini.scale.perMonth': '/month',
  'costMini.editor.title': 'Scale projection',
  'costMini.editor.open': 'Edit parameters',
  'costMini.editor.users': 'Active users per month',
  'costMini.editor.hint':
    'Tokens/use come from the current session when there is data; if empty, a conservative reference value per demo is used.',
  'costMini.uses.rag': 'queries/month',
  'costMini.uses.comparator': 'comparisons/month',
  'costMini.uses.corpus': 'searches/month',
  'costMini.uses.agent': 'queries/month',
  'costMini.tooltip':
    'Visual estimate (~4 chars per token, industry rule of thumb). {provider} actual price: ${priceIn}/M input + ${priceOut}/M output. NAI on-prem: $0 per query.',
};

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/** Lenguajes soportados. */
export type Lang = 'es' | 'en';

/**
 * Set completo de strings, indexado por lenguaje. El tipo de `STRINGS_ES`
 * (declarado `as const`) determina las keys válidas; `STRINGS_EN` está
 * tipado contra eso, así si agregas una key en `STRINGS_ES` y te olvidas
 * de `STRINGS_EN`, el compilador grita.
 */
export const STRINGS: Record<Lang, typeof STRINGS_ES> = {
  es: STRINGS_ES,
  en: STRINGS_EN as typeof STRINGS_ES,
};

/** Keys válidas — útil para tipar el parámetro de `t()` y catchar typos. */
export type StringKey = keyof typeof STRINGS_ES;

/**
 * Función de traducción. Toma una `key` tipada y opcionalmente `vars` para
 * reemplazar `{placeholders}` con valores concretos. Si la key no existe,
 * devuelve la key misma (fallback "ruidoso" para que el dev la vea en la UI).
 *
 * Ejemplo:
 *   t('agent.done', { n: 2, turns: t('agent.turns.many') })
 *   → "Listo · generado en 2 turnos"
 */
export function makeT(lang: Lang) {
  const dict = STRINGS[lang];
  return function t(
    key: StringKey,
    vars?: Record<string, string | number>,
  ): string {
    let value: string = dict[key];
    if (value == null) return key; // fallback visible
    if (vars) {
      for (const k in vars) {
        value = value.replace(
          new RegExp('\\{' + k + '\\}', 'g'),
          String(vars[k]),
        );
      }
    }
    return value;
  };
}

export type T = ReturnType<typeof makeT>;

// ---------------------------------------------------------------------------
// Arrays paralelos por lenguaje
// ---------------------------------------------------------------------------
//
// Algunos pedazos del producto son **listas** de strings (sugerencias de
// preguntas al agente, dimensiones de comparación) — no calzan en
// `STRINGS[lang][key]: string`. Los ponemos acá indexados por lang.

export const SUGGESTED_DIMENSIONS_I18N: Record<Lang, string[]> = {
  es: [
    'Plazos de entrega',
    'Penalizaciones',
    'Responsabilidades',
    'Forma de pago',
    'Garantías',
    'Causales de rescisión',
  ],
  en: [
    'Delivery deadlines',
    'Penalties',
    'Responsibilities',
    'Payment terms',
    'Warranties',
    'Termination clauses',
  ],
};

export const SUGGESTED_QUESTIONS_I18N: Record<Lang, string[]> = {
  es: [
    '¿Cuántos estudiantes hay en total?',
    '¿Cuál es la materia con más inscripciones este semestre?',
    '¿Cuántos estudiantes reprobaron Cálculo II en 2025-1?',
    '¿Quién tiene el mejor promedio del semestre actual?',
    '¿Cuántas materias cursa un estudiante en promedio?',
    '¿Hay materias donde la mayoría aprobó parciales pero reprobó el final?',
  ],
  en: [
    'How many students are there in total?',
    'Which course has the most enrollments this term?',
    'How many students failed Calculus II in 2025-1?',
    'Who has the highest GPA this term?',
    'How many courses does a student take on average?',
    'Are there courses where most passed midterms but failed the final?',
  ],
};
