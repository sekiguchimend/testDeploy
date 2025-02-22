import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD7dvQ9H-ulkFxg58UZAk2B4vCv6oW_2cU",
  authDomain: "ride-shearing-79e02.firebaseapp.com",
  projectId: "ride-shearing-79e02",
  storageBucket: "ride-shearing-79e02.firebasestorage.app",
  messagingSenderId: "738495270470",
  appId: "1:738495270470:web:170427412f099d044f0447",
  measurementId: "G-4FQ1PYL45M"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export {auth,db};