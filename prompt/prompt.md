You are my senior backend engineer.  
Generate the complete skeleton of the project **sylion-backend**, following an architecture clean, modular, multi-tenant and ready for WhatsApp + RAG.

## GLOBAL REQUIREMENTS
- Language: TypeScript
- Runtime: Node.js 20+
- Framework: Fastify (preferred) OR Express (if required for stability)
- Style: clean architecture → `app/`, `modules/`, `lib/`, `config/`, `jobs/`, `db/`
- ORM: Drizzle ORM (PostgreSQL)
- Queue system: BullMQ with Redis
- Strict TypeScript config
- Environment config via dotenv + typed config loader
- Prettier + ESLint included
- API ready for future multi-channel messaging (WhatsApp, Web, Voice)
- Testing ready (Jest or Vitest)

## GENERATE THE FOLLOWING STRUCTURE:

sylion-backend/
  package.json
  tsconfig.json
  .env.example
  .gitignore
  docker-compose.yml
  Dockerfile
  README.md

  src/
    app/
      server.ts
      routes.ts
      middlewares/
        errorHandler.ts
        notFoundHandler.ts
        requestLogger.ts
    config/
      index.ts
      env.ts        // strict env loader
    lib/
      logger.ts
      http.ts
      redis.ts
    db/
      drizzle/
        schema.ts
        migrations/
      index.ts
    modules/
      tenant/
        tenant.controller.ts
        tenant.service.ts
        tenant.routes.ts
        tenant.types.ts
      channel/
        channel.controller.ts
        channel.service.ts
        channel.routes.ts
        channel.types.ts
      assistant/
        assistant.controller.ts
        assistant.service.ts
        assistant.routes.ts
        assistant.types.ts
      conversation/
        conversation.controller.ts
        conversation.service.ts
        conversation.routes.ts
        conversation.types.ts
      message/
        message.controller.ts
        message.service.ts
        message.routes.ts
        message.types.ts
    jobs/
      incomingMessages.worker.ts
      index.ts

## CONTENT TO GENERATE

### 1. package.json
Include dependencies:
- fastify
- fastify-cors
- fastify-helmet
- drizzle-orm
- pg
- ioredis
- bullmq
- zod
- pino (for logging)
- dotenv
- ts-node-dev (dev)

Include scripts:
- "dev": "ts-node-dev --respawn src/app/server.ts"
- "build": "tsc"
- "start": "node dist/app/server.js"

### 2. tsconfig.json
- strict mode
- rootDir: src
- outDir: dist
- allowJs: false

### 3. docker-compose.yml
Services:
- api (Dockerfile)
- postgres (15)
- redis (latest)

### 4. server.ts
- Create Fastify instance
- Load middlewares
- Register global routes
- Export start() function

### 5. routes.ts
- Register routes from modules
- Route GET /health

### 6. env.ts
Typed config using Zod:
- PORT
- DATABASE_URL
- REDIS_URL
- NODE_ENV

### 7. logger.ts
- Pino logger configured for dev/prod

### 8. db/index.ts
- connect drizzle ORM to PostgreSQL

### 9. Jobs system (BullMQ)
- incomingMessages.worker.ts
- connection reuse via lib/redis.ts

### 10. Boilerplate for each module
- routes
- controller (req/res)
- service (business logic)
- types (zod)

Each route must be REST-like:
GET /tenants
POST /tenants
GET /channels
POST /channels
etc.

## GOAL
Generate all files with real code, not placeholders.  
The resulting project must run with:
npm install
docker-compose up -d
npm run dev

Start generating the complete project now.
