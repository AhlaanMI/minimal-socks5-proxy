// Configuration loader
// Reads environment variables and exposes a validated config object.

function getEnv(name, def) {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  return v;
}

export function loadConfig() {
  const portRaw = getEnv("PROXY_PORT", "1080");
  const port = parseInt(portRaw, 10);
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PROXY_PORT: ${portRaw}`);
  }
  const username = getEnv("PROXY_USER");
  const password = getEnv("PROXY_PASS");
  if (!username || !password) {
    throw new Error(
      "PROXY_USER and PROXY_PASS must be set for username/password auth"
    );
  }
  const logLevel = getEnv("LOG_LEVEL", "info").toLowerCase();
  return { port, username, password, logLevel };
}
