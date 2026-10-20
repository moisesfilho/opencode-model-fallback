const RETRYABLE_STATUSES = new Set([401, 402, 403, 404, 408, 410, 429])
const RETRYABLE_ERROR_TYPES = new Set([
  "provider.auth",
  "provider.rate-limit",
  "provider.unavailable",
  "provider.model-not-found",
  "provider.free-tier",
  "provider.insufficient-funds",
])
const RETRYABLE_MESSAGE = /quota|rate.?limit|too many requests|free.?tier|model.{0,20}(not found|unavailable|does not exist)|provider.{0,20}unavailable|insufficient account funds|temporarily unavailable|transport|socket|connection|network|timed? ?out|econnreset|econnrefused/i

export function fallbackModelsFor(options, agent) {
  const configured = options?.fallback_models?.[agent]
  if (!Array.isArray(configured)) return []

  return configured
    .filter((model) => typeof model === "string")
    .map((model) => model.trim())
    .filter((model) => /^[^/#]+\/[^#]+(?:#[^#]+)?$/.test(model))
}

export function isFallbackEligible(error) {
  if (!error || typeof error !== "object") return false
  if (RETRYABLE_STATUSES.has(error.status)) return true
  if (typeof error.status === "number" && error.status >= 500) return true
  if (RETRYABLE_ERROR_TYPES.has(error.type)) return true
  if (typeof error.type === "string" && /quota|rate.?limit|free.?tier|unavailable|not-found|no-funds/i.test(error.type)) return true

  return typeof error.message === "string" && RETRYABLE_MESSAGE.test(error.message)
}

export function nextFallback(models, currentModel) {
  const current = `${currentModel.providerID}/${currentModel.id}`
  const currentIndex = models.findIndex((model) => model.split("#", 1)[0] === current)
  return models[currentIndex + 1] ?? (currentIndex === -1 ? models[0] : undefined)
}

export function parseModelReference(reference) {
  if (typeof reference !== "string") return undefined

  const [model, variant] = reference.split("#", 2)
  const separator = model.indexOf("/")
  if (separator < 1 || separator === model.length - 1) return undefined

  return {
    providerID: model.slice(0, separator),
    id: model.slice(separator + 1),
    ...(variant ? { variant } : {}),
  }
}
