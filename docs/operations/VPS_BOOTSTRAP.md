# 🚀 VPS Bootstrap — Setup Initial Production

> **Objectif :** Préparer un VPS vierge pour le déploiement Sylion Backend.  
> **Cible :** Ubuntu 22.04 LTS / Debian 12  
> **Durée estimée :** 15-20 minutes

---

## Prérequis

- Accès root ou sudo au VPS
- Clé SSH locale générée (`~/.ssh/id_ed25519.pub`)
- Domaine `api.sylion.tech` pointant vers l'IP du VPS

---

## Étape 1 : Créer l'utilisateur de déploiement

```bash
# Sur le VPS (en root)
adduser sylion --disabled-password --gecos ""
usermod -aG sudo sylion

# Configurer sudo sans mot de passe (optionnel)
echo "sylion ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/sylion
chmod 440 /etc/sudoers.d/sylion
```

---

## Étape 2 : Configurer SSH (clé uniquement)

```bash
# Sur le VPS (en root)
mkdir -p /home/sylion/.ssh
chmod 700 /home/sylion/.ssh

# Copier votre clé publique
echo "ssh-ed25519 AAAA... your-email@example.com" > /home/sylion/.ssh/authorized_keys
chmod 600 /home/sylion/.ssh/authorized_keys
chown -R sylion:sylion /home/sylion/.ssh

# Sécuriser SSH
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
```

---

## Étape 3 : Configurer le firewall (UFW)

```bash
# Sur le VPS (en tant que sylion)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (certbot)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable
sudo ufw status
```

---

## Étape 4 : Installer Docker

```bash
# Installer Docker (méthode officielle)
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker sylion
newgrp docker

# Vérifier
docker --version
docker compose version
```

---

## Étape 5 : Installer Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
sudo nginx -t
```

---

## Étape 6 : Créer la structure de dossiers

```bash
# Créer le répertoire de déploiement
sudo mkdir -p /srv/sylion
sudo chown sylion:sylion /srv/sylion
cd /srv/sylion

# Cloner le repo (ou copier les fichiers)
git clone git@github.com:yassineco/sylion-backend.git .
# OU
# scp -r ./sylion-backend/* sylion@vps:/srv/sylion/

# Créer les dossiers nécessaires
mkdir -p logs backups/postgres

# Vérifier la structure
ls -la /srv/sylion
```

---

## Étape 7 : Configurer les secrets

```bash
cd /srv/sylion

# Créer le fichier de secrets
touch .env.prod
chmod 600 .env.prod

# Éditer avec les vraies valeurs
nano .env.prod
```

**Contenu minimal `.env.prod` :**

```env
# Database
POSTGRES_PASSWORD=<générer: openssl rand -base64 32>

# Redis
REDIS_PASSWORD=<générer: openssl rand -base64 32>

# Security
JWT_SECRET=<générer: openssl rand -base64 64>

# WhatsApp
WHATSAPP_API_KEY=<depuis 360dialog>
WHATSAPP_VERIFY_TOKEN=<token personnalisé min 8 chars>

# GCP (optionnel)
GOOGLE_CLOUD_PROJECT=
GOOGLE_APPLICATION_CREDENTIALS=
```

---

## Étape 8 : Configurer Nginx

```bash
# Copier la config depuis le repo
sudo cp /srv/sylion/docs/nginx/api.sylion.tech.conf /etc/nginx/sites-available/api.sylion.tech

# Activer le site
sudo ln -s /etc/nginx/sites-available/api.sylion.tech /etc/nginx/sites-enabled/

# Supprimer le site par défaut
sudo rm -f /etc/nginx/sites-enabled/default

# Tester et recharger
sudo nginx -t
sudo systemctl reload nginx
```

---

## Étape 9 : Obtenir le certificat SSL

```bash
# Installer Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtenir le certificat (interactif)
sudo certbot --nginx -d api.sylion.tech

# Vérifier le renouvellement automatique
sudo certbot renew --dry-run
```

---

## Validation finale

```bash
# Checklist rapide
echo "=== VPS Bootstrap Validation ==="
echo -n "User sylion exists: " && id sylion > /dev/null 2>&1 && echo "✅" || echo "❌"
echo -n "SSH key auth only: " && grep -q "PasswordAuthentication no" /etc/ssh/sshd_config && echo "✅" || echo "❌"
echo -n "UFW enabled: " && sudo ufw status | grep -q "Status: active" && echo "✅" || echo "❌"
echo -n "Docker installed: " && docker --version > /dev/null 2>&1 && echo "✅" || echo "❌"
echo -n "Nginx running: " && systemctl is-active nginx > /dev/null && echo "✅" || echo "❌"
echo -n "/srv/sylion exists: " && [ -d /srv/sylion ] && echo "✅" || echo "❌"
echo -n ".env.prod exists: " && [ -f /srv/sylion/.env.prod ] && echo "✅" || echo "❌"
echo "================================"
```

---

## Prochaine étape

Une fois le bootstrap terminé, suivre la **GO_LIVE_CHECKLIST.md** pour le déploiement applicatif :

```bash
cd /srv/sylion
ENV_FILE=.env.prod docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

---

**Document maintenu par :** Équipe SylionTech  
**Dernière mise à jour :** 2025-12-15
