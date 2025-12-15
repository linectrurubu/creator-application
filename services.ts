
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from './firebase';
import { User, UserRole, UserStatus, Notification } from './types';

// --- Helper: Clean Data (Remove undefined) ---
const cleanData = <T extends Record<string, any>>(data: T): T => {
    const cleaned = { ...data };
    Object.keys(cleaned).forEach(key => {
        if (cleaned[key] === undefined) {
            delete cleaned[key];
        }
    });
    return cleaned;
};

// --- Authentication ---

export const signUp = async (email: string, password: string, userData: Partial<User>) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Update Profile Display Name
  await updateProfile(user, {
    displayName: userData.name,
    photoURL: userData.avatarUrl
  });

  // Create User Document in Firestore
  const newUser: User = {
    id: user.uid, // Use Firebase UID
    email: email,
    role: userData.role || UserRole.PARTNER,
    status: userData.status || UserStatus.PENDING,
    name: userData.name || '',
    ...userData
  } as User;

  await setDoc(doc(db, 'users', user.uid), cleanData(newUser));
  return newUser;
};

export const signIn = async (email: string, password: string) => {
  // Firebase認証でログイン
  await signInWithEmailAndPassword(auth, email, password);

  // メールアドレスでユーザーを検索（クリエイターポータルはaddDocで自動IDを使用しているため）
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const userDoc = snapshot.docs[0];
    const userData = { id: userDoc.id, ...userDoc.data() } as User;

    // 案件ポータルへのアクセス権チェック
    if (!userData.jobPortalEnabled) {
      throw new Error("案件ポータルへのアクセス権がありません。クリエイターポータルで認定を完了してください。");
    }

    return userData;
  } else {
    throw new Error("ユーザーが見つかりません。先にクリエイターポータルで登録してください。");
  }
};

export const logOut = async () => {
  await signOut(auth);
};

export const resetPassword = async (email: string) => {
  await sendPasswordResetEmail(auth, email);
};

// --- Database Subscription Helpers ---

export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
  try {
    const q = query(collection(db, collectionName));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      callback(data);
    }, (error) => {
      console.warn(`Permission denied or error fetching ${collectionName}:`, error);
      // Suppress crash, return empty list or handle gracefully
    });
  } catch (error) {
    console.error(`Failed to subscribe to ${collectionName}:`, error);
    return () => {}; // Return no-op unsubscribe
  }
};

export const subscribeToNotifications = (userId: string, callback: (data: Notification[]) => void) => {
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', userId));
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notification));
        data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(data);
      }, (error) => {
        console.warn('Error subscribing to notifications:', error);
      });
    } catch (error) {
       console.error('Failed to subscribe to notifications:', error);
       return () => {};
    }
};

// --- Data Operations ---

export const createDocument = async (collectionName: string, data: any) => {
  const cleanedData = cleanData(data);
  // If data has an ID (like from mock), use setDoc, else addDoc
  if (cleanedData.id && !cleanedData.id.startsWith('temp')) {
      await setDoc(doc(db, collectionName, cleanedData.id), cleanedData);
      return cleanedData;
  } else {
      const docRef = await addDoc(collection(db, collectionName), cleanedData);
      // Update the doc with its own generated ID if needed, or rely on Firestore ID
      const newData = { ...cleanedData, id: docRef.id };
      await updateDoc(docRef, { id: docRef.id });
      return newData;
  }
};

export const updateDocument = async (collectionName: string, docId: string, data: any) => {
  const cleanedData = cleanData(data);
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, cleanedData);
};

// --- Seed Data (Disabled - 統合後はクリエイターポータルでユーザー管理) ---
// export const seedDatabase = async () => { ... }
