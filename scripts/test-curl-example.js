// Simple script that prints instructions to test via curl.
console.log(
  `Example test (requires curl built with SOCKS5 support):\n\n` +
    `   set PROXY_USER=user\n` +
    `   set PROXY_PASS=pass\n` +
    `   set PROXY_PORT=1080\n` +
    `   node src/index.js\n\n` +
    `In another terminal:\n\n` +
    `   curl -v --socks5-hostname %PROXY_USER%:%PROXY_PASS%@127.0.0.1:%PROXY_PORT% https://ipinfo.io/ip\n\n` +
    `You should see your public IP response forwarded through the proxy.`
);
