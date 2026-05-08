FROM node:22-alpine

WORKDIR /app

COPY . .

RUN npm init -y >/dev/null 2>&1 || true
RUN npm pkg set scripts.publish-students="node scripts/publish-students.js" >/dev/null 2>&1 || true

EXPOSE 8080

CMD ["npx", "serve", ".", "-l", "8080"]
