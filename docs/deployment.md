# COEER Deployment Guide

This project is a TanStack Start SSR application with Server Functions and PostgreSQL.
It should be deployed as a Node.js service behind a reverse proxy such as Nginx.

## Requirements

- Linux server, Ubuntu 22.04+ recommended
- Node.js 20+
- pnpm via Corepack
- PostgreSQL 14+
- Nginx
- A domain name pointing to the server

## 1. Install Runtime Dependencies

```sh
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

corepack enable
corepack prepare pnpm@latest --activate
```

## 2. Prepare PostgreSQL

```sh
sudo -u postgres psql
```

```sql
CREATE DATABASE coeer;
CREATE USER coeer_user WITH ENCRYPTED PASSWORD 'change-this-password';
GRANT ALL PRIVILEGES ON DATABASE coeer TO coeer_user;
\q
```

For PostgreSQL 15+, also grant schema privileges after connecting to the database:

```sh
sudo -u postgres psql -d coeer
```

```sql
GRANT ALL ON SCHEMA public TO coeer_user;
\q
```

## 3. Clone and Configure

```sh
sudo mkdir -p /var/www
sudo chown -R "$USER":"$USER" /var/www
cd /var/www
git clone https://github.com/your_name/coeer.git
cd coeer

cp .env.example .env
```

Edit `.env`:

```env
NODE_ENV=production
PORT=3000
CLIENT_URL=https://coeer.example.com

DATABASE_URL=postgresql://coeer_user:change-this-password@localhost:5432/coeer
DB_POOL_MIN=1
DB_POOL_MAX=10

JWT_SECRET=replace-with-production-secret
SESSION_SECRET=replace-with-production-secret

VITE_APP_NAME=COEER
VITE_API_URL=
```

Generate strong secrets:

```sh
openssl rand -base64 48
openssl rand -base64 48
```

## 4. Install, Validate, Build

```sh
pnpm install --frozen-lockfile
pnpm check:env
pnpm db:push
pnpm build
```

For a demo environment, you may seed test data:

```sh
pnpm seed:all
```

Do not run `pnpm seed:all:clean` in production unless you intentionally want to reset demo data.

## 5. Run with systemd

Copy and edit the service file:

```sh
sudo cp deploy/systemd/coeer.service /etc/systemd/system/coeer.service
sudo nano /etc/systemd/system/coeer.service
```

Make sure `WorkingDirectory` points to your deployed project directory and `ExecStart` points to pnpm:

```sh
which pnpm
```

Then start the service:

```sh
sudo systemctl daemon-reload
sudo systemctl enable coeer
sudo systemctl start coeer
sudo systemctl status coeer
```

View logs:

```sh
journalctl -u coeer -f
```

## 6. Configure Nginx

Copy and edit the Nginx config:

```sh
sudo cp deploy/nginx/coeer.conf /etc/nginx/sites-available/coeer
sudo nano /etc/nginx/sites-available/coeer
sudo ln -s /etc/nginx/sites-available/coeer /etc/nginx/sites-enabled/coeer
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Enable HTTPS

```sh
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d coeer.example.com
```

After HTTPS is enabled, ensure `.env` has:

```env
NODE_ENV=production
CLIENT_URL=https://coeer.example.com
```

The session cookie is marked `secure` in production, so HTTPS is required for login to work correctly.

## 8. Update Deployment

```sh
cd /var/www/coeer
git pull
pnpm install --frozen-lockfile
pnpm check:env
pnpm db:push
pnpm build
sudo systemctl restart coeer
```

## 9. Health Checks

```sh
curl -I http://127.0.0.1:3000
curl -I https://coeer.example.com
sudo systemctl status coeer
journalctl -u coeer -n 100 --no-pager
```

## Notes

- Keep `.env` only on the server. Never commit it.
- `pnpm db:push` is convenient for early deployment. For a stable production database, prefer Drizzle migrations with `pnpm db:generate` and `pnpm db:migrate`.
- Back up PostgreSQL before schema changes and before running any clean seed command.
