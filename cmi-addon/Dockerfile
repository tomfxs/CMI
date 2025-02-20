FROM node:18-slim

# Installiere Abhängigkeiten
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# Kopiere den Quellcode
COPY index.js /app/index.js
COPY const.js /app/const.js
COPY run.sh /app/run.sh

# Setze Berechtigungen und den Startbefehl
RUN chmod +x /app/run.sh
CMD ["/app/run.sh"]
