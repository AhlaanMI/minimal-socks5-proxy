// Minimal SOCKS5 implementation (subset) supporting:
// - Greeting with method selection (NO AUTH not allowed, only USERNAME/PASSWORD 0x02)
// - Username/password authentication (RFC 1929)
// - CONNECT command (0x01) with IPv4, Domain, IPv6 address types
// - Basic tunneling piping between client and target
// Does not implement: BIND, UDP ASSOCIATE, advanced error codes beyond basic, timeouts config.

import net from "net";

const SOCKS_VERSION = 0x05;
const METHOD_NO_ACCEPTABLE = 0xff;
const METHOD_USERPASS = 0x02; // Username/Password

// Auth (RFC 1929)
const AUTH_VERSION = 0x01;

// Reply field values (subset)
const REP_SUCCEEDED = 0x00;
const REP_GENERAL_FAILURE = 0x01;
const REP_CONN_NOT_ALLOWED = 0x02;
const REP_NETWORK_UNREACHABLE = 0x03;
const REP_HOST_UNREACHABLE = 0x04;
const REP_CONN_REFUSED = 0x05;
const REP_TTL_EXPIRED = 0x06;
const REP_CMD_NOT_SUPPORTED = 0x07;
const REP_ADDR_TYPE_NOT_SUPPORTED = 0x08;

const CMD_CONNECT = 0x01;

const ATYP_IPV4 = 0x01;
const ATYP_DOMAIN = 0x03;
const ATYP_IPV6 = 0x04;

function writeMethodSelection(socket, method) {
  socket.write(Buffer.from([SOCKS_VERSION, method]));
}

function writeAuthStatus(socket, status) {
  socket.write(Buffer.from([AUTH_VERSION, status]));
}

function buildReply(rep, boundHost = "0.0.0.0", boundPort = 0) {
  // We return IPv4 0.0.0.0 unless we have a better value.
  const addr = boundHost;
  let atyp;
  let addrBytes;
  if (net.isIP(addr) === 4) {
    atyp = ATYP_IPV4;
    addrBytes = Buffer.from(addr.split(".").map((x) => parseInt(x, 10)));
  } else if (net.isIP(addr) === 6) {
    atyp = ATYP_IPV6;
    addrBytes = Buffer.from(
      addr.split(":").flatMap((h) => {
        const v = parseInt(h || "0", 16);
        return [v >> 8, v & 0xff];
      })
    );
    // Not robust for compressed zeros; we keep default 0s length 16 above; simplified here.
    if (addrBytes.length !== 16) addrBytes = Buffer.alloc(16, 0);
  } else {
    atyp = ATYP_IPV4;
    addrBytes = Buffer.from([0, 0, 0, 0]);
  }
  const portBuf = Buffer.alloc(2);
  portBuf.writeUInt16BE(boundPort, 0);
  return Buffer.concat([
    Buffer.from([SOCKS_VERSION, rep, 0x00, atyp]),
    addrBytes,
    portBuf,
  ]);
}

export class Socks5Connection {
  constructor(socket, creds, logger) {
    this.socket = socket;
    this.creds = creds; // {username,password}
    this.logger = logger;
    this.stage = "greeting";
    this.buffer = Buffer.alloc(0);
    this.remote = null;
    this.bytesUp = 0; // client->remote
    this.bytesDown = 0; // remote->client
    this.setup();
  }

  setup() {
    this.socket.on("data", (data) => this.onData(data));
    this.socket.on("error", (err) => {
      this.logger.warn("Client socket error", err.message);
      this.close();
    });
    this.socket.on("close", () => this.close());
  }

  onData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    switch (this.stage) {
      case "greeting":
        this.handleGreeting();
        break;
      case "auth":
        this.handleAuth();
        break;
      case "request":
        this.handleRequest();
        break;
      case "stream":
        // Data should be piped automatically; ignore.
        break;
    }
  }

  needBytes(n) {
    return this.buffer.length >= n;
  }
  consume(n) {
    const out = this.buffer.slice(0, n);
    this.buffer = this.buffer.slice(n);
    return out;
  }

  handleGreeting() {
    if (!this.needBytes(2)) return; // VER, NMETHODS
    const ver = this.buffer[0];
    const nmethods = this.buffer[1];
    if (ver !== SOCKS_VERSION) {
      this.logger.warn("Invalid version", ver);
      this.socket.end();
      return;
    }
    if (!this.needBytes(2 + nmethods)) return;
    const methods = this.buffer.slice(2, 2 + nmethods);
    this.consume(2 + nmethods);
    // We only support USERNAME/PASSWORD.
    if (![...methods].includes(METHOD_USERPASS)) {
      writeMethodSelection(this.socket, METHOD_NO_ACCEPTABLE);
      this.logger.info("No acceptable auth methods from client");
      this.socket.end();
      return;
    }
    writeMethodSelection(this.socket, METHOD_USERPASS);
    this.stage = "auth";
  }

  handleAuth() {
    // Structure per RFC 1929: VER | ULEN | UNAME | PLEN | PASSWD
    if (!this.needBytes(2)) return; // need VER + ULEN
    const ver = this.buffer[0];
    if (ver !== AUTH_VERSION) {
      this.logger.warn("Bad auth version", ver);
      this.socket.end();
      return;
    }
    const ulen = this.buffer[1];
    if (!this.needBytes(2 + ulen + 1)) return; // need username + PLEN
    const username = this.buffer.slice(2, 2 + ulen).toString("utf8");
    const plen = this.buffer[2 + ulen];
    if (!this.needBytes(2 + ulen + 1 + plen)) return; // need password bytes
    const password = this.buffer
      .slice(2 + ulen + 1, 2 + ulen + 1 + plen)
      .toString("utf8");
    this.consume(2 + ulen + 1 + plen);
    const ok =
      username === this.creds.username && password === this.creds.password;
    writeAuthStatus(this.socket, ok ? 0x00 : 0x01);
    if (!ok) {
      this.logger.info("Auth failed for user", username);
      this.socket.end();
      return;
    }
    this.logger.info("Auth success user", username);
    this.stage = "request";
  }

  handleRequest() {
    if (!this.needBytes(4)) return; // VER CMD RSV ATYP
    const ver = this.buffer[0];
    const cmd = this.buffer[1];
    const atyp = this.buffer[3];
    if (ver !== SOCKS_VERSION) {
      this.socket.end();
      return;
    }
    if (cmd !== CMD_CONNECT) {
      this.logger.info("Unsupported command", cmd);
      this.consume(this.buffer.length);
      this.socket.write(buildReply(REP_CMD_NOT_SUPPORTED));
      this.socket.end();
      return;
    }
    let addr;
    let port;
    let need;
    if (atyp === ATYP_IPV4) {
      need = 4 + 4 + 2; // header + ipv4 + port
      if (!this.needBytes(4 + 4 + 2)) return;
      addr = [...this.buffer.slice(4, 8)].join(".");
      port = this.buffer.readUInt16BE(8);
      this.consume(10);
    } else if (atyp === ATYP_DOMAIN) {
      if (!this.needBytes(5)) return; // need domain length
      const dlen = this.buffer[4];
      need = 4 + 1 + dlen + 2;
      if (!this.needBytes(need)) return;
      addr = this.buffer.slice(5, 5 + dlen).toString("utf8");
      port = this.buffer.readUInt16BE(5 + dlen);
      this.consume(4 + 1 + dlen + 2);
    } else if (atyp === ATYP_IPV6) {
      need = 4 + 16 + 2;
      if (!this.needBytes(4 + 16 + 2)) return;
      const b = this.buffer.slice(4, 20);
      const parts = [];
      for (let i = 0; i < 16; i += 2)
        parts.push(b.readUInt16BE(i).toString(16));
      addr = parts.join(":");
      port = this.buffer.readUInt16BE(20);
      this.consume(22);
    } else {
      this.logger.info("Address type not supported", atyp);
      this.socket.write(buildReply(REP_ADDR_TYPE_NOT_SUPPORTED));
      this.socket.end();
      return;
    }
    this.logger.info(`CONNECT ${addr}:${port}`);
    this.establishRemote(addr, port);
  }

  establishRemote(host, port) {
    const remote = net.createConnection({ host, port }, () => {
      this.logger.info("Connected to remote", host, port);
      this.socket.write(buildReply(REP_SUCCEEDED, host, port));
      this.stage = "stream";
      // Pipe
      this.socket.pipe(remote);
      remote.pipe(this.socket);
    });
    this.remote = remote;
    remote.on("data", (chunk) => {
      this.bytesDown += chunk.length;
    });
    this.socket.on("data", (chunk) => {
      if (this.stage === "stream") this.bytesUp += chunk.length;
    });
    const onClose = (src) => () => {
      this.logger.info("Tunnel closed", {
        host,
        port,
        up: this.bytesUp,
        down: this.bytesDown,
        src,
      });
      this.close();
    };
    remote.on("close", onClose("remote"));
    remote.on("error", (err) => {
      this.logger.warn("Remote error", err.code || err.message);
      if (this.stage !== "stream") {
        // Send failure reply if still in request.
        let rep = REP_GENERAL_FAILURE;
        if (err.code === "ENOTFOUND") rep = REP_HOST_UNREACHABLE;
        else if (err.code === "ECONNREFUSED") rep = REP_CONN_REFUSED;
        this.socket.write(buildReply(rep));
      }
      this.close();
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.remote) {
      this.remote.destroy();
    }
    this.socket.destroy();
  }
}
