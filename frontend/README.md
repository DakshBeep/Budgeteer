# Next-gen Budgeteer UI

This is a very small React scaffold demonstrating how a dedicated front-end could interact with the existing FastAPI backend.

```
# install dependencies
npm install

# start dev server
npm start

# create production build
npm run build
```

The app supports login, adding a transaction and listing transactions using Material UI components.

Running `npm run build` outputs static files to `dist/`. These files are served
by the `web` service in `docker-compose.yml` using nginx. You can also serve the
build locally with:

```
npx serve -s dist
```
