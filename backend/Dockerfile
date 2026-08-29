FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npx tsc

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
RUN mkdir -p /app/uploads
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
