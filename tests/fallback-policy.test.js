import assert from "node:assert/strict"
import test from "node:test"
import {
  fallbackModelsFor,
  isFallbackEligible,
  nextFallback,
  parseModelReference,
} from "../src/fallback-policy.js"
import { registerFallbackHooks } from "../src/register-fallback.js"

test("fallback configuration is optional and agent-scoped", () => {
  assert.deepEqual(fallbackModelsFor({}, "coder"), [])
  assert.deepEqual(fallbackModelsFor({ fallback_models: { coder: [] } }, "coder"), [])
  assert.deepEqual(
    fallbackModelsFor({ fallback_models: { coder: [" openai/model-a ", "", 42, "malformed"] } }, "coder"),
    ["openai/model-a"],
  )
  assert.deepEqual(fallbackModelsFor({ fallback_models: { coder: ["openai/a"] } }, "reviewer"), [])
})

test("retry hook switches models in order for each agent and stops when exhausted", async () => {
  const hooks = new Map()
  const switched = []
  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)

  try {
    await registerFallbackHooks({
      session: {
        async hook(name, callback) { hooks.set(name, callback) },
        async switchModel(input) { switched.push(input) },
      },
    }, {
      fallback_models: {
        coder: ["openai/first", "ollama/second"],
        reviewer: ["opencode/review"],
      },
    })

    const failed = (agent, model, attempt) => ({
      sessionID: agent,
      agent,
      model,
      attempt,
      error: { status: 429, type: "provider.rate-limit", message: "quota" },
      decision: { retry: false },
    })

    const first = failed("coder", { providerID: "openai", id: "base" }, 1)
    await hooks.get("retry")(first)
    assert.deepEqual(first.decision, { retry: true, delay: 0 })

    const second = failed("coder", { providerID: "openai", id: "base" }, 2)
    await hooks.get("retry")(second)
    assert.deepEqual(second.decision, { retry: true, delay: 0 })

    const exhausted = failed("coder", { providerID: "openai", id: "base" }, 3)
    await hooks.get("retry")(exhausted)
    assert.deepEqual(exhausted.decision, { retry: false })

    const reviewer = failed("reviewer", { providerID: "openai", id: "base" }, 1)
    await hooks.get("retry")(reviewer)
    assert.deepEqual(reviewer.decision, { retry: true, delay: 0 })

    assert.deepEqual(switched.map(({ model }) => `${model.providerID}/${model.id}`), [
      "openai/first",
      "ollama/second",
      "opencode/review",
    ])
    assert.equal(warnings.length, 3)
  } finally {
    console.warn = originalWarn
  }
})

test("only availability, quota, and service failures are fallback candidates", () => {
  for (const status of [401, 402, 403, 404, 408, 410, 429, 500, 503]) {
    assert.equal(isFallbackEligible({ status }), true)
  }

  assert.equal(isFallbackEligible({ status: 400, message: "Invalid prompt" }), false)
  assert.equal(isFallbackEligible({ message: "Free tier can only be used within OpenCode" }), true)
  assert.equal(isFallbackEligible({ type: "provider.free-tier" }), true)
  assert.equal(isFallbackEligible({ message: "Model is unavailable" }), true)
  assert.equal(isFallbackEligible({ message: "Transport: socket connection was closed unexpectedly" }), true)
  assert.equal(isFallbackEligible({ type: "provider.rate-limit" }), true)
})

test("fallback advances in configured order based on the failed model", () => {
  const configured = ["openai/base", "opencode/first#high", "ollama/second"]
  assert.equal(nextFallback(configured, { providerID: "openai", id: "base" }), "opencode/first#high")
  assert.equal(nextFallback(configured, { providerID: "opencode", id: "first" }), "ollama/second")
  assert.equal(nextFallback(configured, { providerID: "ollama", id: "second" }), undefined)
})

test("model references validate provider/model and preserve optional variant", () => {
  assert.deepEqual(parseModelReference("openai/gpt#high"), {
    providerID: "openai",
    id: "gpt",
    variant: "high",
  })
  assert.deepEqual(parseModelReference("ollama/qwen"), { providerID: "ollama", id: "qwen" })
  assert.equal(parseModelReference("bad-reference"), undefined)
})
