# DVLA IDP backend — Express + Prisma (PostgreSQL)
FROM node:20-bookworm-slim

# Prisma query engine needs OpenSSL at build and runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Skip husky during image build (no .git in the build context)
ENV HUSKY=0

# Install all deps (dev deps are needed to compile TS and run the seed)
COPY package.json package-lock.json ./
RUN npm ci

# App source
COPY . .

# Generate the Prisma client and compile TS -> dist/
RUN npx prisma generate && npm run build

# Uploads live on a mounted volume; ensure the mount point exists
RUN mkdir -p uploads && chmod +x entrypoint.sh

ENV NODE_ENV=production
EXPOSE 5000

# Applies migrations (prisma migrate deploy) then starts the server
CMD ["./entrypoint.sh"]
