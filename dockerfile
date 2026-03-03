FROM node:20-alpine

WORKDIR /app/backend

# Install backend dependencies first for better Docker layer caching
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source code
COPY backend/ ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
