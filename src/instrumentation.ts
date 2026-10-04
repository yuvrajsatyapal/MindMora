/** Framework entry point: keep Node-only clients out of Edge and browser bundles. */
export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerStartupHealth } = await import("./server/startup/health");
    try {
      await registerStartupHealth();
    } catch {
      // Next 16 can retain its listening process after an instrumentation rejection.
      // Startup already logged fixed safe results; terminate rather than serve unhealthy.
      if (process.env.NODE_ENV === "production") process.exit(1);
      throw new Error("Startup health registration failed.");
    }
  }
}
