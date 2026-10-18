FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-fund --no-audit && npm cache clean --force
COPY --chown=node:node server.mjs ai.mjs ./
COPY --chown=node:node public ./public
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
