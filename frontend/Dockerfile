# KRISHI-AI Frontend Dockerfile
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the app
ARG REACT_APP_API_URL
ARG REACT_APP_ML_SERVICE_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_ML_SERVICE_URL=$REACT_APP_ML_SERVICE_URL
ENV DISABLE_ESLINT_PLUGIN=true
ENV CI=false
ENV GENERATE_SOURCEMAP=false

RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
