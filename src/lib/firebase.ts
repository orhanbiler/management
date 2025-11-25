import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getAnalytics, Analytics, isSupported } from "firebase/analytics";

// Configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || ""
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let analytics: Analytics | undefined;

// Validate required configuration
function validateConfig(): boolean {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missingFields = requiredFields.filter(
    field => !firebaseConfig[field as keyof typeof firebaseConfig]
  );
  
  if (missingFields.length > 0) {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Firebase configuration incomplete. Missing:', missingFields.join(', '));
    }
    return false;
  }
  return true;
}

// Initialize Firebase
try {
  if (!validateConfig()) {
    throw new Error('Firebase configuration is incomplete');
  }

  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  db = getFirestore(app);
  auth = getAuth(app);
  
  // Only log in development
  if (process.env.NODE_ENV === 'development') {
    console.info("Firebase initialized successfully");
  }

  // Analytics only runs on the client side
  if (typeof window !== "undefined") {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    }).catch(() => {
      // Silently fail - analytics is optional
    });
  }

} catch (error) {
  // Only log detailed error in development
  if (process.env.NODE_ENV === 'development') {
    console.error("Firebase Initialization Error:", error);
  }
  // Re-throw to make it visible
  throw error;
}

export { app, db, auth, analytics };
