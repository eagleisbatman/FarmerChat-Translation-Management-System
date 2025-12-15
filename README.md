# FarmerChat Translation Management System

A modern, enterprise-grade Translation Management System (TMS) built for the FarmerChat Platform. This system enables seamless management of multilingual content across multiple mobile and web applications with advanced features like AI-powered translation, translation memory, and collaborative workflows.

## 🌟 About

The FarmerChat Translation Management System is a comprehensive solution for managing translations across all FarmerChat Platform applications. Built with modern web technologies, it provides a clean, intuitive interface for translators and reviewers while offering robust API access for developers.

### Key Highlights

- **Enterprise-Ready**: Built for production with scalability and security in mind
- **AI-Powered**: Integrated support for OpenAI, Google Gemini, and Google Translate
- **Collaborative**: Role-based workflows with review processes and comments
- **Developer-Friendly**: RESTful API with API key authentication
- **Modern UI**: Beautiful, responsive interface with dark/light mode support

## ✨ Features

### Core Features

- **Multi-Project Management**: Organize translations across multiple applications
- **API-Based Access**: Each project has a unique API key for programmatic access
- **Role-Based Access Control**: Admin, Translator, and Reviewer roles with granular permissions
- **Translation Workflow**: Configurable draft → review → approved workflow per project
- **Google OAuth**: Secure authentication restricted to organizational domains
- **Multi-Language Support**: Manage translations for unlimited languages
- **Dark/Light Mode**: Full theme support with smooth transitions

### Advanced Features

- **🤖 AI Translation**: Support for OpenAI, Google Gemini, and Google Translate with automatic fallback
- **🧠 Translation Memory**: Intelligent suggestions based on previously approved translations
- **📸 Screenshot Support**: Attach UI screenshots to translation keys for visual context
- **📁 File Import/Export**: Import/export translations in JSON and CSV formats
- **💬 Comments System**: Collaborate with comments on translations
- **📜 Translation History**: Complete audit trail with user attribution and change tracking

## 🛠️ Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Database**: PostgreSQL with Drizzle ORM
- **UI**: Shadcn UI + Tailwind CSS
- **Auth**: NextAuth.js v5 with Google OAuth
- **Icons**: Lucide React
- **Validation**: Zod
- **AI**: OpenAI, Google Gemini, Google Translate APIs

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Google OAuth credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd farmer-chat-tms
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your environment variables:
   ```env
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/farmer_chat_tms
   
   # Authentication
   NEXTAUTH_SECRET=your-secret-key-here
   NEXTAUTH_URL=http://localhost:3000
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ALLOWED_EMAIL_DOMAINS=digitalgreen.org,digitalgreentrust.org
   
   # AI Providers (optional)
   OPENAI_API_KEY=your-openai-key
   GEMINI_API_KEY=your-gemini-key
   GOOGLE_TRANSLATE_API_KEY=your-google-translate-key
   ```

4. **Generate and run database migrations**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. **Seed initial languages**
   ```bash
   npm run db:seed
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000` to access the application.

## 📚 API Documentation

### Authentication

The public API uses API key authentication. Include your API key in one of these ways:

- **Header**: `X-API-Key: your-api-key`
- **Authorization Header**: `Authorization: Bearer your-api-key`
- **Query Parameter**: `?api_key=your-api-key`

### Get Translations

```bash
# Get all translations
curl -H "X-API-Key: your-api-key" \
  https://your-domain.com/api/v1/translations

# Get translations for specific language
curl -H "X-API-Key: your-api-key" \
  https://your-domain.com/api/v1/translations?lang=en

# Get translations for specific namespace
curl -H "X-API-Key: your-api-key" \
  https://your-domain.com/api/v1/translations?namespace=common
```

### Response Format

```json
{
  "default": {
    "welcome": "Welcome",
    "hello": "Hello"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

### Auto Translate

```bash
curl -X POST https://your-domain.com/api/auto-translate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-session-token" \
  -d '{
    "projectId": "project-id",
    "text": "Hello world",
    "sourceLanguageId": "en",
    "targetLanguageId": "es"
  }'
```

### Export Translations

```bash
# Export as JSON
curl -H "Authorization: Bearer your-session-token" \
  https://your-domain.com/api/projects/project-id/export?format=json

# Export as CSV
curl -H "Authorization: Bearer your-session-token" \
  https://your-domain.com/api/projects/project-id/export?format=csv&lang=en
```

## 🏗️ Project Structure

```
farmer_chat_tms/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/      # Dashboard pages
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # Shadcn UI components
│   └── ...               # Custom components
├── lib/                   # Utility libraries
│   ├── db/               # Database schema & connection
│   ├── ai-providers/     # AI translation providers
│   └── ...               # Other utilities
└── scripts/               # Utility scripts
```

## 🔐 Security

- Domain-restricted authentication (only organizational emails)
- API key hashing with bcrypt
- Role-based access control
- Input validation with Zod
- SQL injection protection (Drizzle ORM)
- Secure session management

## 🚢 Deployment

### Railway Deployment

The application is configured for Railway deployment with automatic migrations.

1. Connect your repository to Railway
2. Add a PostgreSQL service
3. Set environment variables in Railway dashboard
4. Deploy - migrations will run automatically on startup

The start command (`npm start`) automatically runs migrations before starting the server.

## 📖 Usage Guide

### For Translators

1. Sign in with your Google account (must be from allowed domain)
2. Navigate to a project
3. Click on "Translations" to open the translation editor
4. Click on any cell to edit translations
5. Save as draft or submit for review
6. Use "Auto Translate" button for AI-assisted translation
7. View translation memory suggestions for similar translations

### For Reviewers

1. Sign in and navigate to projects
2. Review translations in "review" state
3. Approve or request changes
4. Add comments for translators

### For Developers

1. Get your project's API key from project settings
2. Use the API key to fetch translations via `/api/v1/translations`
3. Integrate translations into your application

## 🤝 Contributing

This project is part of the FarmerChat Platform. For contributions, please follow the development guidelines in `.cursorrules`.

## 📄 License

MIT License - See LICENSE file for details

## 🔗 Related Projects

This TMS is part of the FarmerChat Platform ecosystem, managing translations for:
- FarmerChat Mobile Applications
- FarmerChat Web Platform
- Related services and tools

## 📞 Support

For issues, questions, or feature requests, please contact the FarmerChat Platform team.

---

**Built with ❤️ for the FarmerChat Platform**
