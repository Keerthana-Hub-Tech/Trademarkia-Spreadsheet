import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Add these

const firebaseConfig = {
  apiKey: "AIzaSyC3hEYvP6TTnzLm-nz0KHXAAFEWEtNUGLQ",
  authDomain: "trademarkia-spreadsheet.firebaseapp.com",
  projectId: "trademarkia-spreadsheet",
  storageBucket: "trademarkia-spreadsheet.firebasestorage.app",
  messagingSenderId: "523999143041",
  appId: "1:523999143041:web:fd74d92e8c6d62de321980"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // Export this for page.tsx
export const provider = new GoogleAuthProvider(); // Export this for the login button