# Implementation Plan: Client-Side Data Analytics Platform

## 1. Overview
A web-based platform for interactive data analysis using DuckDB WASM for client-side processing, keeping server costs minimal. Advanced AI insights are gated behind a subscription paywall.

## 2. Architecture
- **Frontend**: React, Tailwind CSS, Recharts (for dashboards).
- **Analytical Engine**: DuckDB WASM (in-browser SQL engine).
- **Data Storage**: Parquet files hosted on a CDN/Object Storage.
- **Backend**: Minimal (Node.js/Express) for:
    - User Authentication (Firebase Auth).
    - Subscription Management (Stripe).
    - API Proxy for Gemini (to keep keys secure).

## 3. Core Requirements
1. **Dataset Discovery**: Browse/search available Parquet datasets.
2. **Metadata Review**: View schema and summary statistics before analysis.
3. **"Analyze This Data"**:
    - Trigger data loading.
    - Perform size check.
    - Offer truncation options (e.g., last 24h, 7d, 30d, 6m, 1y).
4. **Basic Analytics**: SQL-based insights (frequency, patterns, outliers) using DuckDB.
5. **Dashboard**: Visualize insights using Recharts.
6. **Advanced AI Analysis**: Button to call Gemini API (gated by paywall).

## 4. Edge Cases & Mitigation
- **Memory Limit Exceeded**: If dataset > browser memory, force truncation or sampling.
- **Network Failure**: Implement retry logic for Parquet fetching.
- **DuckDB Init Failure**: Graceful fallback UI.
- **Gemini Rate Limiting**: Implement exponential backoff and UI feedback.
- **Malformed Parquet**: Validate file integrity before loading.
- **Large AI Response**: Stream AI responses or summarize.

## 5. Implementation Phases
1. **Phase 1: Prototype**: DuckDB WASM setup, Parquet loading, basic SQL query.
2. **Phase 2: UI/UX**: Dataset browser, truncation selector, dashboard.
3. **Phase 3: Backend/Auth**: Firebase Auth, Stripe integration.
4. **Phase 4: AI Integration**: Gemini API proxy, paywall gating.
