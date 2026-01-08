# PromptVerse - Product Documentation

## Overview

**PromptVerse** is an AI-powered brand visibility monitoring and optimization platform that helps businesses track, analyze, and improve their presence across AI search engines and assistants. As AI-generated search results become increasingly important, PromptVerse enables brands to understand how they appear in responses from platforms like ChatGPT, Perplexity, Google AI Overviews, and more.

### Core Purpose

The tool addresses a critical need in modern digital marketing: understanding and optimizing how AI assistants mention and recommend brands when users ask questions. Unlike traditional SEO tools that focus on search engine rankings, PromptVerse specializes in **AI Search Optimization (AISO)**.

### Key Value Propositions

- **AI Prompt Scanning**: Discover which questions and prompts mention your brand across major AI platforms
- **Real-time Monitoring**: Track brand mentions and visibility scores in real-time
- **Competitor Intelligence**: Benchmark against competitors and identify ranking opportunities
- **Smart Optimization**: Get AI-powered recommendations for improving AI search visibility
- **Multi-Platform Coverage**: Monitor across ChatGPT, Perplexity, Google AI Overviews, and Gemini

---

## Current Implementation Status

### ✅ Fully Implemented Features

#### 1. Authentication System
- **Local Authentication**: Email/password registration and login with bcrypt password hashing
- **Google OAuth**: Social login integration via Supabase and @react-oauth/google
- **JWT Token Management**: Secure token-based authentication with HTTP-only cookies
- **Protected Routes**: Route guards for authenticated-only pages

#### 2. User Management
- User profiles with name, email, and avatar
- Subscription tier tracking (free, starter, pro, agency)
- Email verification support
- User preferences and settings

#### 3. Brand Management
- **Create/Save Brands**: Users can save brands with name, website URL, and favicon
- **Brand Dashboard**: Dedicated dashboard per brand with reports and analytics
- **Brand-specific Reports**: Track reports by brand
- **Favicon Fetching**: Automatic favicon detection from brand websites
- **Multiple Brands**: Support for managing multiple brands per user account

#### 4. Report Generation System
- **Multi-step Report Wizard**:
  - Step 1: Brand information input (name, URL, search scope, location, platforms)
  - Step 2: Brand analysis and prompt generation
  - Step 3: Ready to analyze with AI platforms
- **Platform Selection**: Choose between ChatGPT, Perplexity, and Google AI Overviews
- **Search Scope Options**: Local or national search targeting
- **Multi-language Support**: 18+ languages supported
- **Country Targeting**: 35+ countries available for targeting
- **Progress Saving**: In-progress reports can be saved and continued later
- **Report Statistics**: 
  - Total prompts analyzed
  - Website found count
  - Brand mention count
  - Success rate percentage

#### 5. Credit System
- **Default Credits**: New users receive 25 free credits
- **Credit Deduction**: Credits deducted per prompt analyzed
- **Credit Activity Log**: Full transaction history
- **Multiple Credit Sources**:
  - Purchase credits (Stripe integration)
  - Earn credits (referrals, surveys)
  - Subscription credits

#### 6. Subscription & Payments (Stripe Integration)
- **Subscription Plans**: Free, Starter, Pro, Agency tiers
- **Credit Top-ups**: One-time credit purchases
- **Checkout Sessions**: Stripe-hosted checkout flow
- **Billing Portal**: Customer portal for subscription management
- **Webhook Handling**: Automated subscription status updates

#### 7. Referral System
- Unique referral codes per user
- Referral tracking and counting
- Credit rewards for referrals
- Referral code generation utility

#### 8. Survey System
- Survey completion tracking
- Credit rewards for survey completion
- Survey response storage

#### 9. Report Sharing
- **Public Share Links**: Generate shareable report URLs
- **Share Tokens**: Unique secure tokens for shared reports
- **SharedReport Page**: Public view for shared reports

#### 10. Scheduled Reports
- **Scheduled Prompts**: Store prompts for automated analysis
- **Brand Scheduling**: Schedule recurring reports per brand
- **n8n Integration**: Webhook notifications for scheduled tasks
- **Edit Scheduled Prompts**: Modify scheduled report configurations

#### 11. Frontend Features
- **Responsive Design**: Mobile-friendly with Tailwind CSS
- **Dark Mode**: Theme toggle with context-based theming
- **Landing Page Components**: Hero, Features, How It Works, Pricing, CTA, Footer
- **Loading States**: Analysis progress modals with real-time updates
- **Toast Notifications**: User feedback via react-hot-toast
- **PDF Export**: Report export to PDF functionality

#### 12. Backend Infrastructure
- **Express.js Server**: RESTful API architecture
- **MongoDB Database**: Mongoose ODM with indexed schemas
- **Security**: 
  - Helmet.js for HTTP headers
  - Rate limiting (100 requests per 15 minutes)
  - CORS configuration
  - Input validation
- **Error Handling**: Centralized error middleware

---

### 📁 Data Models Implemented

| Model | Purpose |
|-------|---------|
| **User** | User accounts, credentials, subscription info, credits |
| **Brand** | Saved brands per user |
| **Report** | Generated analysis reports with full results |
| **ScheduledPrompt** | Prompts scheduled for automated analysis |
| **PromptSent** | Individual prompts sent to AI platforms |
| **PromptResponse** | Responses received from AI platforms |
| **CreditLog** | Credit transaction history |
| **Survey** | User survey responses |

---

### 🔌 API Routes Implemented

| Route Prefix | Purpose |
|--------------|---------|
| `/api/auth` | Authentication (login, register, OAuth) |
| `/api/brand` | Brand management (CRUD, favicon) |
| `/api/credits` | Credit management and activity logs |
| `/api/openai` | AI platform interactions |
| `/api/analysis` | Report analysis and scheduled prompts |
| `/api/reports` | Report CRUD and sharing |
| `/api/stripe` | Payment and subscription handling |

---

### 🎨 Frontend Pages Implemented

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | Marketing landing page |
| Login | `/login` | User authentication |
| Register | `/register` | New user registration |
| Reports (New) | `/reports/new` | Create new analysis report |
| All Reports | `/reports` | View all reports |
| Report View | `/reports/:id` | View individual report |
| Shared Report | `/shared/:token` | Public shared report view |
| Profile | `/profile` | User profile and settings |
| Earn Credits | `/earn-credits` | Referral and credit earning |
| Buy Credits | `/buy-credits` | Purchase credits |
| My Brands | `/brands` | Brand management |
| Brand Dashboard | `/brands/:brandId/*` | Brand-specific dashboard |

---

### 🔧 External Integrations

| Service | Purpose | Status |
|---------|---------|--------|
| **MongoDB** | Primary database | ✅ Implemented |
| **Supabase** | Google OAuth provider | ✅ Implemented |
| **Stripe** | Payments & subscriptions | ✅ Implemented |
| **n8n** | Workflow automation & webhooks | ✅ Integrated |
| **OpenAI/AI APIs** | AI platform analysis | ✅ Implemented |

---

### 📊 Technology Stack

**Frontend:**
- React 18+ with Vite
- React Router v6
- Tailwind CSS
- Lucide React (icons)
- react-hot-toast
- @react-oauth/google

**Backend:**
- Node.js with Express.js
- MongoDB with Mongoose
- JWT authentication
- Stripe SDK
- Axios for HTTP requests

**Infrastructure:**
- Vercel (Frontend deployment)
- Rate limiting & security middleware
- Environment-based configuration

---

## Summary

PromptVerse is a fully-functional SaaS application with a complete authentication system, credit-based usage model, Stripe payment integration, and multi-platform AI analysis capabilities. The core workflow of creating brands, generating analysis reports, and tracking brand visibility across AI platforms is fully operational. The scheduled reporting feature enables automated monitoring, and the sharing functionality allows users to distribute their insights.

---

*Last Updated: January 2026*