/**
 * ================================
 * GCP Auth Test Script - Sylion Backend
 * ================================
 * 
 * Script de vérification de l'authentification GCP via ADC.
 * Vérifie que les credentials sont correctement configurés.
 * 
 * Usage: npm run test:gcp
 */

import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' });

async function main() {
  console.log('🔍 GCP AUTHENTICATION DIAGNOSTIC');
  console.log('═══════════════════════════════════════════════════════');
  
  // Vérifier GOOGLE_APPLICATION_CREDENTIALS
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  console.log(`\n📁 GOOGLE_APPLICATION_CREDENTIALS: ${credentialsPath || '❌ NOT SET'}`);
  
  if (!credentialsPath) {
    console.error('\n❌ GOOGLE_APPLICATION_CREDENTIALS is not set in .env.local');
    console.log('\n💡 Fix: Add this line to .env.local:');
    console.log('   GOOGLE_APPLICATION_CREDENTIALS=.secrets/gcp-vertex-dev.json');
    process.exit(1);
  }
  
  // Vérifier que le fichier existe
  const fs = await import('fs');
  const absolutePath = path.resolve(process.cwd(), credentialsPath);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`\n❌ Credentials file not found: ${absolutePath}`);
    console.log('\n💡 Fix: Create the file and paste your GCP service account JSON');
    process.exit(1);
  }
  
  console.log(`✅ Credentials file exists: ${absolutePath}`);
  
  // Vérifier le contenu du fichier JSON
  try {
    const fileContent = fs.readFileSync(absolutePath, 'utf8');
    const credentials = JSON.parse(fileContent);
    
    if (credentials.PLACEHOLDER) {
      console.error('\n❌ Credentials file contains PLACEHOLDER - not configured!');
      console.log('\n💡 Fix: Replace the content of .secrets/gcp-vertex-dev.json');
      console.log('   with your actual GCP service account JSON');
      process.exit(1);
    }
    
    console.log(`\n📋 Service Account Details:`);
    console.log(`   Type:         ${credentials.type || 'unknown'}`);
    console.log(`   Project ID:   ${credentials.project_id || 'unknown'}`);
    console.log(`   Client Email: ${credentials.client_email || 'unknown'}`);
    console.log(`   Key ID:       ${credentials.private_key_id?.slice(0, 8) || 'unknown'}...`);
    
  } catch (error) {
    console.error(`\n❌ Failed to parse credentials file:`, error);
    process.exit(1);
  }
  
  // Tester l'authentification avec GoogleAuth
  console.log('\n🔐 Testing GoogleAuth ADC...');
  
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    
    // Obtenir le client
    const client = await auth.getClient();
    console.log('✅ GoogleAuth client created successfully');
    
    // Obtenir les credentials
    const credentials = await auth.getCredentials();
    console.log(`✅ Credentials loaded: ${credentials.client_email}`);
    
    // Obtenir le project ID
    const projectId = await auth.getProjectId();
    console.log(`✅ Project ID: ${projectId}`);
    
    // Obtenir un access token
    const tokenResponse = await client.getAccessToken();
    if (tokenResponse.token) {
      console.log(`✅ Access token obtained: ${tokenResponse.token.slice(0, 20)}...`);
    } else {
      console.error('❌ Failed to get access token');
      process.exit(1);
    }
    
    // Test Vertex AI endpoint
    console.log('\n🧠 Testing Vertex AI Embedding API...');
    
    const location = process.env.VERTEX_AI_LOCATION || 'us-central1';
    const model = process.env.VERTEX_EMBEDDING_MODEL || 'text-embedding-004';
    const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;
    
    console.log(`   Endpoint: ${apiEndpoint}`);
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResponse.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ content: 'Hello, world!', task_type: 'RETRIEVAL_DOCUMENT' }],
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const embeddingLength = data.predictions?.[0]?.embeddings?.values?.length || 0;
      console.log(`✅ Vertex AI API call successful!`);
      console.log(`   Embedding dimensions: ${embeddingLength}`);
    } else {
      const errorText = await response.text();
      console.error(`❌ Vertex AI API error: ${response.status}`);
      console.error(`   ${errorText.slice(0, 200)}`);
      process.exit(1);
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ ALL GCP AUTHENTICATION TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n🚀 You can now run: npm run load:kb');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Authentication failed:', error);
    process.exit(1);
  }
}

main();
