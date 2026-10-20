import { Plugin } from "@opencode/plugin"
import { registerFallbackHooks } from "./src/register-fallback.js"

export default Plugin.define({
  id: "opencode.model-fallback",
  async setup(ctx) {
    await registerFallbackHooks(ctx, ctx.options)
  },
})
