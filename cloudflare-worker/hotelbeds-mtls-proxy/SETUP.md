# Hotelbeds mTLS Proxy — Cloudflare Worker Setup Guide

## Overview
Hotelbeds requires mutual TLS (mTLS) for production API access. Since Supabase Edge Functions don't support client certificates, this Cloudflare Worker acts as a proxy that attaches the mTLS certificate to every request.

```
Edge Function → Cloudflare Worker (attaches mTLS cert) → Hotelbeds Production API
```

## Prerequisites
- Cloudflare account (free tier works)
- Your PEM certificate and private key from Hotelbeds
- Node.js installed locally

## Step-by-Step Setup

### 1. Install Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 2. Upload your mTLS Certificate
```bash
cd cloudflare-worker/hotelbeds-mtls-proxy
wrangler mtls-certificate upload --cert /path/to/cert.pem --key /path/to/key.pem --name hotelbeds-mtls
```
Copy the returned `certificate_id` — you'll need it next.

### 3. Update wrangler.toml
Replace `<CERT_ID_AFTER_UPLOAD>` with the certificate ID from step 2.

### 4. Set the Proxy Auth Token
Generate a strong random token and set it as a secret:
```bash
# Generate a token
openssl rand -hex 32

# Set it in Cloudflare
wrangler secret put PROXY_AUTH_TOKEN
# Paste the generated token when prompted
```

### 5. Deploy the Worker
```bash
npm install
wrangler deploy
```
Note the deployed URL (e.g., `https://hotelbeds-mtls-proxy.your-subdomain.workers.dev`)

### 6. Add Secrets to Lovable Cloud
In your Lovable project, add these two secrets:
- `HOTELBEDS_MTLS_PROXY_URL` → the Worker URL from step 5
- `HOTELBEDS_MTLS_PROXY_TOKEN` → the same token from step 4

### 7. Switch to Production
Add one more secret:
- `HOTELBEDS_ENV` → `live`

## How It Works

- **Test mode** (`HOTELBEDS_ENV=test`): Edge Function calls Hotelbeds test API directly (no mTLS needed)
- **Production mode** (`HOTELBEDS_ENV=live`): Edge Function routes through the Cloudflare Worker, which attaches the client certificate

The Edge Function automatically detects the environment and routes accordingly.

## Verification
1. Deploy the Worker
2. Set the secrets in Lovable
3. Run a hotel search — the Edge Function will route through the Worker
4. Check Worker logs: `wrangler tail`

## Security
- The proxy authenticates callers using the `x-proxy-token` header
- The mTLS certificate never leaves Cloudflare's infrastructure
- API keys and signatures are still generated in the Edge Function
