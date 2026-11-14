FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY fixtures ./fixtures
ENV PORT=8787
EXPOSE 8787
CMD ["npx","tsx","src/server.ts"]
