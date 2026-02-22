import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  initializeAuth,
  browserPopupRedirectResolver,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA2oIY6eBYIOgvpz8k_CIakF7TU9nqIFmk",
  authDomain: "comply-hackep.firebaseapp.com",
  projectId: "comply-hackep",
  storageBucket: "comply-hackep.firebasestorage.app",
  messagingSenderId: "678396803837",
  appId: "1:678396803837:web:e600fe9c6d28096a411c94",
  measurementId: "G-Q24GT1D92S",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// In Next.js the module can be evaluated on the server (SSR) where browser
// APIs are unavailable. On the client we use initializeAuth with explicit
// browser persistence + popup/redirect resolver so signInWithPopup works
// reliably. The try/catch handles HMR re-evaluations where auth is already
// initialised.
let auth: Auth;
if (typeof window !== "undefined") {
  try {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Auth was already initialised (e.g. HMR), just retrieve it
    auth = getAuth(app);
  }
} else {
  auth = getAuth(app);
}

export { auth };
export default app;
