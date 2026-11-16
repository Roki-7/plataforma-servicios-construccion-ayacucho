FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d AS base
WORKDIR /app

FROM base AS dependencias
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencias AS compilacion
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY contracts ./contracts
RUN npm run build

FROM base AS produccion-dependencias
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=produccion-dependencias --chown=node:node /app/node_modules ./node_modules
COPY --from=compilacion --chown=node:node /app/dist ./dist
COPY --from=compilacion --chown=node:node /app/contracts ./contracts
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/v1/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/src/composicion/main.js"]
