# 💾 PostgreSQL Backup & Restore — Sylion Backend

> **Version:** 1.0  
> **Date:** 2025-12-13

---

## 📁 Structure des fichiers

```
sylion-backend/
├── scripts/
│   ├── backup_postgres.sh    # Script de backup
│   └── restore_postgres.sh   # Script de restore
└── backups/
    └── postgres/
        ├── sylion_2025-12-13_020000.sql.gz
        ├── sylion_2025-12-12_020000.sql.gz
        └── ...
```

---

## 🔄 Backup manuel

### Exécution

```bash
cd /srv/sylion
ENV_FILE=.env.prod ./scripts/backup_postgres.sh
```

### Sortie attendue

```
🔄 Starting PostgreSQL backup...
   Database: sylion_prod
   Container: sylion-postgres
   Output: backups/postgres/sylion_2025-12-13_143022.sql.gz
✅ Backup completed successfully
   File: backups/postgres/sylion_2025-12-13_143022.sql.gz
   Size: 2.3M
🧹 Cleaning up backups older than 7 days...
   Deleted: 0 old backup(s)
📊 Backup Summary:
   Total backups: 5
   Total size: 12M
   Retention: 7 days
🎉 Done!
```

---

## ⏪ Restore

### Lister les backups disponibles

```bash
ls -lh backups/postgres/
```

### Restaurer un backup

```bash
cd /srv/sylion
ENV_FILE=.env.prod ./scripts/restore_postgres.sh backups/postgres/sylion_2025-12-13_020000.sql.gz
```

### ⚠️ Avertissement

- Le script demande une **confirmation explicite** (`YES`)
- Le backend est **arrêté automatiquement** pendant la restauration
- La base de données actuelle est **écrasée**

---

## ⏰ Cron journalier

### Configuration recommandée

```bash
# Éditer la crontab
crontab -e
```

### Ajouter cette ligne

```cron
# Backup PostgreSQL tous les jours à 02:00
0 2 * * * cd /srv/sylion && ENV_FILE=.env.prod ./scripts/backup_postgres.sh >> /var/log/sylion-backup.log 2>&1
```

### Vérifier la crontab

```bash
crontab -l
```

### Vérifier les logs

```bash
tail -f /var/log/sylion-backup.log
```

---

## 📋 Politique de rétention

| Paramètre | Valeur |
|-----------|--------|
| Fréquence | 1 backup / jour |
| Rétention | 7 jours |
| Nettoyage | Automatique (dans le script) |
| Format | `.sql.gz` (gzip compressé) |

Pour modifier la rétention, éditer `RETENTION_DAYS` dans `scripts/backup_postgres.sh`.

---

## 🔐 Sécurité

- ❌ Les scripts ne contiennent **aucun secret**
- ✅ Les secrets sont lus depuis `ENV_FILE`
- ✅ Les backups sont stockés localement (ajouter une copie off-site si nécessaire)
- ✅ Permissions recommandées :

```bash
chmod 700 scripts/backup_postgres.sh scripts/restore_postgres.sh
chmod 700 backups/postgres
```

---

## 🚨 Troubleshooting

### Le backup échoue

```bash
# Vérifier que le conteneur tourne
docker ps | grep sylion-postgres

# Vérifier les variables d'environnement
grep POSTGRES .env.prod
```

### Le restore échoue

```bash
# Vérifier l'intégrité du fichier
gunzip -t backups/postgres/sylion_2025-12-13_020000.sql.gz

# Vérifier les connexions actives
docker exec sylion-postgres psql -U sylion_user -d sylion_prod -c "SELECT * FROM pg_stat_activity;"
```

### Espace disque insuffisant

```bash
# Vérifier l'espace
df -h /srv/sylion/backups

# Supprimer manuellement les vieux backups
ls -lt backups/postgres/ | tail -n +8 | xargs rm -f
```

---

## 📊 Estimation taille

| Données | Taille backup (gzip) |
|---------|---------------------|
| 10 MB | ~2 MB |
| 100 MB | ~15 MB |
| 1 GB | ~150 MB |

---

**Maintenu par :** Équipe SylionTech  
**Dernière mise à jour :** 2025-12-13
