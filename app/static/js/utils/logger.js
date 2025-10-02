const LEVELS = ["debug", "info", "warn", "error"];
const activeLevel = LEVELS.indexOf(
  (window.localStorage.getItem("traffic-sim-log-level") || "warn").toLowerCase()
);

function shouldLog(level) {
  const idx = LEVELS.indexOf(level);
  return idx >= activeLevel;
}

export const logger = {
  debug: (...args) => shouldLog("debug") && console.debug("[traffic]", ...args),
  info: (...args) => shouldLog("info") && console.info("[traffic]", ...args),
  warn: (...args) => shouldLog("warn") && console.warn("[traffic]", ...args),
  error: (...args) => shouldLog("error") && console.error("[traffic]", ...args),
};
