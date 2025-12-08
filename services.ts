
import { 
  collection, 
  doc, 
  getDoc, 
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
import { MOCK_USERS, MOCK_PROJECTS, MOCK_APPLICATIONS, MOCK_INVOICES, MOCK_MESSAGES, MOCK_NOTIFICATIONS } from './constants';

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
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const userDocRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);

  if (userDoc.exists()) {
      return userDoc.data() as User;
  } else {
      // In production, we do NOT auto-create an empty profile if one is missing,
      // as it would lack required fields like Role or Partner Status.
      throw new Error("User profile not found.");
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

// --- Seed Data (Initialize DB) ---
export const seedDatabase = async () => {
    console.log("Seeding database...");
    const batchPromises = [];

    // Users
    for (const u of MOCK_USERS) {
        batchPromises.push(setDoc(doc(db, 'users', u.id), cleanData(u)));
    }
    // Projects
    for (const p of MOCK_PROJECTS) {
        batchPromises.push(setDoc(doc(db, 'projects', p.id), cleanData(p)));
    }
    // Applications
    for (const a of MOCK_APPLICATIONS) {
        batchPromises.push(setDoc(doc(db, 'applications', a.id), cleanData(a)));
    }
    // Invoices
    for (const i of MOCK_INVOICES) {
        batchPromises.push(setDoc(doc(db, 'invoices', i.id), cleanData(i)));
    }
    // Messages
    for (const m of MOCK_MESSAGES) {
        batchPromises.push(setDoc(doc(db, 'messages', m.id), cleanData(m)));
    }
    // Notifications
    for (const n of MOCK_NOTIFICATIONS) {
        batchPromises.push(setDoc(doc(db, 'notifications', n.id), cleanData(n)));
    }

    await Promise.all(batchPromises);
    console.log("Database seeded successfully!");
};
