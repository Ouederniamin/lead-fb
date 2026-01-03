# FB Lead Generator

A Next.js-based Facebook Lead Scraper with Messenger automation for Creator Labs - a Tunisian development & marketing agency.

## 🚀 Features

- **Facebook Messenger Automation**: Automated conversation management with leads
- **AI-Powered Responses**: Uses Gemini AI to generate contextual responses in Tunisian Arabic
- **Lead Management**: Track and manage leads through different stages (NEW → CONTACTED → QUALIFIED → PROPOSAL → WON/LOST)
- **Multi-Account Support**: Manage multiple Facebook accounts
- **Group Scraping**: Scrape leads from Facebook groups
- **High-Intent Detection**: Identify and prioritize high-intent leads
- **E2EE Support**: Handle encrypted Messenger conversations with PIN

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with TypeScript
- **Database**: PostgreSQL (Neon) with Prisma ORM
- **Browser Automation**: Playwright
- **AI**: Google Gemini API
- **UI**: Tailwind CSS + shadcn/ui
- **Authentication**: Clerk

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)
- Google Gemini API key
- Clerk account for auth

## 🔧 Installation

```bash
# Clone the repository
git clone https://github.com/Ouederniamin/lead-fb.git
cd lead-fb

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Set up database
npx prisma generate
npx prisma db push
npx prisma db seed

# Run development server
npm run dev
```

## 📁 Project Structure

```
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   │   ├── accounts/      # Facebook account management
│   │   ├── agents/        # Automation agents
│   │   ├── ai/            # AI endpoints
│   │   ├── leads/         # Lead management
│   │   └── test/          # Testing endpoints
│   └── dashboard/         # Dashboard pages
├── agents/                # Automation agents
│   ├── procedures/        # Agent procedures
│   ├── lead-gen-agent.ts  # Lead generation
│   └── message-agent.ts   # Messenger automation
├── components/            # React components
├── lib/                   # Utilities
├── prisma/                # Database schema
└── worker/                # Background worker
```

## 🔑 Environment Variables

```env
DATABASE_URL=postgresql://...
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

## 📖 Documentation

- [Architecture](./ARCHITECTURE.md) - System architecture overview
- [Agents Guide](./docs/AGENTS-TECHNICAL-GUIDE.md) - Agent documentation
- [Lead Stages](./docs/LEAD-STAGES.md) - Lead lifecycle
- [Roadmap](./ROADMAP.md) - Future plans

## 🧪 Testing

```bash
# Run in development
npm run dev

# Access test endpoints at /dashboard/testing
```

## 📄 License

Private - Creator Labs © 2024-2026
