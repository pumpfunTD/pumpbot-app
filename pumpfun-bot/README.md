# 🤖 PumpFun Telegram Trading Bot

A full-featured Telegram bot for trading tokens on [Pump.fun](https://pump.fun) (Solana).

## Features

| Feature | Command |
|---|---|
| 🛒 Buy tokens | `/buy <mint> <sol_amount>` |
| 📤 Sell tokens | `/sell <mint> <percent>` |
| 💼 Check balance | `/balance` |
| 📌 Track tokens | `/track <mint>` |
| 🗑️ Untrack tokens | `/untrack <mint>` |
| 📋 View watchlist | `/watchlist` |
| 🎯 Auto-sniper | `/snipe <sol> [maxMcap] [keyword]` |
| 🔴 Disable sniper | `/snipeoff` |
| 📊 Token stats | `/stats <mint>` |
| 📈 ASCII price chart | `/chart <mint>` |

## Setup

### 1. Prerequisites
- Node.js 18+
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- A Solana wallet with SOL for trading

### 2. Install
```bash
cd pumpfun-bot
npm install
```

### 3. Configure
```bash
cp .env.example .env
# Edit .env with your credentials
nano .env
```

Required values in `.env`:
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `WALLET_PRIVATE_KEY` — your Solana wallet's base58 private key

### 4. Get Your Private Key
If you're using Phantom wallet:
1. Settings → Security & Privacy → Export Private Key
2. The key shown is your base58 private key

Or generate a new wallet:
```bash
node -e "
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const kp = Keypair.generate();
console.log('Public key:', kp.publicKey.toBase58());
console.log('Private key:', bs58.encode(kp.secretKey));
"
```

### 5. (Recommended) Use a Premium RPC
The public Solana RPC is rate-limited and slow. Get a free key from:
- [Helius](https://helius.dev) — best for Pump.fun
- [QuickNode](https://quicknode.com)
- [Alchemy](https://alchemy.com)

Add to `.env`:
```
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

### 6. Run
```bash
npm start
# or for development with auto-reload:
npm run dev
```

## Usage Examples

```
# Buy 0.1 SOL worth of a token
/buy So11111111111111111111111111111111111111112 0.1

# Sell 50% of your holdings
/sell So11111111111111111111111111111111111111112 50

# Track a token for alerts
/track So11111111111111111111111111111111111111112

# Auto-snipe new tokens under $50k market cap with "pepe" in name
/snipe 0.1 50000 pepe

# Check token stats
/stats So11111111111111111111111111111111111111112
```

## Architecture

```
src/
├── bot.js              # Entry point & command router
├── handlers/
│   ├── general.js      # /start, /help
│   ├── trading.js      # /buy, /sell, /balance
│   ├── tracking.js     # /track, /untrack, /watchlist
│   ├── sniper.js       # /snipe, /snipeoff
│   └── stats.js        # /stats, /chart
├── services/
│   ├── pumpfun.js      # Pump.fun API client
│   ├── wallet.js       # Solana wallet & transaction signing
│   └── monitor.js      # Background polling loop
└── utils/
    ├── store.js         # In-memory state (watchlists, sniper config)
    └── logger.js        # Colored console logger
```

## ⚠️ Security & Risk Warnings

- **Never share your private key** with anyone
- **Start with small amounts** to test the bot
- **Pump.fun tokens are extremely high risk** — most go to zero
- This bot is provided as-is without any financial advice
- Always verify transactions on [Solscan](https://solscan.io) before confirming

## Production Tips

- Use a **dedicated wallet** with limited funds (not your main wallet)
- Run with [PM2](https://pm2.keymetrics.io/) for auto-restart: `pm2 start src/bot.js --name pumpbot`
- Replace the in-memory store (`utils/store.js`) with Redis or SQLite for persistence across restarts
- Monitor logs for errors

## License

MIT — use at your own risk.
