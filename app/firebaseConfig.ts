import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC3hEYvP6TTnzLm-nz0KHXAAFEWtNUGLQ",
  authDomain: "trademarkia-spreadsheet.firebaseapp.com",
  projectId: "trademarkia-spreadsheet",
  storageBucket: "trademarkia-spreadsheet.firebasestorage.app",
  messagingSenderId: "523999143041",
  appId: "1:523999143041:web:fd74d92e8c6d62de321980"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the database so page.tsx can see it
export const db = getFirestore(app);