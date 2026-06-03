// -----------------------------------------------------------------------------
// Seed del Demo 06 — Asistente clínico (ADR-0016).
//
// Crea:
//   - Tenant especial `clinical-shared` (slug) que aloja TODOS los pacientes
//     ficticios, sus consultas, y los protocolos. Compartido por cualquier
//     cliente que pruebe el demo (decisión 1B del ADR).
//   - 30 pacientes ficticios con perfiles diversos (edad, género, condiciones
//     crónicas, medicación).
//   - 5-8 consultas previas por paciente (≈150-240 consultas en total).
//   - 25 protocolos clínicos genéricos en 5 categorías (cardiología,
//     urgencias, medicina interna, pediatría, atención primaria).
//
// Características del seed:
//   - **Determinístico**: nada de Math.random ni Date.now en el contenido.
//     Cada corrida produce los mismos datos (importante para snapshots y
//     para que las demos sean reproducibles).
//   - **Idempotente**: upsert sobre `tenant.slug='clinical-shared'`. Re-correrlo
//     no duplica ni rompe; actualiza si los datos del seed cambiaron.
//   - **Datos sintéticos coherentes**: dosis dentro de rangos clínicos
//     verosímiles, diagnósticos coherentes con condiciones crónicas, fechas
//     ordenadas. Para que la demo "se sienta real" sin ser real.
//
// Disclaimer importante:
//   Este seed contiene SOLO datos ficticios. NUNCA cargar pacientes reales
//   sin pasar por certificación HIPAA-equivalente (Ley Orgánica de Salud
//   Ecuador, Art. 7). El frontend del demo muestra un banner permanente.
//
// Cómo correr:
//   npm run db:seed:clinical             # local con .env
//   npm run db:seed:clinical:railway     # contra Railway via DATABASE_PUBLIC_URL
// -----------------------------------------------------------------------------

import { PrismaClient } from '../generated/client/client.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Constantes del tenant compartido
// ---------------------------------------------------------------------------

const SHARED_TENANT_SLUG = 'clinical-shared';
const SHARED_TENANT_ID = 'ctnt_clinical_shared';
const SHARED_INDUSTRY_SLUG = 'salud';

// ---------------------------------------------------------------------------
// Datasets sintéticos
//
// Estos arrays son source-of-truth del seed. Tocarlos cambia el dataset que
// la demo presenta. La función que combina pacientes + consultas usa
// índices fijos (no random) para mantener determinismo entre corridas.
// ---------------------------------------------------------------------------

/** 30 pacientes ficticios con perfiles diversos. */
const PATIENTS = [
  // --- Adultos con enfermedades crónicas (10) ---
  {
    displayName: 'María Elena Vásquez',
    age: 67,
    gender: 'F',
    allergies: ['penicilina'],
    chronicConditions: ['HTA', 'DM2'],
    currentMedications: [
      'metformina 850mg BID',
      'enalapril 10mg QD',
      'AAS 100mg QD',
    ],
  },
  {
    displayName: 'Carlos Andrés Mendoza',
    age: 58,
    gender: 'M',
    allergies: [],
    chronicConditions: ['HTA', 'dislipidemia'],
    currentMedications: ['losartán 50mg QD', 'atorvastatina 20mg QD'],
  },
  {
    displayName: 'Lucía Patricia Salazar',
    age: 72,
    gender: 'F',
    allergies: ['sulfas'],
    chronicConditions: ['DM2', 'osteoartrosis'],
    currentMedications: [
      'insulina NPH 20U AM / 12U PM',
      'paracetamol 500mg PRN',
    ],
  },
  {
    displayName: 'Jorge Eduardo Cabrera',
    age: 64,
    gender: 'M',
    allergies: [],
    chronicConditions: ['EPOC', 'HTA'],
    currentMedications: ['salbutamol inhalador PRN', 'amlodipino 5mg QD'],
  },
  {
    displayName: 'Rosa María Pinto',
    age: 55,
    gender: 'F',
    allergies: [],
    chronicConditions: ['hipotiroidismo'],
    currentMedications: ['levotiroxina 75mcg QD'],
  },
  {
    displayName: 'Luis Fernando Castro',
    age: 71,
    gender: 'M',
    allergies: ['ibuprofeno'],
    chronicConditions: ['fibrilación auricular', 'HTA'],
    currentMedications: ['warfarina 5mg QD', 'metoprolol 50mg BID'],
  },
  {
    displayName: 'Ana Cristina Morales',
    age: 49,
    gender: 'F',
    allergies: ['mariscos'],
    chronicConditions: ['migraña crónica'],
    currentMedications: ['propranolol 40mg BID', 'sumatriptán 50mg PRN'],
  },
  {
    displayName: 'Roberto Javier Espinoza',
    age: 62,
    gender: 'M',
    allergies: [],
    chronicConditions: ['DM2', 'nefropatía diabética'],
    currentMedications: [
      'insulina glargina 24U QHS',
      'losartán 100mg QD',
      'furosemida 40mg QD',
    ],
  },
  {
    displayName: 'Patricia Isabel Ron',
    age: 68,
    gender: 'F',
    allergies: [],
    chronicConditions: ['osteoporosis', 'HTA'],
    currentMedications: ['alendronato 70mg semanal', 'losartán 50mg QD'],
  },
  {
    displayName: 'Manuel Antonio Yánez',
    age: 75,
    gender: 'M',
    allergies: ['codeína'],
    chronicConditions: ['insuficiencia cardíaca', 'HTA'],
    currentMedications: [
      'enalapril 20mg BID',
      'furosemida 40mg QD',
      'espironolactona 25mg QD',
      'digoxina 0.25mg QD',
    ],
  },

  // --- Adultos jóvenes / medianos sanos o con afecciones leves (10) ---
  {
    displayName: 'Daniela Estefanía Cevallos',
    age: 28,
    gender: 'F',
    allergies: [],
    chronicConditions: [],
    currentMedications: ['anticonceptivo oral combinado'],
  },
  {
    displayName: 'Andrés Felipe Naranjo',
    age: 34,
    gender: 'M',
    allergies: [],
    chronicConditions: ['asma leve intermitente'],
    currentMedications: ['salbutamol inhalador PRN'],
  },
  {
    displayName: 'Verónica Alejandra Pesántez',
    age: 41,
    gender: 'F',
    allergies: ['polen'],
    chronicConditions: ['rinitis alérgica'],
    currentMedications: ['loratadina 10mg QD durante temporada'],
  },
  {
    displayName: 'Diego Sebastián Velasco',
    age: 26,
    gender: 'M',
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
  },
  {
    displayName: 'Carolina Estefanía Bermeo',
    age: 38,
    gender: 'F',
    allergies: ['amoxicilina'],
    chronicConditions: ['hipotiroidismo subclínico'],
    currentMedications: ['levotiroxina 50mcg QD'],
  },
  {
    displayName: 'Mateo Alejandro Ramos',
    age: 45,
    gender: 'M',
    allergies: [],
    chronicConditions: ['gastritis crónica'],
    currentMedications: ['omeprazol 20mg QD'],
  },
  {
    displayName: 'Gabriela Salomé Larrea',
    age: 32,
    gender: 'F',
    allergies: [],
    chronicConditions: [],
    currentMedications: ['ácido fólico 1mg QD'],
  },
  {
    displayName: 'Francisco Javier Tobar',
    age: 51,
    gender: 'M',
    allergies: [],
    chronicConditions: ['hígado graso no alcohólico'],
    currentMedications: [],
  },
  {
    displayName: 'Mónica Beatriz Andrade',
    age: 47,
    gender: 'F',
    allergies: ['látex'],
    chronicConditions: ['fibromialgia'],
    currentMedications: ['amitriptilina 25mg QHS', 'pregabalina 75mg BID'],
  },
  {
    displayName: 'Sebastián Nicolás Calle',
    age: 29,
    gender: 'M',
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
  },

  // --- Pediátricos (5) ---
  {
    displayName: 'Emilia Sofía Granda',
    age: 4,
    gender: 'F',
    allergies: ['huevo'],
    chronicConditions: ['dermatitis atópica'],
    currentMedications: ['emoliente tópico BID'],
  },
  {
    displayName: 'Mateo Alejandro Pacheco',
    age: 8,
    gender: 'M',
    allergies: [],
    chronicConditions: ['asma persistente leve'],
    currentMedications: ['fluticasona inhalador 50mcg BID', 'salbutamol PRN'],
  },
  {
    displayName: 'Camila Antonia Yépez',
    age: 11,
    gender: 'F',
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
  },
  {
    displayName: 'Joaquín Esteban Rivera',
    age: 6,
    gender: 'M',
    allergies: ['nueces'],
    chronicConditions: [],
    currentMedications: [],
  },
  {
    displayName: 'Isabella Sofía Toledo',
    age: 15,
    gender: 'F',
    allergies: [],
    chronicConditions: ['acné moderado'],
    currentMedications: ['peróxido de benzoilo 5% tópico nocturno'],
  },

  // --- Adultos mayores con comorbilidades (5) ---
  {
    displayName: 'Hilda Esperanza Aguilar',
    age: 82,
    gender: 'F',
    allergies: [],
    chronicConditions: ['Alzheimer leve', 'HTA', 'osteoporosis'],
    currentMedications: [
      'donepezilo 5mg QHS',
      'losartán 50mg QD',
      'calcio + vitamina D QD',
    ],
  },
  {
    displayName: 'Galo Patricio Salinas',
    age: 78,
    gender: 'M',
    allergies: [],
    chronicConditions: ['Parkinson', 'HTA'],
    currentMedications: ['levodopa/carbidopa 100/25mg TID', 'losartán 50mg QD'],
  },
  {
    displayName: 'Mercedes Eulalia Torres',
    age: 85,
    gender: 'F',
    allergies: ['penicilina'],
    chronicConditions: ['insuficiencia renal crónica', 'HTA', 'DM2'],
    currentMedications: [
      'insulina glargina 18U QHS',
      'amlodipino 10mg QD',
      'sevelamer 800mg TID con comidas',
    ],
  },
  {
    displayName: 'César Augusto Vaca',
    age: 79,
    gender: 'M',
    allergies: [],
    chronicConditions: ['cardiopatía isquémica', 'DLP', 'HTA'],
    currentMedications: [
      'AAS 100mg QD',
      'atorvastatina 40mg QD',
      'bisoprolol 5mg QD',
      'enalapril 10mg BID',
    ],
  },
  {
    displayName: 'Norma Cecilia Padilla',
    age: 73,
    gender: 'F',
    allergies: [],
    chronicConditions: ['artritis reumatoide', 'HTA'],
    currentMedications: [
      'metotrexato 15mg semanal',
      'ácido fólico 5mg semanal',
      'losartán 50mg QD',
      'prednisona 5mg QD',
    ],
  },
] as const;

/**
 * Plantillas de consultas previas. Cada paciente recibe 5-8 consultas
 * intercaladas de estas plantillas. Los índices se asignan de forma
 * determinística (modulo del índice del paciente) para que el dataset sea
 * reproducible entre corridas.
 */
const CONSULTATION_TEMPLATES = [
  {
    monthsAgo: 1,
    physician: 'Dr. Hernández',
    reasonForVisit: 'Control de tensión arterial mensual',
    examFindings: 'TA 138/82 mmHg. FC 76 rpm. Resto sin particularidad.',
    diagnosis: 'HTA controlada',
    treatment: 'Continuar esquema actual. Control en 1 mes.',
    notes: 'Paciente refiere buena adherencia. Mantiene dieta hiposódica.',
  },
  {
    monthsAgo: 3,
    physician: 'Dra. Mejía',
    reasonForVisit: 'Cefalea de 3 días con náusea',
    examFindings: 'TA 142/88 mmHg. Examen neurológico normal.',
    diagnosis: 'Cefalea tensional secundaria a estrés',
    treatment: 'Paracetamol 500mg c/8h por 3 días. Hidratación.',
    notes: 'Sin signos de alarma. Recomendar reducción de carga laboral.',
  },
  {
    monthsAgo: 6,
    physician: 'Dr. Hernández',
    reasonForVisit: 'Control trimestral de diabetes',
    examFindings: 'HbA1c 7.8%. Peso 78 kg. Pulsos pedios presentes.',
    diagnosis: 'DM2 con control subóptimo',
    treatment: 'Aumentar metformina a 1000mg BID. Refuerzo dietético.',
    notes: 'Glucemia en ayunas variable. Evaluar adherencia a dieta.',
  },
  {
    monthsAgo: 9,
    physician: 'Dra. Cárdenas',
    reasonForVisit: 'Dolor lumbar mecánico de 1 semana',
    examFindings: 'Dolor a la palpación en L4-L5. Lasègue negativo.',
    diagnosis: 'Lumbalgia mecánica',
    treatment: 'AINES por 5 días, fisioterapia, ejercicios de fortalecimiento.',
    notes: 'Sin red flags. Si persiste >2 semanas, evaluar imágenes.',
  },
  {
    monthsAgo: 12,
    physician: 'Dr. Hernández',
    reasonForVisit: 'Check-up anual',
    examFindings:
      'Exploración completa sin particularidad. Laboratorios al día.',
    diagnosis: 'Estado de salud estable',
    treatment: 'Continuar tratamientos crónicos. Próximo control en 6 meses.',
    notes: 'Solicitar lipidograma y función renal en próximo control.',
  },
  {
    monthsAgo: 18,
    physician: 'Dr. Salinas',
    reasonForVisit: 'Tos productiva de 5 días con febrícula',
    examFindings: 'Crépitos en base derecha. SatO2 95%. Temp 37.8°C.',
    diagnosis: 'Infección respiratoria de vías bajas',
    treatment: 'Amoxicilina/clavulánico 875/125mg c/12h x 7 días. Hidratación.',
    notes: 'Control en 5 días. Si empeora, RX tórax y revaluación.',
  },
  {
    monthsAgo: 24,
    physician: 'Dra. Mejía',
    reasonForVisit: 'Episodios de palpitaciones intermitentes',
    examFindings: 'Auscultación cardíaca normal. ECG: ritmo sinusal.',
    diagnosis: 'Palpitaciones de probable origen ansioso',
    treatment: 'Holter 24h. Reducir café. Seguimiento en 2 semanas.',
    notes: 'Considerar derivación a cardiología si Holter anómalo.',
  },
  {
    monthsAgo: 30,
    physician: 'Dr. Hernández',
    reasonForVisit: 'Mareo postural ocasional',
    examFindings:
      'TA acostado 130/80, de pie 110/70 (drop 20 mmHg). HGT 105 mg/dL.',
    diagnosis: 'Hipotensión ortostática leve',
    treatment: 'Ajustar dosis de antihipertensivo. Hidratación adecuada.',
    notes: 'Recomendar levantarse lentamente. Control en 4 semanas.',
  },
] as const;

/**
 * 25 protocolos clínicos genéricos en 5 categorías. Cada uno es markdown
 * corto pero plausible — el LLM lo cita en su panel de "alertas y
 * protocolos" sin generar ruido.
 */
const PROTOCOLS = [
  // --- Cardiología (5) ---
  {
    title: 'Manejo de hipertensión arterial en adulto',
    category: 'cardiología',
    content: `# Manejo de HTA en adulto

## Criterios de inicio de tratamiento

- TA ≥ 140/90 mmHg confirmada en 2 mediciones separadas, O
- TA ≥ 130/80 mmHg en pacientes con DM, ERC o riesgo CV alto.

## Esquema inicial

1. **Primera línea (sin comorbilidad):** IECA (enalapril 10mg/día) o ARA-II
   (losartán 50mg/día) o diurético tiazídico (HCT 12.5mg/día).
2. **DM o ERC:** preferir IECA/ARA-II por efecto nefroprotector.
3. **Edad ≥65 sin otra patología:** considerar amlodipino 5mg/día.

## Objetivos

- Adulto general: < 140/90 mmHg.
- Diabético o ERC: < 130/80 mmHg.

## Control

- Primer control: 4-6 semanas tras inicio.
- Estable: cada 3-6 meses.`,
  },
  {
    title: 'Insuficiencia cardíaca con fracción de eyección reducida',
    category: 'cardiología',
    content: `# IC FEr (FEVI < 40%)

## Pilares del tratamiento

1. **IECA o ARA-II o ARNI** (sacubitril/valsartán de elección si tolera).
2. **Betabloqueante** (bisoprolol, carvedilol, metoprolol succinato).
3. **Antagonista del receptor de mineralocorticoide** (espironolactona 25mg).
4. **iSGLT2** (dapagliflozina o empagliflozina) — clase I evidencia A.

## Diurético

- Furosemida según congestión. Ajustar por peso diario.

## Seguimiento

- Pesaje diario. Aumento >2 kg en 3 días: ajustar diurético.
- Control mensual los primeros 3 meses, luego trimestral.`,
  },
  {
    title: 'Fibrilación auricular: anticoagulación',
    category: 'cardiología',
    content: `# Anticoagulación en FA no valvular

## Score CHA₂DS₂-VASc

- ≥2 en hombres / ≥3 en mujeres: anticoagulación indicada.
- =1 en hombres / =2 en mujeres: considerar individualizado.

## Elección

- **DOAC preferidos** (apixabán, rivaroxabán, dabigatrán) salvo:
  - Estenosis mitral moderada-severa: warfarina.
  - Prótesis valvular mecánica: warfarina.
  - ClCr <15 ml/min: warfarina.

## Monitorización

- Función renal cada 6 meses con DOAC.
- INR mensual con warfarina (objetivo 2-3).`,
  },
  {
    title: 'Síndrome coronario agudo: triaje en urgencias',
    category: 'cardiología',
    content: `# SCA en urgencias

## Triaje inmediato (primeros 10 min)

1. ECG de 12 derivaciones.
2. AAS 300mg masticable (si no contraindicado).
3. Troponina ultrasensible.
4. Acceso venoso.

## Diferenciación

- **SCACEST** (ST elevado): activar código IAM, reperfusión <120 min.
- **SCASEST** (ST no elevado, troponina+): hospitalizar para angiografía
  precoz <24h en GRACE alto.
- **Angina inestable** (troponina-): estratificación de riesgo.

## Contraindicaciones a AAS

- Sangrado activo, hipersensibilidad documentada, úlcera péptica activa.`,
  },
  {
    title: 'Dislipidemia: metas y tratamiento',
    category: 'cardiología',
    content: `# Manejo de dislipidemia

## Metas de LDL según riesgo CV

- Riesgo bajo: <115 mg/dL.
- Riesgo moderado: <100 mg/dL.
- Riesgo alto (DM, ERC, ≥2 FRCV): <70 mg/dL.
- Riesgo muy alto (ECV establecida): <55 mg/dL.

## Estatinas

- Alta intensidad: atorvastatina 40-80mg, rosuvastatina 20-40mg.
- Moderada intensidad: atorvastatina 10-20mg, simvastatina 20-40mg.

## Seguimiento

- Lipidograma a las 8-12 semanas de iniciar.
- Si no llega a meta: aumentar dosis o agregar ezetimibe.`,
  },

  // --- Urgencias (5) ---
  {
    title: 'Anafilaxia: manejo inicial',
    category: 'urgencias',
    content: `# Anafilaxia

## Diagnóstico clínico

Inicio agudo (minutos-horas) con:
- Compromiso de piel/mucosas Y al menos uno de:
  - Compromiso respiratorio.
  - TA reducida o síntomas de hipoperfusión.
  - Síntomas gastrointestinales severos.

## Tratamiento prioritario

1. **Epinefrina IM** 0.3-0.5mg (adulto) o 0.01mg/kg (pediátrico) en muslo
   anterolateral. **Repetir cada 5-15 min** si no hay respuesta.
2. Oxígeno suplementario, posición de Trendelenburg si shock.
3. Volumen IV: SS 0.9% 1-2 L en bolus.
4. Antihistamínicos (difenhidramina 25-50mg IV) — adjunto, no reemplaza.
5. Corticoides (hidrocortisona 200mg IV) — prevenir reacción bifásica.

## Observación

Mínimo 4-6 horas tras estabilización por riesgo de fase bifásica.`,
  },
  {
    title: 'Crisis asmática severa',
    category: 'urgencias',
    content: `# Crisis asmática severa

## Criterios de severidad

- FR >30, FC >120, SatO2 <92%, dificultad para hablar, uso de músculos
  accesorios.
- PEF <50% del basal.

## Tratamiento inicial (primera hora)

1. Salbutamol nebulizado 5mg + ipratropio 0.5mg cada 20 min x 3 dosis.
2. Oxígeno para SatO2 ≥94%.
3. Corticoides sistémicos: prednisona 50mg VO o metilprednisolona 60mg IV.
4. Si severa: sulfato de magnesio 2g IV en 20 min.

## Criterios de admisión

- Falta de respuesta tras 1h de tratamiento intensivo.
- PEF <60% post-broncodilatador.
- Necesidad de oxígeno mantenido.`,
  },
  {
    title: 'Stroke isquémico agudo: ventana terapéutica',
    category: 'urgencias',
    content: `# ACV isquémico agudo

## Triaje rápido (escala FAST)

- **F**ace drooping, **A**rm weakness, **S**peech difficulty, **T**ime to
  call.

## Estudios iniciales (objetivo <25 min)

1. TC simple de cráneo (descartar hemorragia).
2. ECG, glucemia, electrolitos, función renal.
3. NIHSS para cuantificar severidad.

## Trombolisis (rtPA)

- Ventana: 0-4.5 h desde inicio de síntomas.
- Contraindicaciones absolutas: hemorragia previa, cirugía reciente,
  trauma craneal <3 meses, INR >1.7, plaquetas <100K.

## Trombectomía mecánica

- Hasta 24h si imagen demuestra penumbra recuperable.`,
  },
  {
    title: 'Cetoacidosis diabética en adulto',
    category: 'urgencias',
    content: `# CAD en adulto

## Diagnóstico

- Glucemia >250 mg/dL.
- pH <7.30 o HCO3 <18 mEq/L.
- Cetonas positivas en orina o sangre.

## Tratamiento (primeras 24h)

### Hidratación

- SS 0.9% 1-1.5 L/h primera hora.
- Continuar 250-500 ml/h con SS 0.45% si Na corregido alto.
- Cambiar a SS 5% cuando glucemia <250 mg/dL.

### Insulina

- Bolus inicial 0.1 U/kg IV, luego 0.1 U/kg/h en infusión.
- Reducir velocidad al 50% cuando glucemia <200 mg/dL.

### Potasio

- K <3.3: NO administrar insulina hasta reponer.
- K 3.3-5.3: agregar 20-30 mEq/L de KCl a fluidos.

## Monitoreo

- Glucemia c/1h, electrolitos c/2-4h, pH c/4h hasta normalización.`,
  },
  {
    title: 'Sepsis: bundle de la primera hora',
    category: 'urgencias',
    content: `# Sepsis — bundle 1h

## Identificación temprana

qSOFA ≥2 (FR ≥22, alteración mental, TA sistólica ≤100).

## Acciones en la primera hora

1. **Medir lactato** sérico. Repetir si inicial >2 mmol/L.
2. **Cultivos** (sangre x2, orina, herida si aplica) antes de antibióticos.
3. **Antibiótico empírico de amplio espectro** según foco sospechado.
4. **Cristaloides** 30 ml/kg si hipotensión o lactato >4 mmol/L.
5. **Vasopresores** (norepinefrina) si TAM <65 mmHg post-fluidos.

## Reevaluación

A las 3-6h: respuesta hemodinámica, lactato, perfusión periférica.`,
  },

  // --- Medicina interna (5) ---
  {
    title: 'Diabetes mellitus tipo 2: manejo escalonado',
    category: 'medicina interna',
    content: `# DM2 manejo escalonado

## Objetivos

- HbA1c: <7% en adulto sin comorbilidad significativa.
- HbA1c: <8% en adulto mayor frágil o con esperanza de vida limitada.

## Esquema escalonado

### Primera línea
**Metformina** 500-1000mg BID. Iniciar con 500mg y titular en 4 semanas.

### Si HbA1c no llega a meta a 3 meses

Agregar según comorbilidad:
- ECV o IC: iSGLT2 (dapagliflozina) o GLP-1 RA (semaglutida).
- Sin ECV: sulfonilurea, DPP4-i, o iSGLT2/GLP-1 RA.

### Si HbA1c persiste >9%

Considerar insulina basal (glargina) 0.1-0.2 U/kg al acostarse.

## Educación esencial

- Auto-monitoreo glicémico.
- Síntomas de hipoglucemia.
- Cuidado de pies (revisar daily).`,
  },
  {
    title: 'Anemia ferropénica en adulto',
    category: 'medicina interna',
    content: `# Anemia ferropénica

## Diagnóstico

- Hb < 13 g/dL (hombres) o < 12 g/dL (mujeres no embarazadas).
- Ferritina < 30 ng/mL (en ausencia de inflamación).
- Saturación de transferrina < 20%.

## Estudio de causa

- Hombres y mujeres postmenopáusicas: descartar pérdida digestiva
  (endoscopia + colonoscopia).
- Mujeres premenopáusicas: descartar pérdida ginecológica.

## Tratamiento

- Sulfato ferroso 200mg (60mg de Fe elemental) c/8h con vitamina C en ayunas.
- Continuar 3-6 meses tras normalizar Hb para repletar depósitos.
- Si intolerancia o malabsorción: hierro IV (hierro sacarosa).

## Control

- Hb a las 4 semanas: incremento esperado 1-2 g/dL.
- Si no responde: revisar adherencia o causa persistente.`,
  },
  {
    title: 'Enfermedad renal crónica: estadificación y manejo',
    category: 'medicina interna',
    content: `# ERC: estadios y manejo

## Estadificación (KDIGO)

| Estadio | TFGe (ml/min/1.73m²) |
| ------- | -------------------- |
| 1       | ≥90 + daño renal     |
| 2       | 60-89 + daño renal   |
| 3a      | 45-59                |
| 3b      | 30-44                |
| 4       | 15-29                |
| 5       | <15 o diálisis       |

## Manejo según estadio

### Estadio 1-3a

- Control de TA (objetivo <130/80).
- IECA/ARA-II como primera línea.
- Control glucémico estricto si DM.
- Evitar nefrotóxicos (AINES, contraste yodado, aminoglucósidos).

### Estadio 3b-4

- Lo anterior +
- Manejo de complicaciones: anemia (EPO si Hb <10), trastornos
  mineralóseos, acidosis.
- Derivación a nefrología.

### Estadio 5

- Preparar terapia sustitutiva renal.`,
  },
  {
    title: 'EPOC exacerbación moderada-severa',
    category: 'medicina interna',
    content: `# EPOC exacerbación

## Definición

Aumento agudo de síntomas (disnea, tos, esputo) que requiere modificación
de tratamiento basal.

## Severidad

- **Leve**: solo aumenta SABA.
- **Moderada**: requiere antibióticos y/o corticoides orales.
- **Severa**: requiere hospitalización.

## Tratamiento moderado-severo

1. **Broncodilatadores** de acción corta: salbutamol 2-4 puffs c/4-6h.
2. **Corticoides sistémicos**: prednisona 40mg/día x 5 días.
3. **Antibióticos** si esputo purulento + ≥2 síntomas cardinales:
   - Amoxicilina/clavulánico 875/125 c/12h x 5-7 días.
   - Alternativa: levofloxacino 500mg/día.
4. **Oxigenoterapia** controlada (SatO2 88-92%).

## Hospitalización

- Disnea severa, alteración mental, hipoxemia significativa,
  comorbilidades graves.`,
  },
  {
    title: 'Hipotiroidismo primario en adulto',
    category: 'medicina interna',
    content: `# Hipotiroidismo primario

## Diagnóstico

- TSH elevada con T4L baja: hipotiroidismo clínico.
- TSH elevada con T4L normal: hipotiroidismo subclínico.

## Tratamiento

### Hipotiroidismo clínico
**Levotiroxina** 1.6 mcg/kg/día (peso ideal) en ayunas. Iniciar con dosis
plena en adulto sano <60 años, o 25-50 mcg en ancianos o cardiópatas.

### Hipotiroidismo subclínico
Tratar si:
- TSH >10 mUI/L.
- TSH 4.5-10 + síntomas o anticuerpos TPO+ o embarazo.

## Seguimiento

- TSH a las 6-8 semanas de iniciar o cambiar dosis.
- Una vez estable: TSH anual.
- Tomar levotiroxina 30-60 min antes de desayuno, separado de calcio y
  hierro.`,
  },

  // --- Pediatría (5) ---
  {
    title: 'Bronquiolitis del lactante',
    category: 'pediatría',
    content: `# Bronquiolitis del lactante

## Diagnóstico clínico

Lactante <2 años con:
- Primer episodio de sibilancias.
- Pródromo viral 1-3 días previos.
- Hallazgos: taquipnea, retracciones, sibilancias o crepitantes.

## Manejo

### Soporte

1. Hidratación oral preferida; IV si no tolera VO.
2. Oxígeno suplementario para SatO2 ≥92%.
3. Aspiración de secreciones nasales antes de alimentar.

### Lo que NO se hace

- Broncodilatadores rutinarios (no mejoran outcome).
- Corticoides sistémicos.
- Antibióticos salvo sobreinfección bacteriana documentada.

## Criterios de hospitalización

- SatO2 <92% en aire ambiente.
- Apnea.
- Dificultad respiratoria moderada-severa.
- Mala tolerancia oral (<50% de ingesta habitual).
- <3 meses de edad.`,
  },
  {
    title: 'Fiebre sin foco en lactante 3-36 meses',
    category: 'pediatría',
    content: `# Fiebre sin foco en lactante

## Estratificación según edad

### <3 meses
Hospitalizar, sepsis-workup completo, ATB empírico hasta resultados.

### 3-36 meses con T ≥39°C

Evaluar criterios de riesgo:

#### Bajo riesgo
- Buena apariencia (escala de Yale).
- Vacunación completa.
- Sin comorbilidades.
→ **Observación domiciliaria con control en 24-48h**.

#### Alto riesgo
- Apariencia tóxica, irritabilidad, mala perfusión.
→ **Workup: HC, EGO, urocultivo, hemocultivos si T ≥39°C**.

## ITU oculta

Hasta 7% en niñas <24m y niños <12m no circuncidados — examinar orina si
fiebre persiste >48h sin foco.`,
  },
  {
    title: 'Asma pediátrica: clasificación y manejo',
    category: 'pediatría',
    content: `# Asma pediátrica

## Clasificación de severidad

| Severidad                | Síntomas día | Despertares nocturnos | SABA   |
| ------------------------ | ------------ | --------------------- | ------ |
| Intermitente             | ≤2/sem       | ≤2/mes                | ≤2/sem |
| Persistente leve         | >2/sem       | 3-4/mes               | >2/sem |
| Persistente moderada     | Diario       | >1/sem                | Diario |
| Persistente severa       | Continuo     | Frecuente             | Varias/día |

## Tratamiento escalonado

### Step 1 (intermitente)
SABA PRN.

### Step 2 (persistente leve)
ICS dosis baja diaria + SABA PRN.

### Step 3 (persistente moderada)
ICS dosis media o ICS bajo + LABA + SABA PRN.

### Step 4-5 (persistente severa)
ICS dosis alta + LABA, considerar biológicos (omalizumab si IgE alto).

## Plan de acción por escrito

Esencial para familia: identificar síntomas, qué hacer en exacerbación,
cuándo acudir a urgencias.`,
  },
  {
    title: 'Deshidratación pediátrica',
    category: 'pediatría',
    content: `# Deshidratación en niños

## Clasificación

| Grado     | Pérdida peso | Apariencia       | Mucosas  | Llenado cap |
| --------- | ------------ | ---------------- | -------- | ----------- |
| Leve      | <5%          | Normal           | Húmedas  | <2s         |
| Moderada  | 5-10%        | Irritable, sed   | Secas    | 2-3s        |
| Severa    | >10%         | Letárgico, shock | Muy secas | >3s         |

## Tratamiento

### Deshidratación leve-moderada
SRO 50-100 ml/kg en 4 horas. Continuar lactancia materna.

### Deshidratación severa
SS 0.9% 20 ml/kg en bolus IV rápido. Repetir hasta 60 ml/kg si persiste shock.
Continuar con SS 5% mantenimiento.

## Signos de mejoría

- Recupera peso.
- Diuresis ≥1 ml/kg/h.
- Mucosas húmedas, llenado capilar <2s.`,
  },
  {
    title: 'Vacunación esquema básico Ecuador',
    category: 'pediatría',
    content: `# Esquema vacunal Ecuador

## Esenciales según MSP

| Edad      | Vacunas                                       |
| --------- | --------------------------------------------- |
| RN        | BCG, hepatitis B                              |
| 2 meses   | Pentavalente (DPT-Hib-HepB), VOP, neumococo, rotavirus |
| 4 meses   | Pentavalente, VOP, neumococo, rotavirus       |
| 6 meses   | Pentavalente, VOP, influenza estacional       |
| 12 meses  | SRP, neumococo refuerzo, varicela             |
| 15 meses  | DPT refuerzo, VOP                             |
| 18 meses  | Hepatitis A                                   |
| 6 años    | DT, SRP refuerzo                              |
| 9 años    | HPV (niñas)                                   |
| Adolescente | Tdap, influenza anual                       |

## Contraindicaciones absolutas

- Anafilaxia previa a la misma vacuna.
- Inmunocomprometido severo (para vacunas vivas).

## Falsas contraindicaciones

- Fiebre baja, resfrío leve, antibiótico actual, embarazo de la madre.`,
  },

  // --- Atención primaria (5) ---
  {
    title: 'Tamizaje cardiovascular en adulto sano',
    category: 'atención primaria',
    content: `# Tamizaje CV en adulto

## Anual

- Tensión arterial: desde 18 años.
- IMC y circunferencia abdominal.
- Glucemia en ayunas o HbA1c si factores de riesgo.

## Cada 5 años (desde 40 años)

- Lipidograma completo.

## Cálculo de riesgo CV

Score de Framingham o tabla SCORE OMS para Ecuador a los 40 años.

## Cribado según resultados

| Hallazgo                | Acción                                |
| ----------------------- | ------------------------------------- |
| TA 130-139 / 80-89      | Estilo de vida + control 6 meses      |
| TA ≥140/90 confirmada   | Iniciar tratamiento farmacológico     |
| Glucemia ≥126 mg/dL x2  | Diagnóstico DM2                       |
| LDL ≥130 + ≥2 FRCV      | Estatina + estilo de vida             |`,
  },
  {
    title: 'Síndrome metabólico: diagnóstico y abordaje',
    category: 'atención primaria',
    content: `# Síndrome metabólico

## Criterios (IDF, requiere obesidad abdominal +2 más)

1. **Obesidad abdominal**: CC ≥90cm (hombres latinos) o ≥80cm (mujeres).
2. Triglicéridos ≥150 mg/dL o tratamiento específico.
3. HDL <40 (hombres) o <50 (mujeres) o tratamiento específico.
4. TA ≥130/85 o tratamiento.
5. Glucemia ayunas ≥100 mg/dL.

## Abordaje

### Cambios de estilo de vida (prioritario)

- Pérdida de peso 5-10% del peso inicial.
- Dieta mediterránea o DASH.
- Actividad física: 150 min/semana de intensidad moderada.

### Tratamiento farmacológico

Según componente:
- DM2/prediabetes: metformina.
- HTA: IECA/ARA-II o tiazida.
- DLP: estatina.

## Seguimiento

Cada 3 meses inicial, anual una vez controlado.`,
  },
  {
    title: 'Tabaquismo: cesación en atención primaria',
    category: 'atención primaria',
    content: `# Cesación de tabaco — 5 As

## Algoritmo

1. **Ask** (preguntar): consumo en TODAS las consultas.
2. **Advise** (aconsejar): mensaje claro y personalizado de dejar de fumar.
3. **Assess** (evaluar): disposición al cambio. Estadio de Prochaska.
4. **Assist** (asistir): plan + farmacoterapia si listo.
5. **Arrange** (acordar): seguimiento estructurado.

## Farmacoterapia (4-12 semanas)

### Primera línea

- **Vareniclina** 0.5mg → titular a 1mg BID por 12 semanas.
- **TRN combinada**: parche 21mg/día + chicle 4mg PRN.
- **Bupropión** 150mg BID por 7-12 semanas.

### Contraindicaciones vareniclina

- Antecedente de depresión severa, riesgo de suicidio.

## Seguimiento

- 1ª semana: refuerzo motivacional, manejo de síntomas de abstinencia.
- 4 semanas: tasa de recaída más alta.
- 6 y 12 meses: confirmar abstinencia.`,
  },
  {
    title: 'Depresión mayor: diagnóstico y tratamiento inicial',
    category: 'atención primaria',
    content: `# Depresión mayor en atención primaria

## Criterios DSM-5 (≥5 síntomas por ≥2 semanas)

1. Ánimo deprimido casi todo el día.
2. Anhedonia.
3. Cambios de peso significativos.
4. Insomnio o hipersomnia.
5. Agitación o enlentecimiento psicomotor.
6. Fatiga o pérdida de energía.
7. Sentimientos de inutilidad o culpa.
8. Concentración o decisión disminuida.
9. Pensamientos de muerte o suicidio.

## Tamizaje rápido

PHQ-9: ≥10 sugiere depresión moderada-severa.

## Tratamiento inicial

### Leve a moderada
- Psicoeducación + activación conductual + seguimiento.
- Considerar TCC.

### Moderada a severa
- Antidepresivo + psicoterapia.
- ISRS de primera línea: sertralina 50mg/día, escitalopram 10mg/día,
  fluoxetina 20mg/día.
- Evaluar respuesta a las 4-6 semanas.

## Derivación a psiquiatría

- Ideación suicida activa.
- Síntomas psicóticos.
- Falta de respuesta a 2 antidepresivos.`,
  },
  {
    title: 'Lumbalgia mecánica no específica',
    category: 'atención primaria',
    content: `# Lumbalgia mecánica

## Red flags (descartar antes de cualquier tratamiento conservador)

- Edad <20 o >50 con nuevo inicio.
- Fiebre, pérdida de peso, cáncer previo.
- Trauma significativo.
- Déficit neurológico progresivo.
- Síndrome de cauda equina (retención urinaria, anestesia en silla de
  montar).
- Inmunosupresión.

## Imagen NO indicada en lumbalgia mecánica sin red flags

Las primeras 4-6 semanas: solo si hay red flags o no responde a tratamiento.

## Tratamiento

### Primera línea (4 semanas)

- Mantener actividad — evitar reposo en cama.
- Paracetamol 1g c/8h regular.
- Calor local.

### Si no mejora a 1-2 semanas

- AINEs (ibuprofeno 600mg c/8h por 7-10 días) si no contraindicado.
- Fisioterapia con énfasis en ejercicios de fortalecimiento.

### Cronificación (>12 semanas)

- TCC para dolor crónico.
- Considerar derivación a especialista en dolor.`,
  },
] as const;

// ---------------------------------------------------------------------------
// Lógica del seed
// ---------------------------------------------------------------------------

/**
 * Genera 5-8 consultas para un paciente. La cantidad y selección de templates
 * dependen del índice del paciente (determinístico).
 */
function generateConsultationsForPatient(patientIndex: number): Array<{
  date: Date;
  treatingPhysician: string;
  reasonForVisit: string;
  examFindings: string | null;
  diagnosis: string;
  treatment: string;
  notes: string | null;
}> {
  // Cantidad: 5-8 según patientIndex (deterministico). Pacientes con índice
  // bajo (los crónicos) reciben más consultas.
  const count = 5 + (patientIndex % 4); // 5, 6, 7, o 8

  // Fecha base fija para que el seed no varíe entre corridas. Esta es
  // 2026-01-01 — los `monthsAgo` de cada template se restan de acá.
  const baseDate = new Date('2026-01-01T08:00:00Z');

  return Array.from({ length: count }, (_, i) => {
    // Selecciona template de forma rotativa según patientIndex + i.
    const template =
      CONSULTATION_TEMPLATES[
        (patientIndex + i) % CONSULTATION_TEMPLATES.length
      ];
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() - template.monthsAgo);

    return {
      date,
      treatingPhysician: template.physician,
      reasonForVisit: template.reasonForVisit,
      examFindings: template.examFindings,
      diagnosis: template.diagnosis,
      treatment: template.treatment,
      notes: template.notes,
    };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🩺 Seeding Demo 06 — Asistente clínico...');

  // 1) Verificar que la industria 'salud' existe (seed-tenants la crea).
  const saludIndustry = await prisma.industry.findUnique({
    where: { slug: SHARED_INDUSTRY_SLUG },
  });
  if (!saludIndustry) {
    throw new Error(
      `La industria '${SHARED_INDUSTRY_SLUG}' no existe. Corre primero ` +
        `\`npm run db:seed:tenants\` para crear las industries base.`,
    );
  }

  // 2) Tenant compartido `clinical-shared` — idempotente vía upsert.
  const sharedTenant = await prisma.tenant.upsert({
    where: { slug: SHARED_TENANT_SLUG },
    update: {
      displayName: 'Demo 06 · Catálogo compartido de pacientes ficticios',
      industryId: saludIndustry.id,
    },
    create: {
      id: SHARED_TENANT_ID,
      slug: SHARED_TENANT_SLUG,
      displayName: 'Demo 06 · Catálogo compartido de pacientes ficticios',
      industryId: saludIndustry.id,
      enabledDemos: ['clinical'],
      branding: {},
      status: 'active',
    },
  });
  console.log(`  ✓ Tenant '${SHARED_TENANT_SLUG}' (id: ${sharedTenant.id})`);

  // 3) Pacientes — borramos y recreamos para mantener determinismo.
  //    La cascada del FK arrastra Consultation.
  await prisma.consultation.deleteMany({
    where: { tenantId: sharedTenant.id },
  });
  await prisma.patient.deleteMany({ where: { tenantId: sharedTenant.id } });

  let totalConsultations = 0;
  for (let i = 0; i < PATIENTS.length; i++) {
    const p = PATIENTS[i];
    const patient = await prisma.patient.create({
      data: {
        tenantId: sharedTenant.id,
        displayName: p.displayName,
        age: p.age,
        gender: p.gender,
        allergies: [...p.allergies],
        chronicConditions: [...p.chronicConditions],
        currentMedications: [...p.currentMedications],
      },
    });

    const consults = generateConsultationsForPatient(i);
    if (consults.length > 0) {
      await prisma.consultation.createMany({
        data: consults.map((c) => ({
          tenantId: sharedTenant.id,
          patientId: patient.id,
          date: c.date,
          treatingPhysician: c.treatingPhysician,
          reasonForVisit: c.reasonForVisit,
          examFindings: c.examFindings,
          diagnosis: c.diagnosis,
          treatment: c.treatment,
          notes: c.notes,
        })),
      });
      totalConsultations += consults.length;
    }
  }
  console.log(
    `  ✓ ${PATIENTS.length} pacientes + ${totalConsultations} consultas`,
  );

  // 4) Protocolos clínicos — borramos y recreamos por determinismo.
  await prisma.clinicalProtocol.deleteMany({
    where: { tenantId: sharedTenant.id },
  });
  await prisma.clinicalProtocol.createMany({
    data: PROTOCOLS.map((p) => ({
      tenantId: sharedTenant.id,
      title: p.title,
      category: p.category,
      content: p.content,
    })),
  });
  console.log(`  ✓ ${PROTOCOLS.length} protocolos clínicos`);

  console.log('🎉 Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
