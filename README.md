# OpenCode Model Fallback

An OpenCode v2 plugin that retries eligible provider failures with an ordered, per-agent fallback list. It handles quota, transport, missing-model responses, and provider availability failures after a model request is dispatched. OpenCode rejects an unrecognized configured model before the plugin retry hook runs, so configured model IDs must exist in the model catalog.

## Configuration

Add the local plugin to `~/.config/opencode/opencode.json`:

```jsonc
{
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-model-fallback",
      "options": {
        "fallback_models": {
          "coder": ["opencode/space-bunny-free", "ollama/qwen2.5-coder:3b"],
          "reviewer": ["openai/gpt-6-luna-fast"]
        }
      }
    }
  ]
}
```

OpenCode v2 validates agent objects strictly, so this plugin configuration maps fallback arrays by agent ID instead of adding unsupported fields inside agent definitions. Omitted or empty arrays disable fallback. IDs use `provider/model`, optionally followed by `#variant`.

The plugin considers quota/rate-limit, authentication/entitlement, missing-model, transport/network timeout, and server availability errors eligible. It does not fallback on ordinary invalid-request errors. When the list is exhausted, it stops retrying and leaves the original error visible.

## Verify a model switch

The plugin writes accepted fallback decisions and `switchModel` failures to the OpenCode process stderr with the `[model-fallback]` prefix. Look for messages such as:

```text
[model-fallback] Agent 'reviewer': opencode/model-a failed; retrying with opencode/model-b
[model-fallback] Could not switch to opencode/model-b: ...
```

The first message means the retry hook classified the error as eligible, switched the session model, and requested an immediate retry. It does not by itself prove that the retry succeeded. `Could not switch` means switching failed; when the list is exhausted, retry stops and the original error remains visible.

You can also inspect OpenCode's local message history in `~/.local/share/opencode/opencode.db`, table `session_message`, using a read-only connection. Filter `type = 'model-switched'` and compare `data.previous` with `data.model`; then inspect the following assistant message in the same session and agent to verify which model handled the retry. This Python example avoids printing conversation content:

```bash
python3 - <<'PY'
import json
import sqlite3

path = "file:/home/USER/.local/share/opencode/opencode.db?mode=ro"
db = sqlite3.connect(path, uri=True)
query = """
SELECT m.session_id, m.time_created, m.data, s.agent
FROM session_message AS m
JOIN session_v2 AS s ON s.id = m.session_id
WHERE m.type = 'model-switched'
ORDER BY m.time_created DESC
LIMIT 50
"""
for session_id, timestamp, raw, agent in db.execute(query):
    event = json.loads(raw)
    previous = event.get("previous", {})
    model = event.get("model", {})
    print(timestamp, session_id, agent,
          f"{previous.get('providerID')}/{previous.get('id')}", "->",
          f"{model.get('providerID')}/{model.get('id')}")
PY
```

Replace `USER` with the local username. A `model-switched` event proves that a switch occurred, but not who initiated it: it could be manual or from another plugin. Attribute it to this plugin by correlating it with a `[model-fallback]` record in process logs/stderr at the same time. To prove the retry request ran, confirm a later assistant message from the same session/agent using the target model. A change in the session's current model alone does not prove a request was retried.

If no event is present, that alone does not prove the plugin did not run: retention/OpenCode version and the source of the switch can limit available history. The plugin does not currently persist its own log; investigate missing `[model-fallback]` records alongside OpenCode process logs and session history.

## Tests

Run `npm test` with Node.js 22 or later.
