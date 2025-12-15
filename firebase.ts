
import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// import { getAnalytics } from "firebase/analytics";

// ------------------------------------------------------------------
// Firebase設定 (クリエイターポータルと統合 - creator-hub-test)
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAfpFyNmZxIjzTbPMhk5WIGW0dOsQ40HLg",
  authDomain: "creator-hub-test.firebaseapp.com",
  projectId: "creator-hub-test",
  storageBucket: "creator-hub-test.firebasestorage.app",
  messagingSenderId: "976183984796",
  appId: "1:976183984796:web:8b4ef66e7afc56df97e359",
  measurementId: "G-3BH9XFY2J6"
};

// Firebaseアプリの初期化
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // 必要に応じて有効化してください

// サービスの初期化とエクスポート
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// セッション永続化設定（ブラウザを閉じてもログイン状態を維持）
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Firebase Auth persistence set to LOCAL");
  })
  .catch((error) => {
    console.error("Failed to set persistence:", error);
  });

// 接続確認用ログ
console.log("Firebase initialized:", app.name);
