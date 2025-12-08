
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// import { getAnalytics } from "firebase/analytics";

// ------------------------------------------------------------------
// Firebase設定 (ユーザー提供の有効な設定値)
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyC6gdLBtE_jbS9-23P7NdLHQlf4rb9aRDA",
  authDomain: "creator-application-cfbb8.firebaseapp.com",
  projectId: "creator-application-cfbb8",
  storageBucket: "creator-application-cfbb8.firebasestorage.app",
  messagingSenderId: "780098994138",
  appId: "1:780098994138:web:6865b6e7d4351c77848ae3",
  measurementId: "G-NMME1D6WGM"
};

// Firebaseアプリの初期化
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // 必要に応じて有効化してください

// サービスの初期化とエクスポート
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 接続確認用ログ
console.log("Firebase initialized:", app.name);
