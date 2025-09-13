# Minimal SOCKS5 Proxy (Node.js)

Subset implementation of SOCKS5 (RFC 1928) + username/password auth (RFC 1929). Supports CONNECT for IPv4, domain names, and IPv6. Built using only Node.js standard library (`net`).

## Features

- Username/password authentication (single credential pair via env vars)
- CONNECT command tunneling
- Address types: IPv4, Domain, IPv6
- Basic logging with bytes transferred

## Environment Variables

- `PROXY_PORT` (default: 1080)
- `PROXY_USER` (required)
- `PROXY_PASS` (required)
- `LOG_LEVEL` (default: info) one of error,warn,info,debug,trace

## Run

```powershell
set PROXY_USER=user
set PROXY_PASS=pass
set PROXY_PORT=1080
node src/index.js
```

## Test with curl

Requires curl compiled with SOCKS5 support.

```powershell
curl -v --socks5-hostname %PROXY_USER%:%PROXY_PASS%@127.0.0.1:%PROXY_PORT% https://ipinfo.io/ip
```

You should see an IP address in the response body.

## Example Output (logs)

```
2025-09-13T12:00:00.000Z [INFO ] Starting SOCKS5 proxy on port 1080
2025-09-13T12:00:01.234Z [INFO ] Incoming connection ::ffff:127.0.0.1:54321
2025-09-13T12:00:01.400Z [INFO ] Auth success user user
2025-09-13T12:00:01.500Z [INFO ] CONNECT ipinfo.io:443
2025-09-13T12:00:02.100Z [INFO ] Connected to remote ipinfo.io 443
2025-09-13T12:00:03.700Z [INFO ] Tunnel closed { host: 'ipinfo.io', port: 443, up: 517, down: 1243, src: 'remote' }
```

## Limitations

- No UDP ASSOCIATE / BIND
- No DNS caching
- Minimal error replies
- No configurable timeouts
- No concurrency limits

## Potential Improvements

- Add unit tests for parsing logic
- Add connection timeout & idle timeout
- Add rate limiting / max concurrent
- Add optional NO AUTH mode
- Proper IPv6 bind address in replies

## Reflection (see `REFLECTION.md`)
