# Product Context: Mini Social Media Platform

## What This Is
A distilled, production-grade mini social media web platform demonstrating end-to-end full-stack proficiency — from database schema design and secure REST API to a responsive, accessible frontend.

## Target Audience
- **Primary Visitors & Users:** Developers, designers, and social creators looking to share short media & text posts, discover interesting content, and build a personalized network.
- **Evaluators & Stakeholders:** Portfolio reviewers, recruiters, and technical peers assessing code quality, architectural discipline, security, testing, and UX polish.

## Core Problem It Solves
Most social media portfolio projects are either superficial mockups or messy tutorial clones. This application provides a runnable, documented, test-backed product with real database integrity, strict relational constraints, secure authentication, and a friction-free guest onboarding loop.

## Key Workflows
1. **Explore First:** Anonymous visitors land on a rich public media feed ("Explore") with zero friction.
2. **Gated Interaction Loop:** When an anonymous visitor tries to like, comment, follow, or create a post, they are routed to a dedicated `/register` screen with a friendly explanation banner and automatic return redirection.
3. **Publishing Media:** Authenticated users publish text posts with optional local image uploads via a validated media pipeline.
4. **Curated Network:** Users follow other creators to populate a personalized "Following" tab alongside global "Explore".
5. **Idempotent Engagement:** One like per user per post enforced at both API and relational schema levels; single-level threaded comments.
6. **User Profiles:** Public profile cards showing user stats (post count, followers, following) and historical post stream.
7. **Adaptive Aesthetics:** Dynamic Light and Dark themes toggled with a single click and persisted locally.

## Quality & Non-Negotiables
- Strict relational constraints in SQLite (unique composite keys, self-follow database check).
- Layered Express.js architecture (`routes` → `controllers` → `services`).
- Fully test-covered critical paths (`npm test` passes 100%).
- Accessible, semantic HTML/CSS without generic bloated AI defaults.
- Zero external CDN dependencies for offline reliability.
