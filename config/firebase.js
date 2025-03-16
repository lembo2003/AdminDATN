// Firebase configuration with Admin SDK using service account
const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');
const { getFirestore } = require('firebase/firestore');
const { getStorage } = require('firebase/storage');

// Firebase Admin SDK
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Firebase configuration for client SDK
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyD_yyFCf3mbCGJjQ2rykJ3edNkFmp-B7UE",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "doan-hotel-lembo.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "doan-hotel-lembo",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "doan-hotel-lembo.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "511258929673",
  appId: process.env.FIREBASE_APP_ID || "1:511258929673:web:632ae4803102791747a6d8",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://doan-hotel-lembo-default-rtdb.asia-southeast1.firebasedatabase.app"
};

console.log("Initializing Firebase with project:", firebaseConfig.projectId);

// Initialize Firebase client SDK
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

// Initialize Firebase Admin SDK with service account
let adminApp;
try {
  // Path to service account file
  const serviceAccountPath = path.join(__dirname, '../service_account.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    console.log("Service account file found, initializing with service account");
    
    // Initialize with service account file
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      storageBucket: firebaseConfig.storageBucket,
      databaseURL: firebaseConfig.databaseURL
    });
    
    console.log("Firebase Admin SDK initialized successfully with service account");
  } else {
    console.warn("Service account file not found at:", serviceAccountPath);
    console.warn("Falling back to application default credentials");
    
    // Initialize with minimal config for development
    adminApp = admin.initializeApp({
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      databaseURL: firebaseConfig.databaseURL
    });
  }
} catch (error) {
  console.error("Error initializing Firebase Admin:", error);
  
  if (error.code === 'app/duplicate-app') {
    console.log("Firebase Admin already initialized, using existing app");
    adminApp = admin.app();
  } else {
    throw error;
  }
}

// Get admin services
const adminFirestore = admin.firestore();
const adminAuth = admin.auth();
const adminStorage = admin.storage();

// Export Firebase services
module.exports = {
  firebaseApp,
  auth,
  firestore,
  storage,
  admin,
  adminFirestore,
  adminAuth,
  adminStorage
};

