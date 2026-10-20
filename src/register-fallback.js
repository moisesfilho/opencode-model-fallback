import {
  fallbackModelsFor,
  isFallbackEligible,
  nextFallback,
  parseModelReference,
} from "./fallback-policy.js"

export async function registerFallbackHooks(ctx, options) {
  const progress = new Map()

  await ctx.session.hook("retry", async (event) => {
    if (!isFallbackEligible(event.error)) {
      progress.delete(event.sessionID)
      return
    }

    const configured = fallbackModelsFor(options, event.agent)
    if (configured.length === 0) {
      progress.delete(event.sessionID)
      return
    }

    const state = progress.get(event.sessionID)
    const reference = state?.agent === event.agent
      ? configured[state.nextIndex]
      : nextFallback(configured, event.model)
    const fallback = parseModelReference(reference)

    if (!fallback) {
      if (state?.agent === event.agent) {
        event.decision = { retry: false }
        progress.delete(event.sessionID)
      }
      if (reference) console.warn(`[model-fallback] Invalid fallback model for agent '${event.agent}': ${reference}`)
      return
    }

    try {
      await ctx.session.switchModel({ sessionID: event.sessionID, model: fallback })
      progress.set(event.sessionID, {
        agent: event.agent,
        nextIndex: configured.indexOf(reference) + 1,
      })
      event.decision = { retry: true, delay: 0 }
      console.warn(
        `[model-fallback] Agent '${event.agent}': ${event.model.providerID}/${event.model.id} failed; retrying with ${reference}`,
      )
    } catch (error) {
      event.decision = { retry: false }
      console.warn(`[model-fallback] Could not switch to ${reference}: ${error instanceof Error ? error.message : error}`)
    }
  })

  await ctx.session.hook("http.response", (event) => {
    if (event.response.status >= 200 && event.response.status < 400) progress.delete(event.sessionID)
  })
}
