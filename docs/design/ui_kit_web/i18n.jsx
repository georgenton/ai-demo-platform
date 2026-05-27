// =============================================================================
// ui_kits/web/i18n.jsx — Translations + language hook.
// All user-facing strings go through t(key). Arrays (sample data, suggested
// questions) ship two parallel copies and switch by lang.
// =============================================================================

const STRINGS = {
  es: {
    // --- Sidebar / shell
    'shell.demos': 'Demos',
    'shell.servicio': 'Servicio activo',
    'shell.servicio.meta': 'api.v1 · 200 ms',
    'shell.brand.tag': 'NUTANIX ENTERPRISE AI',
    'shell.coming': 'Pronto',
    'shell.dev': 'dev',
    'shell.theme.tip': 'Cambiar tema',
    'shell.lang.tip': 'Cambiar idioma',

    // --- Demo catalog
    'demos.rag.title': 'Chat con documentos',
    'demos.rag.tagline': 'Pregunta sobre un PDF en español',
    'demos.comparator.title': 'Comparador',
    'demos.comparator.tagline': 'Análisis lado a lado',
    'demos.corpus.title': 'Corpus académico',
    'demos.corpus.tagline': 'Tendencias en 500+ tesis',
    'demos.agent.title': 'Agente con datos',
    'demos.agent.tagline': 'Pregunta en español, genera SQL',

    // --- Header
    'header.demo': 'Demo',

    // --- Demo 01 (RAG)
    'rag.eyebrow': 'Demo 01 · RAG',
    'rag.title': 'Chatea con tus documentos',
    'rag.subtitle': 'Subí un reglamento, manual o contrato y preguntale en lenguaje natural. La respuesta cita el artículo exacto del documento.',
    'rag.upload': 'Subir documento',
    'rag.docs.label': 'Documentos indexados',
    'rag.docs.empty': 'Arrastrá un PDF o hacé clic para subir',
    'rag.greeting': '¿Sobre qué quieres preguntar? Puedo buscar en el reglamento académico, el manual de matrículas o la política de propiedad intelectual.',
    'rag.composer.placeholder': 'Pregunta sobre el documento…',
    'rag.thinking': 'Buscando fragmentos relevantes…',
    'rag.suggested.1': '¿Cuál es el horario de matrícula?',
    'rag.suggested.2': '¿Cómo se solicita una recalificación?',
    'rag.suggested.3': '¿Qué dice sobre propiedad intelectual?',
    'rag.upload.title': 'Subir documento',
    'rag.upload.drop': 'Arrastrá un PDF o hacé clic para subir',
    'rag.upload.limits': 'Máx 10 MB · solo PDF',
    'rag.upload.or': 'o pegá texto plano',
    'rag.upload.namePlaceholder': 'Nombre del documento',
    'rag.upload.contentPlaceholder': 'Pegá el contenido aquí…',
    'rag.upload.submit': 'Indexar',
    'rag.doc.fragments': 'fragmentos',
    'rag.delete': 'Eliminar',

    // --- Demo 02 (Comparator)
    'cmp.eyebrow': 'Demo 02 · Comparador',
    'cmp.title': 'Comparador de documentos',
    'cmp.subtitle': 'Seleccioná 2–5 documentos, definí qué dimensiones querés comparar y obtené un análisis lado a lado con frases textuales y citas.',
    'cmp.generate': 'Generar análisis comparativo',
    'cmp.generating': 'Generando…',
    'cmp.step1.label': 'Documentos a comparar',
    'cmp.step1.hint': '{n} de 5 seleccionados',
    'cmp.step1.more': 'Cargar más documentos',
    'cmp.step2.label': 'Dimensiones a comparar',
    'cmp.step2.hint': '{n} de 10',
    'cmp.step2.empty': 'Sin dimensiones — agregá al menos una para empezar.',
    'cmp.step2.input': 'Por ejemplo: "plazos de entrega"…',
    'cmp.step2.add': 'Agregar',
    'cmp.step2.suggestions': 'Sugerencias',
    'cmp.step3.label': 'Análisis comparativo',
    'cmp.step3.pending': 'pendiente',
    'cmp.step3.streaming': 'streaming…',
    'cmp.step3.done': 'completado',
    'cmp.step3.docsXdim': '{docs} documentos × {dims} dimensiones',
    'cmp.step3.ready.title': 'Listo para comparar',
    'cmp.step3.ready.body': 'Cuando hagas clic en Generar análisis comparativo, el LLM va a leer cada documento, evaluar las dimensiones que elegiste y armar un análisis lado a lado con citas textuales.',
    'cmp.step3.cita': 'cláusula',

    // --- Demo 03 (Corpus)
    'corpus.eyebrow': 'Próximamente · Q3 2026',
    'corpus.title': 'Detectá tendencias en cientos de tesis y publicaciones de tu universidad.',
    'corpus.desc': 'Procesá colecciones grandes — 500+ documentos — para extraer patrones, agrupar temas y mostrar evolución en el tiempo. Construido sobre hardware NAI on-premise, sin que ningún dato salga de tu red.',
    'corpus.notify': 'Recibir aviso cuando esté listo',
    'corpus.roadmap': 'Ver hoja de ruta',
    'corpus.cap1.title': 'Procesamiento masivo',
    'corpus.cap1.body': 'Ingesta y embedding de cientos de PDFs en paralelo, sobre el cluster NAI.',
    'corpus.cap2.title': 'Agrupación temática',
    'corpus.cap2.body': 'Clustering semántico de tesis por temas emergentes, sin etiquetas predefinidas.',
    'corpus.cap3.title': 'Evolución temporal',
    'corpus.cap3.body': 'Cómo cambian los temas, autores y métodos a lo largo de los semestres.',
    'corpus.status': 'Estado · Hoja de ruta interna',
    'corpus.m1': 'Demo 01 — RAG en producción',
    'corpus.m2': 'Demo 02 — Comparador en producción',
    'corpus.m3': 'Demo 04 — Agente con SQL en pruebas',
    'corpus.m4': 'Acceso a hardware NAI (cluster de pruebas)',
    'corpus.m5': 'Servicio FastAPI / Python para corpus',
    'corpus.m6': 'Demo 03 — Corpus académico (lanzamiento)',

    // --- Demo 04 (Agent)
    'agent.eyebrow': 'Demo 04 · Agente',
    'agent.title': 'Pregunta en español, obtiene la respuesta',
    'agent.subtitle': 'El agente traduce tu pregunta a SQL, la ejecuta contra la base académica real y explica el resultado en lenguaje natural — citando los números.',
    'agent.tab.console': 'Consola',
    'agent.tab.history': 'Historial de consultas',
    'agent.suggested': 'Preguntas sugeridas',
    'agent.empty.title': 'Listo para razonar',
    'agent.empty.body': 'Elegí una pregunta sugerida o escribí la tuya. El agente va a mostrar la SQL que genera, los resultados y la respuesta — paso por paso.',
    'agent.composer': 'Pregunta sobre estudiantes, materias, inscripciones…',
    'agent.schema': 'Schema accesible',
    'agent.schema.note': 'El agente sólo puede leer estas 4 tablas. No puede modificar datos ni acceder a otras bases.',
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
    'common.close': 'Cerrar',
    'common.remove': 'Quitar',

    // --- Relative time
    'time.seconds': 'hace unos segundos',
    'time.minutes': 'hace {n} min',
    'time.hours': 'hace {n} h',
    'time.days': 'hace {n} días',

    // --- Sample doc names
    'sample.doc.reglamento': 'Reglamento académico 2025.pdf',
    'sample.doc.manual': 'Manual de matrículas — Vicerrectorado.pdf',
    'sample.doc.propiedad': 'Política de propiedad intelectual.pdf',
    'sample.doc.contratoA': 'Contrato proveedor A — Edificio Aulario.pdf',
    'sample.doc.contratoB': 'Contrato proveedor B — Edificio Aulario.pdf',
    'sample.doc.contratoC': 'Contrato proveedor C — Mantenimiento.pdf',
    'sample.doc.anexo': 'Anexo técnico — Pliegos 2025.pdf',
  },

  en: {
    'shell.demos': 'Demos',
    'shell.servicio': 'Service active',
    'shell.servicio.meta': 'api.v1 · 200 ms',
    'shell.brand.tag': 'NUTANIX ENTERPRISE AI',
    'shell.coming': 'Soon',
    'shell.dev': 'dev',
    'shell.theme.tip': 'Toggle theme',
    'shell.lang.tip': 'Change language',

    'demos.rag.title': 'Document chat',
    'demos.rag.tagline': 'Ask a PDF in plain English',
    'demos.comparator.title': 'Comparator',
    'demos.comparator.tagline': 'Side-by-side analysis',
    'demos.corpus.title': 'Academic corpus',
    'demos.corpus.tagline': 'Trends across 500+ theses',
    'demos.agent.title': 'Data agent',
    'demos.agent.tagline': 'Ask in plain English, get SQL',

    'header.demo': 'Demo',

    'rag.eyebrow': 'Demo 01 · RAG',
    'rag.title': 'Chat with your documents',
    'rag.subtitle': 'Upload a policy, manual or contract and ask it in plain English. Answers cite the exact article from the document.',
    'rag.upload': 'Upload document',
    'rag.docs.label': 'Indexed documents',
    'rag.docs.empty': 'Drop a PDF or click to upload',
    'rag.greeting': 'What would you like to ask about? I can search the academic policy, the enrollment manual, or the IP policy.',
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
    'cmp.subtitle': 'Pick 2–5 documents, define the dimensions you want to compare, and get a side-by-side analysis with verbatim phrases and citations.',
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
    'cmp.step3.ready.body': 'When you click Generate comparison, the LLM will read each document, evaluate the dimensions you chose and build a side-by-side analysis with verbatim citations.',
    'cmp.step3.cita': 'clause',

    'corpus.eyebrow': 'Coming soon · Q3 2026',
    'corpus.title': 'Spot trends across hundreds of theses and publications from your university.',
    'corpus.desc': 'Process large collections — 500+ documents — to extract patterns, cluster themes and surface evolution over time. Built on NAI on-premise hardware, with no data leaving your network.',
    'corpus.notify': 'Notify me when it ships',
    'corpus.roadmap': 'See roadmap',
    'corpus.cap1.title': 'Massive processing',
    'corpus.cap1.body': 'Parallel ingest and embedding of hundreds of PDFs on the NAI cluster.',
    'corpus.cap2.title': 'Thematic clustering',
    'corpus.cap2.body': 'Semantic clustering of theses by emerging topics, with no predefined labels.',
    'corpus.cap3.title': 'Temporal evolution',
    'corpus.cap3.body': 'How topics, authors and methods change across semesters.',
    'corpus.status': 'Status · Internal roadmap',
    'corpus.m1': 'Demo 01 — RAG in production',
    'corpus.m2': 'Demo 02 — Comparator in production',
    'corpus.m3': 'Demo 04 — SQL agent in testing',
    'corpus.m4': 'Access to NAI hardware (test cluster)',
    'corpus.m5': 'FastAPI / Python service for corpus',
    'corpus.m6': 'Demo 03 — Academic corpus (launch)',

    'agent.eyebrow': 'Demo 04 · Agent',
    'agent.title': 'Ask in English, get the answer',
    'agent.subtitle': 'The agent translates your question to SQL, runs it against the real academic database and explains the result in plain English — citing the numbers.',
    'agent.tab.console': 'Console',
    'agent.tab.history': 'Query history',
    'agent.suggested': 'Suggested questions',
    'agent.empty.title': 'Ready to reason',
    'agent.empty.body': 'Pick a suggested question or write your own. The agent will show the SQL it generates, the results and the answer — step by step.',
    'agent.composer': 'Ask about students, courses, enrollments…',
    'agent.schema': 'Accessible schema',
    'agent.schema.note': 'The agent can only read these 4 tables. It cannot modify data or access other databases.',
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
  },
};

// --- Suggested arrays (parallel per lang)

const SUGGESTED_DIMENSIONS_I18N = {
  es: ['Plazos de entrega', 'Penalizaciones', 'Responsabilidades', 'Forma de pago', 'Garantías', 'Causales de rescisión'],
  en: ['Delivery deadlines', 'Penalties', 'Responsibilities', 'Payment terms', 'Warranties', 'Termination clauses'],
};

const SUGGESTED_QUESTIONS_I18N = {
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

// --- Agent history (per-lang question text only)

const AGENT_HISTORY_I18N = {
  es: [
    '¿Cuántos estudiantes hay en total?',
    '¿Cuál fue la materia con más inscripciones en 2025-1?',
    '¿Promedio por carrera?',
    '¿Hay materias con mucha deserción este semestre?',
    '¿Edad promedio de estudiantes activos?',
  ],
  en: [
    'How many students are there in total?',
    'Which course had the most enrollments in 2025-1?',
    'GPA by major?',
    'Any courses with high drop-out rate this term?',
    'Average age of active students?',
  ],
};

// --- Lang hook ---------------------------------------------------------------
function useLang() {
  const [lang, setLang] = React.useState(() => localStorage.getItem('adp-lang') || 'es');
  React.useEffect(() => {
    localStorage.setItem('adp-lang', lang);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);
  return [lang, setLang];
}

// --- Helpers -----------------------------------------------------------------
function makeT(lang) {
  const dict = STRINGS[lang] || STRINGS.es;
  return function t(key, vars) {
    let s = dict[key];
    if (s == null) return key; // fallback to key for visibility
    if (vars) {
      for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    }
    return s;
  };
}

function formatRelative(date, lang) {
  const t = makeT(lang);
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return t('time.seconds');
  if (diff < 3600) return t('time.minutes', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('time.hours', { n: Math.floor(diff / 3600) });
  return t('time.days', { n: Math.floor(diff / 86400) });
}

// --- Lang context -----------------------------------------------------------
const LangContext = React.createContext({ lang: 'es', t: makeT('es'), setLang: () => {} });
function useT() { return React.useContext(LangContext); }

window.LangContext = LangContext;
window.useT = useT;
window.useLang = useLang;
window.makeT = makeT;
window.formatRelative = formatRelative;
window.SUGGESTED_DIMENSIONS_I18N = SUGGESTED_DIMENSIONS_I18N;
window.SUGGESTED_QUESTIONS_I18N = SUGGESTED_QUESTIONS_I18N;
window.AGENT_HISTORY_I18N = AGENT_HISTORY_I18N;
