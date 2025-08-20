# Быстрое развертывание venorus.net

## Подключение к серверу
```bash
ssh root@109.73.195.215
# Пароль: iYuj2v4wqU-C?A
```

## Одной командой
Скопируйте и вставьте всю команду целиком:

```bash
mkdir -p /opt/venorus-net && cd /opt/venorus-net && \
systemctl stop nginx && systemctl stop medsip 2>/dev/null || true && \
git clone https://github.com/iMAGRAY/venorus.git . && \
npm ci --production && \
cat > .env << 'EOF'
DATABASE_URL="postgresql://gen_user:%5C%24.V%5Cw%3C_r2%5C1%7Dr@1bb84d1fbea33d62faf51337.twc1.net:5432/default_db?sslmode=require"
NEXT_PUBLIC_SITE_URL="https://venorus.net"
POSTGRESQL_HOST="1bb84d1fbea33d62faf51337.twc1.net"
POSTGRESQL_PORT="5432"
POSTGRESQL_USER="gen_user"
POSTGRESQL_PASSWORD="\$V\w<_r2\1}r"
POSTGRESQL_DBNAME="default_db"
REDIS_HOST="94.141.162.221"
REDIS_PORT="6379"
REDIS_USERNAME="default"
REDIS_PASSWORD="&J.~&kXF3y~F0#"
REDIS_DATABASE="0"
S3_ENDPOINT="https://s3.twcstorage.ru"
S3_REGION="ru-1"
S3_ACCESS_KEY="IA1BWYIMK9CDTD4H32ZG"
S3_SECRET_KEY="qDtZCRN0t9WIYxEe2PbA7yfT0wcNlom1dIMHMR4p"
S3_BUCKET="b71e5c4b-4a3b3109-65a0-4e48-b7ad-86e55fabe3b5"
ADMIN_USERNAME="venorus_admin"
ADMIN_PASSWORD="@QTXE&3xKjDl^hHf4ghv*qqo"
JWT_SECRET="a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456"
SESSION_SECRET="f9e8d7c6b5a4321098765432109876543210987654321098765432109876543210987654321098765432109876543210987654321098765432109876543210"
BCRYPT_ROUNDS="12"
SESSION_TIMEOUT="3600000"
NODE_ENV="production"
PORT="3000"
PGSSLMODE="require"
QUICK_HEALTH_CHECK=true
EOF
chmod 600 .env && \
npm run build
```

## Настройка сервисов
```bash
cat > /etc/systemd/system/venorus-net.service << 'EOF'
[Unit]
Description=Venorus.net Next.js Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/venorus-net
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=venorus-net

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/nginx/sites-available/venorus.net << 'EOF'
server {
    listen 80;
    server_name venorus.net www.venorus.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name venorus.net www.venorus.net;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    location /_next/static {
        alias /opt/venorus-net/.next/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

ln -sf /etc/nginx/sites-available/venorus.net /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/venorus.net

nginx -t && systemctl restart nginx

systemctl daemon-reload
systemctl enable venorus-net
systemctl start venorus-net
```

## Проверка
```bash
systemctl status venorus-net --no-pager
systemctl status nginx --no-pager
curl -I http://localhost:3000
```

## SSL (после настройки DNS)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d venorus.net -d www.venorus.net --email admin@venorus.net --agree-tos --non-interactive
```

## Готово!
Сайт будет доступен по адресу venorus.net после настройки DNS.