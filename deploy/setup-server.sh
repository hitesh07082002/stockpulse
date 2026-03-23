#!/bin/bash
set -euo pipefail

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"

# Install Docker Compose plugin
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# Create app directory
sudo mkdir -p /opt/stockpulse
sudo chown "$USER:$USER" /opt/stockpulse

# Create log directory
sudo mkdir -p /var/log/stockpulse
sudo chown "$USER:$USER" /var/log/stockpulse

# Copy compose file
cp docker-compose.yml /opt/stockpulse/

# Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "Done. Next steps:"
echo "1. Create /opt/stockpulse/.env with production secrets"
echo "2. Copy deploy/nginx-stockpulse.conf to /etc/nginx/sites-available/"
echo "3. ln -s /etc/nginx/sites-available/nginx-stockpulse.conf /etc/nginx/sites-enabled/"
echo "4. certbot --nginx -d stockpulse.hiteshsadhwani.xyz"
echo "5. Install cron: crontab deploy/crontab.txt"
