/**
 * Test de connexion DB - Diagnostic uniquement
 * Usage: tsx scripts/test-db-connection.ts
 */
import { config } from "../src/config/env";

// Masquer le mot de passe dans l'URL pour le diagnostic
function maskDatabaseUrl(url: string): string {
  return url.replace(
    /postgres(ql)?:\/\/([^:]+):([^@]+)@/,
    "postgres://$2:***@"
  );
}

async function main() {
  console.log("🔍 DATABASE CONNECTION DIAGNOSTIC");
  console.log("═══════════════════════════════════════════════════════");
  
  // Afficher la configuration (sans secrets)
  const maskedUrl = maskDatabaseUrl(config.database.url);
  const urlParts = maskedUrl.match(/postgres:\/\/([^:]+):\*\*\*@([^:]+):(\d+)\/(.+)/);
  
  if (urlParts) {
    console.log(`   User:     ${urlParts[1]}`);
    console.log(`   Host:     ${urlParts[2]}`);
    console.log(`   Port:     ${urlParts[3]}`);
    console.log(`   Database: ${urlParts[4]}`);
    console.log(`   SSL:      ${config.database.ssl}`);
    console.log(`   Env:      ${config.isDev ? "development" : config.isProd ? "production" : "test"}`);
  } else {
    console.log(`   URL (masked): ${maskedUrl}`);
  }
  
  console.log("═══════════════════════════════════════════════════════");
  
  // Déterminer si c'est local ou Supabase
  const isLocal = maskedUrl.includes("localhost") || maskedUrl.includes("127.0.0.1");
  console.log(`   Type: ${isLocal ? "🏠 LOCAL PostgreSQL" : "☁️  SUPABASE (remote)"}`);
  
  if (isLocal) {
    console.log("");
    console.log("⚠️  ATTENTION: La configuration pointe vers une base LOCALE.");
    console.log("   Pour utiliser Supabase, modifiez DATABASE_URL dans .env.local");
    console.log("   avec votre URL Supabase (format: postgres://..@db.xxxx.supabase.co:5432/postgres)");
  }
  
  console.log("");
  console.log("🔌 Testing connection with SELECT 1...");
  
  try {
    // Import dynamique pour éviter les erreurs de connexion avant le diagnostic
    const { db } = await import("../src/db");
    const { sql } = await import("drizzle-orm");
    
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log("✅ Connection successful!");
    console.log(`   Result: ${JSON.stringify(result)}`);
    process.exit(0);
  } catch (error: any) {
    console.log("❌ Connection FAILED!");
    console.log(`   Error: ${error.message}`);
    
    if (error.code === "ECONNREFUSED") {
      console.log("");
      console.log("💡 CAUSE PROBABLE:");
      console.log("   Le serveur PostgreSQL n'est pas accessible sur", error.address + ":" + error.port);
      console.log("");
      console.log("   SOLUTIONS:");
      console.log("   1. Démarrer Docker:  npm run docker:dev");
      console.log("   2. Ou configurer Supabase dans .env.local:");
      console.log("      DATABASE_URL=postgres://postgres.[project-id]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres");
    }
    
    process.exit(1);
  }
}

main();
