import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getAnalytics, Analytics, isSupported } from "firebase/analytics";

// Configuration with trimmed strings to prevent whitespace issues
const firebaseConfig = {
  apiKey: "AIzaSyAOjGKgBg7zgsCXSjn6xfY-MysuADjoRZc",
  authDomain: "management-86d22.firebaseapp.com",
  projectId: "management-86d22",
  storageBucket: "management-86d22.firebasestorage.app",
  messagingSenderId: "128821899408",
  appId: "1:128821899408:web:3ea753a6a6bd27f96c6815",
  measurementId: "G-3HMD9BMN5Y"
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let analytics: Analytics | undefined;

// Initialize Firebase
try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  db = getFirestore(app);
  auth = getAuth(app);
  
  console.log("Firebase initialized successfully with Project ID:", firebaseConfig.projectId);

  // Analytics only runs on the client side
  if (typeof window !== "undefined") {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    }).catch(err => console.warn("Analytics support check failed", err));
  }

} catch (error) {
  console.error("Critical Firebase Initialization Error:", error);
  // Re-throw to make it visible
  throw error;
}

export { app, db, auth, analytics };
