# FB Leads Worker

This is the Playwright-based worker that scrapes Facebook groups for leads.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Configure accounts in `.env`:**
   ```env
   ACCOUNTS_CONFIG=[{"id":"account-1","email":"your@email.com","name":"Account 1"}, ...]
   ```

3. **Login to all accounts:**
   ```bash
   npm run login:all
   ```
   This will open a browser for each account. Log in manually and the session will be saved.

4. **Test scraping (without saving to database):**
   ```bash
   npm run test:scrape
   ```

5. **Start the worker:**
   ```bash
   npm start
   ```

## Commands

| Command | Description |
|---------|-------------|
| `npm run login` | Login to a single account (browser stays open for 2FA) |
| `npm run login:all` | Open all accounts at once for manual login |
| `npm run keep-alive` | Keep all logged-in browsers open (session refresh) |
| `npm run test:scrape` | Test scraping without saving to DB |
| `npm start` | Start the scheduled worker |
| `npm run dev` | Start with hot-reload (development) |

## Login Process

The login scripts keep browsers **open** so you can:
- Complete 2FA authentication
- Pass security checkpoints
- Verify your identity if Facebook asks

**How to login:**
1. Run `npm run login:all`
2. Multiple browser windows open (one per account)
3. Log in to each account manually
4. Complete any 2FA or security checks
5. Sessions auto-save every 30 seconds
6. Press ENTER when done, or keep browsers open

**Keep sessions alive:**
- Run `npm run keep-alive` to open all logged-in accounts
- Useful to prevent session expiration
- Auto-saves every 60 seconds

## Configuration

Edit `.env` to configure:

- `CONTROL_PLANE_URL` - URL of the Next.js dashboard (default: http://localhost:3000)
- `ACCOUNTS_CONFIG` - JSON array of account configurations
- `TIMEZONE` - Your timezone for scheduling (default: Africa/Tunis)
- `HEADLESS` - Run browser in headless mode (default: false for debugging)
- `SLOW_MO` - Slow down browser actions (ms) for debugging

## Schedule

The worker runs on this schedule:

- **08:00 - 00:00**: Operating hours
- **Peak hours (12-13, 19-21)**: Scrapes every 30 minutes
- **Normal hours**: Scrapes every hour
- **Random jitter**: 1-5 minute random delay before each cycle

## Safety Limits (per account per day)

- Max scrapes: 25
- Max comments: 15
- Max DMs: 8
- Max groups per cycle: 5

## Files

```
worker/
├── src/
│   ├── index.ts          # Main entry point
│   ├── config.ts         # Configuration
│   ├── api/
│   │   └── client.ts     # API client for control plane
│   ├── browser/
│   │   ├── session.ts    # Session management
│   │   ├── facebook.ts   # Facebook scraping logic
│   │   └── humanize.ts   # Human-like behavior
│   ├── scripts/
│   │   ├── login.ts      # Login single account
│   │   ├── login-all.ts  # Login all accounts
│   │   └── test-scrape.ts # Test scraping
│   └── utils/
│       ├── logger.ts     # Logging utility
│       └── random.ts     # Random utilities
├── sessions/             # Saved browser sessions (git-ignored)
├── package.json
├── tsconfig.json
└── .env
```

## Sessions

Sessions are stored in `sessions/` directory as JSON files. Each file contains the browser storage state (cookies, localStorage, etc.) for a Facebook account.

**Important:** Keep these files secure as they contain your Facebook session data!

## Troubleshooting

### "Not logged in" error
- Run `npm run login:all` to re-login to accounts
- Check if Facebook requires verification

### Rate limiting / Account restrictions
- The worker has built-in delays and jitter
- If you get banned, try:
  - Increasing delays in config.ts
  - Reducing daily limits
  - Using the account normally for a few days before scraping
