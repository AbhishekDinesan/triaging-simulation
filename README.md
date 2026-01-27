# Medical Triaging Simulation

An educational web application for medical triaging simulation.

**University of Waterloo — Prof. Abouee-Mehriz & Team**

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase

Create a `.env` file in the project root with your Firebase credentials:

```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

To get these values:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Go to Project Settings > General > Your apps
4. Create a web app and copy the config values
5. Enable Authentication (Email/Password) in the Firebase Console
6. Enable Firestore Database in the Firebase Console

### 3. Run the Application

```bash
npm run dev
```

App runs at `http://localhost:5173/`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run lint` | Check code quality |
| `npm run format` | Format code |
