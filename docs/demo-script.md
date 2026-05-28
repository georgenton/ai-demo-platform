# Guion de demo — presentación a clientes

Manual de campo para presentar la plataforma en una reunión de **30
minutos**. Pensado para que Edguitar abra la conversación comercial y
Jorge maneje los demos en vivo, sin inventar respuestas y sin que la
demo se nos vaya de las manos si algo falla.

> Esto **no** es un script para leer literal. Es un mapa: qué orden
> seguir, qué clickear, qué decir mientras streama el LLM, y qué
> responder cuando el cliente pregunte algo difícil. Adaptá el tono al
> interlocutor (rectorado vs. CIO vs. legal).

---

## 0) Antes de la reunión

### T-30 min — checklist técnico

Corré esto en la máquina que va a proyectar:

```bash
# Stack arriba con todo el contenido pre-cargado
npm run demo:start
```

El script tarda ~60s. Cuando termina, mostrá los tres URLs:

- Frontend: <http://localhost:4200>
- Backend: <http://localhost:3000/api/v1>
- Swagger: <http://localhost:3000/api/docs> _(no se enseña al cliente —
  está por si pregunta "¿hay API?")_

**Si algo falla**, mira `/tmp/demo-api.log` y `/tmp/demo-web.log`. El
99% de las fallas son `CHAT_API_KEY` o `EMBEDDINGS_API_KEY` vacías o
inválidas en `.env` — el script lo dice claro cuando pasa.

### T-5 min — preparación del escenario

1. **Cerrá pestañas distractoras.** El cliente solo debe ver la app y
   máximo una pestaña de "fuentes" si quieres mostrar un PDF original.
2. **Modo claro** en el sistema. La app soporta dark mode pero la demo
   se ve más limpia en light, y los PDFs proyectan mejor.
3. **Abrí estas pestañas, en este orden** (de izquierda a derecha):
   - `http://localhost:4200` — landing
   - `http://localhost:4200/demo/rag` — Demo 01
   - `http://localhost:4200/demo/comparator` — Demo 02
   - `http://localhost:4200/demo/agent` — Demo 04
   - `http://localhost:4200/demo/corpus` — Demo 03
4. **Zoom del navegador al 110–125%.** En proyector el default es chico.
5. **Silenciá notificaciones** del sistema. Slack, mail, calendarios.
   Una notificación en el medio de un stream rompe el momento.

### Si el último ensayo dejó la DB sucia

```bash
docker compose down -v
npm run demo:start
```

Te da una base nueva, con migraciones aplicadas, seed académico y los
6 documentos sample re-ingestados. Tarda ~90s la primera vez (el seed
de demos re-indexa con embeddings reales).

---

## 1) El pitch en una frase

Antes de mostrar nada, Edguitar abre con esta idea:

> Lo que van a ver corre **en el hardware que ustedes ya tienen o están
> evaluando comprar**. Mismos modelos que ChatGPT o Copilot, misma
> calidad de respuesta — pero los documentos, las consultas y los
> embeddings nunca salen de su data center.

Esa es **toda** la diferencia comercial. El resto de los 30 minutos es
demostrar que la promesa es real.

---

## 2) Estructura de los 30-35 minutos

| #   | Bloque                                   | Tiempo  | Quién habla      |
| --- | ---------------------------------------- | ------- | ---------------- |
| 1   | Apertura + pitch                         | 3 min   | Edguitar         |
| 2   | Demo 01 — Chat con documentos            | 7 min   | Jorge            |
| 3   | Demo 02 — Comparador de contratos        | 5 min   | Jorge            |
| 4   | Demo 04 — Agente con datos académicos    | 6 min   | Jorge            |
| 5   | Demo 03 — Analizador de corpus académico | 2-5 min | Jorge            |
| 6   | Preguntas duras + Q&A                    | 5 min   | Edguitar + Jorge |
| 7   | Cierre + próximos pasos                  | 2 min   | Edguitar         |

> **Sobre el Demo 03:** dura **2 min** si el cliente no es target
> directo (le mostramos el panorama y avanzamos) o **5 min** completos
> si es target (universidad con investigación, RRHH con corpus de CVs,
> etc.). Detalle del flujo largo en §7.

> Si el cliente engancha en una pregunta, **corta el demo que sigue**,
> no atravieses las preguntas. Una conversación de 10 minutos sobre
> seguridad de datos vale más que mostrar los 4 demos.

---

## 3) Bloque 1 — Apertura (3 min)

Edguitar presenta a Jorge, contextualiza Nutanix Enterprise AI (NAI) y
dice el pitch de la sección 1. Tres puntos que **tienen que quedar
plantados** antes de pasar a Jorge:

1. **Hardware NAI on-premise.** Servidor físico en el campus / data
   center del cliente. No es nube.
2. **Modelos open-source de calidad enterprise.** Llama 3.1, Mistral,
   etc. — vía NVIDIA NIM, gestionados por NAI.
3. **Lo que sigue se programó contra Anthropic (Claude) durante
   desarrollo, pero el mismo código apunta a NAI cambiando una variable
   de entorno.** Esto es importante decirlo al inicio para que después
   nadie piense "ah, está usando ChatGPT en el fondo".

Jorge toma el control de la pantalla.

---

## 4) Bloque 2 — Demo 01: Chat con documentos (7 min)

**URL:** `/demo/rag`

**Quién aplica:** universidades (reglamentos, manuales), RRHH (políticas),
áreas legales (contratos, normativa).

**Setup que ya está listo en pantalla:** 3 documentos indexados —
"Reglamento académico 2025", "Manual de matrículas — Vicerrectorado",
"Política de propiedad intelectual". Los ven en el panel derecho.

### Flujo paso a paso

| #   | Acción                                                                  | Qué decir mientras pasa                                                                                                                                                                |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Señalá el panel derecho con los 3 documentos                            | "Esto es lo que la institución cargó: el reglamento, el manual de matrículas, una política. Pueden ser cientos de docs — para la demo dejamos tres."                                   |
| 2   | Clickeá la pill **"¿Cuál es el horario de matrícula?"**                 | "Esto es como Ctrl+F pero por significado, no por palabra exacta. El sistema busca los fragmentos relevantes en los documentos, los pasa al modelo, y el modelo responde citando."     |
| 3   | Esperá el streaming                                                     | "Lo que ven ahora — el texto apareciendo — es el modelo generando token por token. No es animación; es la respuesta real, en tiempo real. Igual que ChatGPT, pero esto corre on-prem." |
| 4   | Cuando termina, scrolleá a las **fuentes** (sección bajo la respuesta)  | "Acá ven cada fragmento que se usó para componer la respuesta, con el nombre del documento original y la posición. Auditable: cualquier persona puede ir al PDF original a verificar." |
| 5   | (Opcional) clickeá la pill **"¿Qué dice sobre propiedad intelectual?"** | "Ahora hace lo mismo contra otro documento. No necesité decirle 'busca en propiedad intelectual' — entiende la intención por el contenido de la pregunta."                             |

### Las 3 preguntas pre-cargadas

| Pregunta                               | Qué destacar de la respuesta                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| ¿Cuál es el horario de matrícula?      | Cita literal del manual + el rango de fechas. Mostrá las fuentes.                           |
| ¿Cómo se solicita una recalificación?  | Proceso paso a paso reconstruido a partir del reglamento. Notá que **sintetiza**, no copia. |
| ¿Qué dice sobre propiedad intelectual? | Resume la política en lenguaje accesible. Útil para pregunta a personal no-jurídico.        |

### Cómo cerrar este bloque

> "Lo importante acá no es que responda — eso lo hace cualquier
> chatbot. Lo importante es que **responde sobre los documentos que
> ustedes le dieron**, citando dónde lo leyó, sin que nada de eso
> salga del campus."

---

## 5) Bloque 3 — Demo 02: Comparador de contratos (5 min)

**URL:** `/demo/comparator`

**Quién aplica:** legal, compras, auditoría, secretaría general.

**Setup que ya está listo:** 3 contratos cargados — dos ofertas de
construcción de un aulario (proveedor A vs. proveedor B) y un contrato
de mantenimiento (proveedor C). Los dos primeros son comparables; el
tercero es ruido intencional para mostrar que el operador elige.

### Flujo paso a paso

| #   | Acción                                                                         | Qué decir                                                                                                                                   |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Señalá los 3 contratos disponibles                                             | "Tres contratos. Vamos a comparar los dos primeros — son las ofertas competidoras de un mismo proyecto."                                    |
| 2   | Selecciona **Contrato A** y **Contrato B** (checkboxes)                        | (silencio mientras seleccionas)                                                                                                             |
| 3   | Mostrá las **dimensiones** ya cargadas: "Plazos de entrega" + "Penalizaciones" | "Las dimensiones de comparación son configurables — el equipo legal define qué le importa contrastar. Hoy dejamos plazos y penalizaciones." |
| 4   | (Opcional) sumá una tercera dimensión: **"Forma de pago"**                     | "Puedo sumar dimensiones en el momento. El cliente las define con sus criterios."                                                           |
| 5   | Clickeá **Comparar**                                                           | "Va a leer los dos contratos, extraer lo que dice cada uno por dimensión, y armar la tabla."                                                |
| 6   | Mientras streama                                                               | "Otra vez, streaming en vivo. La salida es markdown estructurado — el legal lo puede pegar en Word o exportar."                             |
| 7   | Cuando termina                                                                 | Scrolleá la tabla comparativa. Marcá una diferencia concreta (plazo o penalización).                                                        |

### Dimensiones disponibles en la UI

Por si el cliente pregunta qué se puede comparar:

- Plazos de entrega
- Penalizaciones
- Responsabilidades
- Forma de pago
- Garantías
- Causales de rescisión

Son sugeridas — el usuario puede escribir cualquier dimensión custom.

### Cómo cerrar este bloque

> "Un análisis que un abogado junior tarda 2 horas, acá lo tienen en
> 30 segundos. **No reemplaza al abogado** — le da el primer borrador
> para que decida qué profundizar."

---

## 6) Bloque 4 — Demo 04: Agente con datos académicos (6 min)

**URL:** `/demo/agent`

**Quién aplica:** CIO, rectorado, dirección académica, planeamiento.

**Setup que ya está listo:** base académica mock con **50 estudiantes,
10 cursos, ~1.700 calificaciones** distribuidas en 2 semestres. Es la
miniatura de un sistema académico real.

### El concepto que hay que sembrar primero

> "Hasta acá vieron documentos no estructurados — PDFs, Word. Ahora
> vamos al otro extremo: datos estructurados en una base de datos.
> Misma idea de 'pregunta en lenguaje natural', pero el sistema en
> lugar de buscar texto, **genera una consulta SQL, la corre contra la
> base, y te explica el resultado**."

### Flujo paso a paso

| #   | Acción                                                                               | Qué decir                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Mostrá el panel izquierdo con las preguntas sugeridas                                | "Pre-cargué 6 preguntas típicas. Funcionan todas — para la demo voy con 3."                                                                                                         |
| 2   | Clickeá **"¿Cuántos estudiantes hay en total?"** (la más simple)                     | "Empezamos por la fácil — para que entiendan el ciclo completo."                                                                                                                    |
| 3   | Mostrá el panel central                                                              | "Acá ven los pasos: 1) el modelo recibe la pregunta, 2) genera el SQL, 3) el SQL se valida (solo SELECT, sin escrituras), 4) se ejecuta, 5) el modelo arma la respuesta natural."   |
| 4   | Apuntá al **SQL generado** (visible en el log de pasos)                              | "Esto es el SQL real que se ejecutó. Auditable, revisable. Si el equipo de IT quiere ver qué hace el agente, está acá. Nada de cajas negras."                                       |
| 5   | Clickeá **"¿Cuántos estudiantes reprobaron Cálculo II en 2025-1?"**                  | "Ahora algo concreto: una pregunta operativa del día a día. El modelo entiende 'Cálculo II', '2025-1', y arma el SQL apropiado."                                                    |
| 6   | Clickeá **"¿Hay materias donde la mayoría aprobó parciales pero reprobó el final?"** | "Esta es la que muestra el valor. Es una pregunta que un decano hace en una reunión, y normalmente requiere que alguien escriba SQL a mano. Acá la respuesta llega en 10 segundos." |

### Cuidados al presentar

- **Mencioná el guard explícitamente.** El cliente va a preguntar por
  seguridad — anticipá: _"El agente solo puede generar SELECT. UPDATE,
  DELETE, DROP, INSERT — todo bloqueado en el validador antes de
  ejecutar."_
- **No prometás SQL ilimitado.** Si el cliente pregunta "¿puede hacer
  cualquier query?" la respuesta es: _"Puede leer cualquier tabla que
  ustedes le expongan; nada más."_
- **Si una pregunta falla en vivo**, no entres en pánico. Decí: _"El
  modelo a veces necesita ajuste fino con el esquema real del cliente
  — esto es exactamente lo que afinamos en la implementación."_

### Cómo cerrar este bloque

> "Cualquier persona del equipo directivo, sin saber SQL, puede
> preguntarle a la base académica como si le preguntara a un analista.
> Y queda el log de cada consulta, para auditoría."

---

## 7) Bloque 5 — Demo 03: Analizador de corpus académico (5 min)

**URL:** `/demo/corpus`

**Quién aplica:** universidades con investigación (vicerrectorado,
posgrado), centros de investigación independientes, cualquier área que
maneje colecciones de papers o tesis.

**Setup que tiene que estar listo en pantalla:** entre 12 y 30 papers
ecuatorianos pre-cargados (de SciELO, repositorio UCE, ESPOL, EPN o
medRxiv). Cargarlos antes de la reunión — el upload procesa secuencial
y tarda ~1-2 min por paper porque el LLM extrae título, año, autores y
tópicos de cada uno. Cómo cargar: ver §3 del [runbook de
deploy](./runbook-deploy.md) o usá la lista curada del último PR del
sprint Demo 03.

### El concepto que hay que sembrar primero

> "Lo que vieron hasta acá son demos sobre uno o dos documentos. Ahora
> vamos a escalar: ¿qué hago cuando tengo cientos de tesis o papers y
> quiero entender qué está investigando mi institución? Este demo
> ataca eso: cargo el corpus, el sistema extrae metadata, agrega
> estadísticas y redacta un panorama del estado del arte."

### Flujo paso a paso

| #   | Acción                                                                                                          | Qué decir mientras pasa                                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Señalá las cards arriba: total de papers, gráfico de papers por año, tópicos dominantes                         | "Estos números salen del corpus que ya cargamos. El gráfico de la izquierda muestra cuántos papers tenemos por año — sirve para ver cobertura temporal. La lista de la derecha son los tópicos que el sistema extrajo de cada paper, agregados por frecuencia."           |
| 2   | Scrolleá a la lista de papers y mostrá un par de entradas con título, año, autor y chips de tópicos             | "Cada paper trae su metadata extraída automáticamente — el sistema lee el PDF, identifica título, año, autores y propone 3-5 tópicos. Sin etiquetado manual."                                                                                                             |
| 3   | Volvé arriba y clickeá la pill **"¿Qué temas emergen en los últimos años?"** en el cuadro de búsqueda semántica | "Esta es la búsqueda semántica del corpus. Misma idea que el Demo 01, pero ahora el sistema busca a través de todo lo que cargamos, no en un solo documento."                                                                                                             |
| 4   | Esperá el streaming de la respuesta — el LLM cita pasajes concretos de varios papers                            | "Notar que cita pasajes concretos de varios papers diferentes — el sistema encontró fragmentos relevantes en distintas tesis y los integra en una sola respuesta sintética."                                                                                              |
| 5   | Bajá al panel **"Resumen ejecutivo del corpus"** y clickeá **Generar resumen**                                  | "Esta es la pieza más interesante para gestión académica. El sistema va a hacer un map-reduce: primero resume cada paper individualmente, después con todos los resúmenes en mano redacta un panorama de 2-3 párrafos del estado del arte. Tarda ~30-60s la primera vez." |
| 6   | Mientras se genera, cuenta qué está pasando server-side; cuando aparece el resumen, léelo en voz alta           | "Esto es lo que un decano de investigación tarda días en armar a mano. Acá lo tienen en un minuto, con la posibilidad de regenerarlo cuando se cargan papers nuevos."                                                                                                     |

### Preguntas pre-cargadas que funcionan bien

| Pregunta                                  | Por qué destacar                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| ¿Qué métodos de evaluación predominan?    | Muestra que el sistema sintetiza información dispersa en metodología                   |
| ¿Qué temas emergen en los últimos años?   | Cruza la metadata de año con el contenido — útil para detectar tendencias              |
| ¿Hay tesis sobre inteligencia artificial? | Caso típico de "búsqueda por significado" — no requiere que el paper diga literal "IA" |

### Cuidados al presentar

- **Si el cliente pregunta "¿hasta cuántos papers soporta?"**, sé
  honesto: _"Esta versión está pensada para corpus de 50-100 papers.
  Para volúmenes mayores (1000+) la arquitectura migra a procesamiento
  paralelo con Python — está en el roadmap junto con el hardware NAI
  on-premise."_ Eso conecta con la conversación de NAI sin prometer
  algo que no entrega.
- **Si pide ver un upload en vivo**, puedes hacerlo (botón "Subir
  papers" arriba a la derecha) pero advierte que cada paper tarda
  ~10s en indexarse + extraer metadata. Mejor cargar 1 o 2 en vivo
  para mostrar el flujo y volver al panorama.
- **Si pregunta por seguridad de los papers**, misma respuesta que
  Demo 01: los PDFs nunca salen del data center; los embeddings se
  guardan en pgvector dentro del mismo Postgres.

### Cómo cerrar este bloque

> "El comparador y el chat fueron sobre uno o dos documentos. Este
> demo eleva esa misma lógica al nivel de una colección entera. Para
> una universidad que evalúa producción académica, o para un área de
> RRHH que tiene que entender una pila de CVs, el patrón es el mismo:
> ingest masivo, metadata automática, búsqueda semántica, panorama
> agregado."

> **Por qué este demo entró antes de Python:** el [ADR-0011](./adr/0011-demo-03-waits-for-python.md)
> documenta el cambio de plan. La migración a Python ocurre cuando
> llegue el hardware NAI; mientras tanto, esta versión TS+LLM da
> resultados aceptables para corpus de 50-100 papers.

---

## 8) Bloque 6 — Preguntas duras y cómo responderlas

Estas son las preguntas que **siempre** aparecen. Respuestas honestas,
sin inventar capacidades que no tenemos.

### "¿Cómo se compara esto con ChatGPT / Copilot / Gemini?"

> El **modelo** es comparable — son los mismos modelos open-source que
> usan productos enterprise (Llama, Mistral). La **diferencia** está
> en dónde corre y quién ve los datos: ChatGPT manda todo a OpenAI;
> esto corre en su hardware, los datos no salen. Para casos donde la
> información es sensible (reglamentos internos, contratos, datos de
> estudiantes), la diferencia no es de funcionalidad, es de
> **gobernanza**.

### "¿Mis documentos salen del campus?"

> No. El stack completo —base de datos, embeddings, modelo de
> lenguaje— corre en el servidor NAI dentro de su red. Hoy, durante
> desarrollo, usamos la API de Anthropic como mock para construir y
> probar la lógica; cuando despleguemos en su NAI, esa pieza se
> reemplaza con una sola variable de entorno y los datos quedan
> íntegramente on-premise.

### "¿Tengo que entrenar el modelo con mis datos?"

> No. La técnica que usamos se llama **RAG** —Retrieval Augmented
> Generation—. En lugar de re-entrenar el modelo, le damos los
> documentos relevantes en el momento de cada pregunta. Ventaja:
> agregar o quitar documentos es cuestión de minutos, no de semanas
> de re-entrenamiento. Y nunca hay riesgo de "olvidos" del modelo
> sobre documentos sensibles.

### "¿Y si la respuesta está mal?"

> Por eso siempre mostramos las fuentes. En el Demo 01, abajo de cada
> respuesta están los fragmentos exactos del documento original con el
> nombre y la posición. Si la respuesta es ambigua o el operador tiene
> dudas, va al PDF original y verifica. **El sistema no se posiciona
> como autoridad final** — es un acelerador de búsqueda y síntesis.

### "¿Cuánto cuesta operarlo después?"

> El costo es del hardware NAI (que ya forma parte de la conversación
> con Nutanix) y de un equipo pequeño de mantenimiento de la
> aplicación. **No hay costo por consulta** —a diferencia de ChatGPT
> Enterprise o Copilot, que cobran por usuario o por token. Una
> universidad con 5.000 alumnos usando esto todo el día cuesta lo
> mismo que con 50 alumnos.

### "¿En cuánto tiempo se implementa para nosotros?"

> Depende del alcance, pero para llevar lo que vieron hoy a su data
> center con sus documentos reales: **4 a 8 semanas**, incluyendo
> integración con sus sistemas (LMS, sistema académico, repositorio
> documental). El primer demo funcional con sus datos reales: **2
> semanas** desde que tenemos acceso al NAI.

### "¿Cuántos usuarios soporta?"

> El hardware NAI determina el techo de consultas concurrentes —
> Nutanix tiene benchmarks específicos. La aplicación en sí está
> diseñada para escalar horizontalmente (más instancias del backend),
> no es un cuello de botella. Para dimensionar exacto necesitamos
> entender su perfil de uso.

### "¿Funciona en español? ¿Y en inglés?"

> Sí a ambos. Los modelos open-source actuales (Llama 3, Mistral) son
> multilingües de buena calidad. La UI está en español por default
> con toggle a inglés. Documentos en cualquiera de los dos idiomas se
> indexan igual y se pueden mezclar — la pregunta puede ser en español
> sobre un PDF en inglés, y al revés.

### "¿Y si quiero conectarlo a [sistema interno]?"

> El backend expone una API REST estándar (vean Swagger en
> `localhost:3000/api/docs`). Cualquier sistema con SSO, API de
> consulta, o webhook puede integrarse. Las integraciones típicas
> —SIS académico, repositorio documental, Microsoft 365— son las que
> hacemos en la fase de implementación.

### "¿Esto reemplaza personal?"

> **No.** Acelera tareas repetitivas de búsqueda y síntesis. El
> abogado, el secretario académico, el analista — siguen ahí, pero
> dejan de gastar 80% del tiempo en "buscar dónde dice algo" y pueden
> dedicarse al 20% donde aportan criterio. Los clientes que vimos
> capturan ese 80% como **capacidad nueva**, no como reducción.

---

## 9) Bloque 7 — Cierre y próximos pasos (2 min)

Edguitar retoma. Tres cosas:

1. **Recap visual.** Sin volver a las pantallas, recordar los 3 demos
   en una línea cada uno: _"Vieron chat con documentos, comparación de
   contratos, y consultas en lenguaje natural a una base de datos —
   todo sobre el mismo stack, todo corriendo en NAI on-prem."_
2. **Próximo paso técnico concreto.** Una de tres opciones, según el
   nivel de interés:
   - _"Les dejamos acceso a una instancia de prueba con sus propios
     documentos por dos semanas."_ (compromiso alto)
   - _"Agendamos una sesión técnica con su equipo de IT para revisar
     la arquitectura y los requerimientos de NAI."_ (compromiso medio)
   - _"Les mandamos un one-pager con la arquitectura y casos de uso
     para que evalúen internamente."_ (compromiso bajo, solo para
     enfriar leads cualificados que no van a cerrar en esta reunión)
3. **Quién hace qué.** Edguitar queda como punto único de contacto
   comercial. Jorge entra cuando hay sesión técnica.

---

## 10) Apéndices

### A) Si algo se rompe en vivo

| Síntoma                                               | Qué hacer                                                                                                                                                                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El chat queda en "streaming" para siempre             | API keys probablemente vencidas. **No intentes resolver en vivo.** Decí: _"Tenemos un problema de conectividad puntual con el proveedor de modelo de desarrollo — déjame mostrarles el siguiente demo y volvemos."_ Pasá al siguiente. |
| El frontend muestra "Failed to fetch"                 | El backend se cayó. Igual que arriba — pasá al siguiente. Después de la reunión: `tail -n 50 /tmp/demo-api.log`.                                                                                                                       |
| Una pregunta sugerida devuelve respuesta vacía o rara | _"Esto se afina con los documentos reales del cliente — usamos contenido de prueba para la demo."_ Pasá a la siguiente pregunta.                                                                                                       |
| El comparator devuelve markdown sin formato           | El frontend no terminó de renderizar — esperá 2s más. Si no, refrescá la página (`Cmd+R`). Tenés que retomar la selección de contratos.                                                                                                |
| El sistema entero está lento                          | Probablemente otro proceso está saturando el M1. Cerrá apps innecesarias y refrescá. **Nunca** intentes reiniciar el stack en vivo — son 60 segundos de pantalla en blanco.                                                            |

### B) Cheatsheet de comandos

```bash
# Arrancar todo (T-30 min antes de la reunión)
npm run demo:start

# Reset total (si algo quedó raro del último ensayo)
docker compose down -v && npm run demo:start

# Ver logs sin distraer la pantalla principal
tail -f /tmp/demo-api.log
tail -f /tmp/demo-web.log

# Cortar todo después de la reunión
# (Ctrl+C en la terminal donde corre demo:start)
docker compose down   # apaga también la DB
```

### C) Lo que este guion NO cubre

Si el cliente pregunta por estos temas, **no improvises** — di
"déjame agendar una sesión técnica específica":

- Integración SSO / Active Directory / SAML
- Compliance específica (HIPAA, FERPA, ISO 27001)
- Costos finales de licenciamiento NAI
- Roadmap de modelos específicos (qué Llama, qué versión, etc.)
- SLAs de soporte post-implementación
- Comparativa técnica detallada vs. Microsoft Fabric, AWS Bedrock,
  Vertex AI

Cada una de esas conversaciones merece su propia reunión con quien
corresponda.

---

## Referencias rápidas

- Cómo arrancar el stack: [`runbook-local.md`](./runbook-local.md)
- Por qué pgvector y no Pinecone: [`adr/0005-pgvector-over-dedicated-vector-db.md`](./adr/0005-pgvector-over-dedicated-vector-db.md)
- Por qué NestJS y no Express: [`adr/0002-nestjs-for-the-backend.md`](./adr/0002-nestjs-for-the-backend.md)
- Por qué hoy es TypeScript y mañana Python: [`adr/0003-typescript-first-python-later.md`](./adr/0003-typescript-first-python-later.md)
- Por qué Demo 03 está en TS antes que Python: [`adr/0011-demo-03-waits-for-python.md`](./adr/0011-demo-03-waits-for-python.md)
- Glosario (RAG, embeddings, chunking): [`glossary.md`](./glossary.md)
