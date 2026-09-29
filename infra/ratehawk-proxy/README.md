# RateHawk static-IP proxy (VPS only — not part of the app build)

Runs on the Lightsail VPS (34.237.67.148) behind Caddy at
https://ratehawk-proxy.crestwellgetaways.com. Requires Node >= 22.6 (no runtime deps).

## Install
```bash
sudo useradd --system --no-create-home ratehawk
sudo mkdir -p /opt/ratehawk-proxy && sudo cp -r src package.json /opt/ratehawk-proxy/
sudo cp .env.example /opt/ratehawk-proxy/.env && sudo nano /opt/ratehawk-proxy/.env
sudo chown -R ratehawk:ratehawk /opt/ratehawk-proxy && sudo chmod 600 /opt/ratehawk-proxy/.env
sudo cp ratehawk-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now ratehawk-proxy
curl -s http://127.0.0.1:8787/healthz
```

## Caddyfile (replace the placeholder `respond "ok"`)
```
ratehawk-proxy.crestwellgetaways.com {
    reverse_proxy 127.0.0.1:8787
}
```
Then `sudo systemctl reload caddy`.

## Backend
Edge functions use the proxy whenever the `RATEHAWK_PROXY_SECRET` secret is set
(value must equal `PROXY_SECRET` here). Remove that secret to roll back to direct calls.
