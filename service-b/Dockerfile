FROM node:18 AS build

WORKDIR /app

# Build native modules (sqlite3) from source to match the container's glibc.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --build-from-source

COPY . .

FROM node:18

WORKDIR /app
COPY --from=build /app /app

ENV SQLITE_PATH=/app/data/medical.db
RUN mkdir -p /app/data

CMD ["node", "server.js"]