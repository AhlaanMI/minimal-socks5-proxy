# Reflection

During this project I had to learn the SOCKS5 protocol from scratch, digging into RFCs and packet flows to understand how the handshake, authentication, and tunneling actually work. I also got more comfortable with Node’s net module, since working directly with raw TCP sockets and buffers is very different from building typical web servers.

Debugging was mostly about logging each step of the connection and testing with curl --socks5-hostname, which made it easy to catch issues like wrong credentials or parsing mistakes. Dumping raw buffers and tracking the state machine helped me spot problems quickly and ensure connections closed cleanly.

With more time, I’d add things like timeouts, better logging, and support for more of the SOCKS5 features (e.g., UDP associate, BIND). I’d also want to add unit tests around the parser and state logic to make the code more robust.
