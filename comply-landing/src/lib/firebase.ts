import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA2oIY6eBYIOgvpz8k_CIakF7TU9nqIFmk",
  authDomain: "comply-hackep.firebaseapp.com",
  projectId: "comply-hackep",
  storageBucket: "comply-hackep.firebasestorage.app",
  messagingSenderId: "678396803837",
  appId: "1:678396803837:web:e600fe9c6d28096a411c94",
  measurementId: "G-Q24GT1D92S",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export default app;
