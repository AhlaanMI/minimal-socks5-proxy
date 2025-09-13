// Simple leveled logger with timestamps.
const LEVELS = ["error", "warn", "info", "debug", "trace"];

function ts() {
  return new Date().toISOString();
}

export class Logger {
  constructor(level = "info") {
    this.level = LEVELS.includes(level) ? level : "info";
  }
  should(level) {
    return LEVELS.indexOf(level) <= LEVELS.indexOf(this.level);
  }
  error(...args) {
    if (this.should("error")) console.error(ts(), "[ERROR]", ...args);
  }
  warn(...args) {
    if (this.should("warn")) console.warn(ts(), "[WARN ]", ...args);
  }
  info(...args) {
    if (this.should("info")) console.log(ts(), "[INFO ]", ...args);
  }
  debug(...args) {
    if (this.should("debug")) console.log(ts(), "[DEBUG]", ...args);
  }
  trace(...args) {
    if (this.should("trace")) console.log(ts(), "[TRACE]", ...args);
  }
}
