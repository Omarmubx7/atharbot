# AtharBot Chatbot

A smart chatbot that returns office hours and info for a given name, using data from `office_hours.json`.

## Features
- React frontend (chat UI)
- Node.js/Express backend with fuzzy search (Fuse.js)
- Deployable on GitHub Pages (frontend) and Render/Railway (backend)

---

## Setup

### 1. Backend (API)

- Go to `backend/`
- Install dependencies:
  ```bash
  npm install
  ```
- Start the server (dev):
  ```bash
  npm start
  ```
- The API will run on `http://localhost:3001/api/person?name=...`

#### Deploy Backend (Render)
- Push your code to GitHub.
- Go to [https://render.com/](https://render.com/) and create a new Web Service from your repo.
- Set root directory to `backend`.
- Set build command: `npm install`
- Set start command: `npm start`
- Add `office_hours.json` to the backend folder or update the path in `index.js` if needed.
- Deploy and copy your backend URL.

### 2. Frontend (React)

- Go to `frontend/`
- Install dependencies:
  ```bash
  npm install
  ```
- Start the dev server:
  ```bash
  npm run dev
  ```
- Open [http://localhost:5173](http://localhost:5173)

#### Deploy Frontend (GitHub Pages)
- Build the app:
  ```bash
  npm run build
  ```
- Push the `dist/` folder to the `gh-pages` branch or use a tool like `gh-pages` npm package.
- Set GitHub Pages source to `/frontend/dist` or follow Vite's [GitHub Pages guide](https://vitejs.dev/guide/static-deploy.html#github-pages).

---

## Important
- In `frontend/src/App.jsx`, replace `API_URL` with your deployed backend URL.

---

## Example Usage
- Type a name (e.g., "Sara Falah Mohammed Abdo") in the chat to get all info for that person. 