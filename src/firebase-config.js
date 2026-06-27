// src/firebase-config.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB7-0tWQSvjn7vnGYIjXzJB88gyYO-jHM",
  authDomain: "taskmates-app.firebaseapp.com",
  projectId: "taskmates-app",
  storageBucket: "taskmates-app.firebasestorage.app",
  messagingSenderId: "336675002474",
  appId: "1:336675002474:web:84db1acab9ce03558b5213",
  measurementId: "G-RD5V7G7Z6M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export services (මේක වැදගත්!)
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;