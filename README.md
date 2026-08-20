# 🍈 MelonRPC

Open-source Solana RPC infrastructure.

**Live:** [melonrpc.click](https://melonrpc.click)

## What is MelonRPC?

MelonRPC is a fast, reliable Solana JSON-RPC endpoint with:

- **<50ms latency** — Global edge routing
- **99.9% uptime** — Automatic failover
- **WebSocket support** — Real-time subscriptions
- **Rate protection** — Per-IP rate limiting
- **Method allowlist** — Only standard read methods + sendTransaction
- **Drop-in compatible** — Works with web3.js, Anchor, solana-py, and every major SDK

## Quick Start

```javascript
import { Connection } from '@solana/web3.js'

const connection = new Connection('https://melonrpc.click', {
  wsEndpoint: 'wss://melonrpc.click',
  commitment: 'confirmed'
})

const slot = await connection.getSlot()
console.log('slot:', slot)
```

```bash
curl https://melonrpc.click -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSlot"}'
```

## Pages

| URL | Description |
|-----|-------------|
| [melonrpc.click](https://melonrpc.click) | Landing page |
| [melonrpc.click/documentation](https://melonrpc.click/documentation) | API docs |
| [melonrpc.click/playground](https://melonrpc.click/playground) | Live playground |

## Tech Stack

- **Runtime:** Edge Workers
- **Rate Limiting:** KV Store
- **Frontend:** Static HTML/CSS/JS + Next.js landing page
- **RPC:** Standard Solana JSON-RPC with method allowlist

## Self-Hosting

1. Clone this repo
2. Install dependencies: `npm install`
3. Set up your rate limiting store
4. Set your RPC provider endpoint and key as environment secrets
5. Deploy to your preferred edge platform

## Project Structure

```
├── public/              # Static assets (landing, docs, playground)
│   ├── index.html       # Landing page
│   ├── documentation.html
│   ├── playground.html
│   └── _next/           # Landing page JS/CSS chunks
├── src/
│   └── index.ts         # Cloudflare Worker (RPC proxy + static serving)
├── wrangler.toml        # Worker configuration
└── package.json
```

## Supported Methods

All standard Solana JSON-RPC read methods plus `sendTransaction`. See the full list in the [documentation](https://melonrpc.click/documentation).

## Contributing

Contributions welcome! Open an issue or PR.

## Links

- **Website:** [melonrpc.click](https://melonrpc.click)
- **X/Twitter:** [@MelonRpc](https://x.com/MelonRpc)

## License

MIT
