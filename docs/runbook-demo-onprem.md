# Runbook — Multi-provider LLM por tenant (ADR-0022)

> Cómo levantar un servidor on-prem barato (Ubuntu + CPU + Ollama) y
> apuntar un tenant de la plataforma para que lo use. Demo en vivo:
> "mismo código, tres entornos" — Anthropic cloud / NAI Nutanix / Ubuntu
> del cliente.

## Audiencia

- **Jorge**, configurando el demo desde el admin panel.
- **Edguitar**, mostrando al cliente que el sistema corre on-prem en
  hardware barato del propio cliente mientras decide si compra Nutanix.

## Tres modos disponibles

| Provider         | Para qué                                  | Costo                |
| ---------------- | ----------------------------------------- | -------------------- |
| `anthropic`      | PoC rápido. Cero infra.                   | Per-token comercial. |
| `openai-compat`  | NAI Nutanix on-prem instalado.            | Sin costo variable.  |
| `private-mac`    | Dev del Mac M1 de Jorge con túnel.        | (interno)            |
| `private-onprem` | Ubuntu CPU del cliente con Ollama / vLLM. | $0 marginal.         |

El default (cuando el tenant no eligió nada) sigue siendo lo que diga
`CHAT_PROVIDER` del env del backend.

## 1. Levantar Ollama en un Ubuntu CPU

Esta guía asume Ubuntu 22.04 o 24.04 con `curl`, `systemd` y conexión a
internet para la instalación inicial. **No hace falta GPU** — los modelos
pequeños (3B-7B quantizados) corren razonable en CPU para una demo.

```bash
# 1. Instalar Ollama (instala el binario y registra el servicio systemd)
curl -fsSL https://ollama.com/install.sh | sh

# 2. Verificar que el servicio está corriendo
systemctl status ollama
#   Active: active (running)

# 3. Bajar un modelo chico para chat (~2GB)
ollama pull llama3.2:3b

# 4. Bajar un modelo de embeddings (opcional, solo si vas a usar RAG)
ollama pull nomic-embed-text

# 5. (Opcional pero recomendado para BI / Agente) Modelo SQL especializado.
#    text-to-SQL fine-tuned — mucho mejor que el general para esos demos.
#    Pesa ~5GB y corre razonable en CPU.
ollama pull mannix/defog-llama3-sqlcoder-8b

# 6. Smoke test desde el mismo Ubuntu
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:3b",
    "messages": [{"role": "user", "content": "Hola, ¿qué eres?"}],
    "stream": false
  }' | jq '.choices[0].message.content'
```

### Exponer el puerto

Por default, Ollama escucha solo en `localhost:11434`. Para que el
backend en Railway (o tu Mac) pueda alcanzarlo, hay dos opciones:

**A) Túnel reverso desde la Mac de Jorge (más simple, para demo):**

```bash
# Desde el Ubuntu, abrir túnel a un VPS público o a Cloudflare Tunnel.
# Si tienes cloudflared instalado:
cloudflared tunnel --url http://localhost:11434
#   → te da una URL pública https://<random>.trycloudflare.com
```

**B) Abrir el puerto en la LAN del cliente (producción):**

```bash
# Editar /etc/systemd/system/ollama.service.d/override.conf
sudo systemctl edit ollama
# Sumar:
#   [Service]
#   Environment="OLLAMA_HOST=0.0.0.0:11434"
sudo systemctl restart ollama
# Verificar desde otro equipo de la LAN:
curl http://<IP-del-ubuntu>:11434/api/tags
```

> ⚠ Si abres el puerto a la LAN, **suma autenticación** delante de
> Ollama. La forma simple: poner un nginx con `auth_basic` o un API
> gateway. Ollama no trae auth nativa — cualquiera que vea el puerto
> puede consultar los modelos.

## 2. Configurar el backend para usar `private-onprem`

### En desarrollo local (`.env` del repo)

```env
# Apuntar TODO el server al nuevo provider:
CHAT_PROVIDER=private-onprem
EMBEDDINGS_PROVIDER=private-onprem

# Endpoint del Ubuntu (con el túnel cloudflared o con la IP de LAN):
ONPREM_LLM_BASE_URL=https://<random>.trycloudflare.com
ONPREM_LLM_API_KEY=ollama-no-auth
ONPREM_LLM_MODEL=llama3.2:3b

# Si vas a indexar PDFs (RAG):
ONPREM_EMBEDDING_MODEL=nomic-embed-text

# (Opcional) Modelo SQL especializado para BI y Agente. Si esta var está
# seteada, el backend pre-genera el SQL con SQLCoder antes de invocar al
# LLM general. El general (llama/qwen) queda solo con elegir el chart y
# narrar — sus dos tareas más fáciles. Sin esta var, los demos siguen
# funcionando 100% contra `ONPREM_LLM_MODEL`.
ONPREM_LLM_SQL_MODEL=mannix/defog-llama3-sqlcoder-8b
```

Notas:

- `ONPREM_LLM_API_KEY` es un placeholder cuando Ollama corre sin auth.
  Si pusiste nginx por delante, va el API key real ahí.
- Reinicia `nx serve api` después de cambiar el `.env`.

### En producción (Railway)

Mismas variables, pero seteadas desde el dashboard de Railway:

1. Service backend → **Variables**.
2. Sumá `ONPREM_LLM_BASE_URL`, `ONPREM_LLM_API_KEY`, `ONPREM_LLM_MODEL`,
   `ONPREM_EMBEDDING_MODEL` y (opcional) `ONPREM_LLM_SQL_MODEL`.
3. Para usar el switch **por tenant** (sin tocar el `CHAT_PROVIDER`
   global), dejá `CHAT_PROVIDER=anthropic` como default y elegí
   `private-onprem` desde `/admin/tenant` para cada tenant que lo quiera.

## 3. Activar el provider para un tenant desde la UI

Una vez que las env vars estén configuradas:

1. Loguearse como `admin` o `superadmin` del tenant.
2. Ir a **/admin/tenant**.
3. En la sección **Proveedor de IA**, elegir el radio
   `Ubuntu on-prem (Ollama)`.
4. **Guardar cambios**.

El sidebar se refresca solo. El próximo request que mande la UI lleva el
header `X-LLM-Provider: private-onprem` automáticamente (lo persiste el
hook `useMyDemos` en localStorage al recargar `/me/demos`).

Para volver al default global, elegir **Default del sistema** y guardar
— el frontend manda `null` y el backend limpia el override.

## 4. Smoke test E2E

Con todo configurado:

```bash
# 1. Verificar que el tenant tiene el provider seteado:
curl -b cookies.txt http://localhost:3000/api/v1/me/demos | jq '.tenant.llmProvider'
#   → "private-onprem"

# 2. Hacer una pregunta a un demo que use el LLM (ej. RAG):
curl -b cookies.txt -H "X-LLM-Provider: private-onprem" \
  "http://localhost:3000/api/v1/chat?query=hola&demoId=rag&documentId=..."
#   → debería streamear tokens generados por Ollama en el Ubuntu.

# 3. Mirar los logs de Ollama en el Ubuntu para confirmar que entró:
sudo journalctl -u ollama -f | grep llama3.2
```

## 5. Troubleshooting

**El frontend sigue usando Anthropic aunque elegí `private-onprem`.**

- Hard refresh del browser (Cmd+Shift+R). El localStorage del tenant se
  actualiza al recargar `/me/demos` (lo dispara `useMyDemos`).
- Verificar en DevTools Network que las requests llevan el header
  `X-LLM-Provider: private-onprem`.

**Error `ONPREM_LLM_BASE_URL es obligatoria con CHAT_PROVIDER=private-onprem`.**

- Falta la env var en el backend. Si estás en local, revisar `.env` y
  reiniciar `nx serve api`. Si estás en Railway, agregarla en el panel
  **Variables**.

**Latencia altísima en producción.**

- CPU sin GPU + modelo grande = lento. Empezá con `llama3.2:3b`
  (quantizado) que da respuestas razonables en 5-15 segundos. Si pasás
  a 7B o más, agrega GPU o aceptá esos tiempos en la demo.

**El stream del chat queda colgado.**

- Ollama puede timeoutear si el primer request entra "frío" (carga el
  modelo a memoria). Da un primer call con `curl` después de cada
  reinicio para tirarlo "tibio".

**El demo BI o Agente devuelve SQL malo / inventa columnas.**

- Sumá `ONPREM_LLM_SQL_MODEL=mannix/defog-llama3-sqlcoder-8b` al `.env`
  (o a las vars de Railway) y bajá el modelo con `ollama pull
mannix/defog-llama3-sqlcoder-8b`. El backend lo va a usar para
  pre-generar el SQL y dejar al LLM general (llama/qwen) solo con elegir
  el chart y narrar.
- Si el Mac corre Ollama vía Docker Compose (gateway local), el `ollama
pull` hay que hacerlo dentro del contenedor:
  `docker compose exec ollama ollama pull mannix/defog-llama3-sqlcoder-8b`.
  En el Mac la env var equivalente es `PRIVATE_LLM_SQL_MODEL`.

## 6. Cuándo NO usar `private-onprem`

- Cliente quiere modelos grandes (70B+) y no tiene GPU. Mejor `nai`
  (Nutanix) o `anthropic`.
- Cliente quiere latencia <1s consistente. CPU no llega — ahí pasás a
  GPU on-prem (NAI) o cloud comercial.
- Pre-venta donde el cliente todavía no compró el hardware. Empezá con
  `anthropic` (PoC), y cuando firme, migrás.

---

**Referencias**

- ADR-0022 — Multi-provider LLM por tenant (`docs/adr/0022-demo-onprem-multi-provider.md`)
- ADR-0018 — Embeddings on-prem (modelo `nomic-embed-text`)
- Ollama docs — https://github.com/ollama/ollama
