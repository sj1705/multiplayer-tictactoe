# AWS EC2 Deployment Guide

## 1. Launch EC2 Instance

- **AMI:** Ubuntu 22.04 LTS
- **Instance type:** t2.micro (free tier eligible)
- **Storage:** 20 GB gp3
- **Key pair:** Create or use existing SSH key

### Security Group Rules

| Type  | Port  | Source    | Purpose          |
|-------|-------|-----------|------------------|
| SSH   | 22    | Your IP   | Server access    |
| Custom| 7350  | 0.0.0.0/0| Nakama API       |
| Custom| 7351  | Your IP   | Nakama Console   |

## 2. Server Setup

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>

# Install Docker
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker

# Create project directory
mkdir -p ~/tictactoe
```

## 3. Upload Project Files

From your local machine:
```bash
scp -i your-key.pem -r nakama/ docker-compose.yml Dockerfile.nakama ubuntu@<EC2-PUBLIC-IP>:~/tictactoe/
```

## 4. Start Services

```bash
cd ~/tictactoe
docker compose up -d --build
```

Verify:
```bash
docker compose ps
# Both nakama and cockroachdb should show "Up"

curl http://localhost:7350/healthcheck
# Should return OK
```

## 5. (Optional) Elastic IP

Attach an Elastic IP to your instance for a stable public address that persists across restarts.

## 6. Frontend Deployment

Create `frontend/.env.production`:
```
VITE_NAKAMA_HOST=<EC2-PUBLIC-IP-OR-DOMAIN>
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_USE_SSL=false
VITE_NAKAMA_KEY=defaultkey
```

Build and deploy:
```bash
cd frontend
npm run build
# Deploy dist/ to GitHub Pages, Vercel, Netlify, or S3
```

## Cost Estimate

- **t2.micro:** Free for 12 months (750 hrs/month)
- **Storage:** ~$1.60/month for 20GB gp3
- **Elastic IP:** Free while attached to running instance
- **Data transfer:** First 100GB/month free

## Troubleshooting

- **Can't connect:** Check security group allows port 7350
- **Container crash loop:** Check logs with `docker compose logs nakama`
- **Database issues:** `docker compose logs cockroachdb`
- **Rebuild after code changes:** `docker compose up -d --build`
