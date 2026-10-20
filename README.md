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

## Tests

Run `npm test` with Node.js 22 or later.
