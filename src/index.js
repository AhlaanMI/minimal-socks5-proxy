import net from "net";
import { loadConfig } from "./config.js";
import { Logger } from "./logger.js";
import { Socks5Connection } from "./socks5.js";

function main() {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  logger.info("Starting SOCKS5 proxy on port", config.port);
  const server = net.createServer((socket) => {
    const peer = socket.remoteAddress + ":" + socket.remotePort;
    logger.info("Incoming connection", peer);
    new Socks5Connection(
      socket,
      { username: config.username, password: config.password },
      logger
    ); // eslint-disable-line no-new
  });
  server.on("error", (err) => {
    logger.error("Server error", err);
  });
  server.listen(config.port, () => {
    logger.info("Listening", config.port);
  });
}

main();
