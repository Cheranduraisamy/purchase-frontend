# Stage 1: Build the Angular application
FROM node:18-alpine AS build
WORKDIR /app
# Copy package.json and package-lock.json first to cache dependencies
COPY package.json package-lock.json ./
# Install dependencies
RUN npm install
# Copy the rest of the application code
COPY . .
# Build the Angular application for production
RUN npm run build -- --configuration production

# Stage 2: Serve the Angular application with Nginx
FROM nginx:stable-alpine
# Copy the custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
# Copy the built Angular application from the build stage to the Nginx web root
COPY --from=build /app/dist/purchase-frontend /usr/share/nginx/html
# Expose the port Nginx is listening on
EXPOSE 8080
# Command to start Nginx
CMD ["nginx", "-g", "daemon off;"]
