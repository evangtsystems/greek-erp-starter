# erp.gtsystems.gr deployment

## DNS

Create this DNS record where `gtsystems.gr` is managed:

```txt
Type: A
Host: erp
Value: 87.106.27.215
TTL: 300
```

After propagation, `erp.gtsystems.gr` should resolve to `87.106.27.215`.

## App Ports

The production layout assumes both services run on the same server:

```txt
Next.js web: http://127.0.0.1:3000
Express API: http://127.0.0.1:4000
Public URL:  https://erp.gtsystems.gr
```

The web app proxies `/erp-api/*` to the API through `apps/web/next.config.ts`.

## Server Setup

On the server:

```bash
cd /opt/greek-erp-starter
npm install
npm run db:generate
npm run db:deploy
npm run build
```

Copy the systemd service files from `deploy/systemd/` to `/etc/systemd/system/`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now greek-erp-api greek-erp-web
```

Copy `deploy/nginx/erp.gtsystems.gr.conf` to `/etc/nginx/sites-available/erp.gtsystems.gr`, enable it, and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/erp.gtsystems.gr /etc/nginx/sites-enabled/erp.gtsystems.gr
sudo nginx -t
sudo systemctl reload nginx
```

Then issue TLS:

```bash
sudo certbot --nginx -d erp.gtsystems.gr
```
