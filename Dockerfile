# Stage 1: Build the Angular application
FROM node:20-alpine AS build
WORKDIR /app
# Copy package.json and package-lock.json first to cache dependencies
COPY package.json package-lock.json ./
# Install dependencies
RUN npm install
# Copy the rest of the application code
COPY . .
# Build the Angular application for production
RUN npm run build -- --configuration production
# Debug: List the build output structure
RUN find dist/ -type f -name "index.html" || echo "No index.html found"
RUN ls -la dist/ || echo "No dist directory"

# Stage 2: Serve the Angular application with Nginx
FROM nginx:stable-alpine
# Copy the custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*
# Copy all dist contents and find the right structure
COPY --from=build /app/dist/ /tmp/dist/
# Find and copy the actual Angular files to nginx html directory
RUN if [ -d "/tmp/dist/purchase-frontend/browser" ]; then \
      cp -r /tmp/dist/purchase-frontend/browser/* /usr/share/nginx/html/; \
    elif [ -d "/tmp/dist/purchase-frontend" ]; then \
      cp -r /tmp/dist/purchase-frontend/* /usr/share/nginx/html/; \
    else \
      cp -r /tmp/dist/* /usr/share/nginx/html/; \
    fi
# Debug: List what's in nginx html directory
RUN ls -la /usr/share/nginx/html/
# Expose the port Nginx is listening on
EXPOSE 8080
# Command to start Nginx
CMD ["nginx", "-g", "daemon off;"]
