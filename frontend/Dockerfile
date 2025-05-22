FROM node:18 AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ARG REACT_APP_API_BASE=http://backend:8000
ENV REACT_APP_API_BASE=$REACT_APP_API_BASE
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
