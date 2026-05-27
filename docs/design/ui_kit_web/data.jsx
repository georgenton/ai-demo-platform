// =============================================================================
// ui_kits/web/data.jsx — Catalog + fake data factories (lang-aware).
// =============================================================================

const DEMOS_META = [
  { id: 'rag', icon: 'message-square-text', status: 'live' },
  { id: 'comparator', icon: 'git-compare-arrows', status: 'live' },
  { id: 'corpus', icon: 'library-big', status: 'coming-soon' },
  { id: 'agent', icon: 'bot', status: 'live' },
];

function buildDemos(t) {
  return DEMOS_META.map((d) => ({
    ...d,
    title: t(`demos.${d.id}.title`),
    tagline: t(`demos.${d.id}.tagline`),
  }));
}

function buildSampleDocsRag(t) {
  return [
    { id: 'd1', name: t('sample.doc.reglamento'), chunkCount: 124, createdAt: new Date(Date.now() - 86400 * 2 * 1000).toISOString(), size: '3.4 MB' },
    { id: 'd2', name: t('sample.doc.manual'),     chunkCount: 38,  createdAt: new Date(Date.now() - 3600 * 5 * 1000).toISOString(),  size: '1.1 MB' },
    { id: 'd3', name: t('sample.doc.propiedad'),  chunkCount: 21,  createdAt: new Date(Date.now() - 60 * 25 * 1000).toISOString(),   size: '0.7 MB' },
  ];
}

function buildSampleDocsCompare(t) {
  return [
    { id: 'c1', name: t('sample.doc.contratoA'), chunkCount: 64, createdAt: new Date(Date.now() - 86400 * 3 * 1000).toISOString(), size: '2.1 MB' },
    { id: 'c2', name: t('sample.doc.contratoB'), chunkCount: 58, createdAt: new Date(Date.now() - 86400 * 3 * 1000).toISOString(), size: '1.9 MB' },
    { id: 'c3', name: t('sample.doc.contratoC'), chunkCount: 41, createdAt: new Date(Date.now() - 3600 * 8 * 1000).toISOString(),  size: '1.4 MB' },
    { id: 'c4', name: t('sample.doc.anexo'),     chunkCount: 19, createdAt: new Date(Date.now() - 3600 * 2 * 1000).toISOString(),  size: '0.6 MB' },
  ];
}

const SCHEMA = [
  { name: 'Course', columns: [
    { name: 'id', type: 'uuid' },
    { name: 'code', type: 'text' },
    { name: 'name', type: 'text' },
    { name: 'credits', type: 'int' },
  ]},
  { name: 'Student', columns: [
    { name: 'id', type: 'uuid' },
    { name: 'fullName', type: 'text' },
    { name: 'email', type: 'text' },
    { name: 'enrolledAt', type: 'timestamp' },
  ]},
  { name: 'Enrollment', columns: [
    { name: 'id', type: 'uuid' },
    { name: 'studentId', type: 'uuid' },
    { name: 'courseId', type: 'uuid' },
    { name: 'term', type: 'text' },
    { name: 'status', type: 'enum' },
  ]},
  { name: 'Grade', columns: [
    { name: 'id', type: 'uuid' },
    { name: 'enrollmentId', type: 'uuid' },
    { name: 'examType', type: 'text' },
    { name: 'score', type: 'numeric' },
  ]},
];

function buildAgentHistory(lang) {
  const qs = window.AGENT_HISTORY_I18N[lang] || window.AGENT_HISTORY_I18N.es;
  return [
    { id: 'h1', question: qs[0], sql: 'SELECT COUNT(*) FROM students', rowCount: 1, durationMs: 12, success: true,  turns: 1, createdAt: new Date(Date.now() - 60 * 8 * 1000).toISOString() },
    { id: 'h2', question: qs[1], sql: "SELECT c.name, COUNT(*) AS n FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.term = '2025-1' GROUP BY c.name ORDER BY n DESC LIMIT 5", rowCount: 5, durationMs: 38, success: true, turns: 2, createdAt: new Date(Date.now() - 60 * 14 * 1000).toISOString() },
    { id: 'h3', question: qs[2], sql: 'SELECT major, AVG(score) FROM enrollments JOIN grades …', rowCount: 0, durationMs: 4, success: false, errorMessage: 'columna "major" no existe', turns: 3, createdAt: new Date(Date.now() - 60 * 22 * 1000).toISOString() },
    { id: 'h4', question: qs[3], sql: "SELECT c.name, COUNT(*) FILTER (WHERE e.status='dropped') AS dropped FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.term = '2025-2' GROUP BY c.name HAVING COUNT(*) FILTER (WHERE e.status='dropped') > 5 ORDER BY dropped DESC", rowCount: 7, durationMs: 54, success: true, turns: 2, createdAt: new Date(Date.now() - 3600 * 1.5 * 1000).toISOString() },
    { id: 'h5', question: qs[4], sql: "SELECT AVG(EXTRACT(YEAR FROM AGE(birth_date))) FROM students WHERE active = true", rowCount: 1, durationMs: 22, success: true, turns: 1, createdAt: new Date(Date.now() - 3600 * 3 * 1000).toISOString() },
  ];
}

window.DEMOS_META = DEMOS_META;
window.SCHEMA = SCHEMA;
window.buildDemos = buildDemos;
window.buildSampleDocsRag = buildSampleDocsRag;
window.buildSampleDocsCompare = buildSampleDocsCompare;
window.buildAgentHistory = buildAgentHistory;
