import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
    projectId: "secret-soundtrack-app",
    appId: "1:270844009843:web:22b0a53342ffc72d52f906",
    storageBucket: "secret-soundtrack-app.firebasestorage.app",
    apiKey: "AIzaSyB92qihLjxIX7A1c22Qy42P_BYCDGELb5E",
    authDomain: "secret-soundtrack-app.firebaseapp.com",
    messagingSenderId: "270844009843"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.db = db;
window.doc = doc;
window.setDoc = setDoc;
window.serverTimestamp = serverTimestamp;

window.submitToWaitlist = async (email, playlistUrl, sourceTheme) => {
    if (!db) throw new Error("Firebase not initialized");
    const docRef = doc(db, 'campaigns', 'waitlist', 'submissions', email.toLowerCase());
    await setDoc(docRef, {
        email: email,
        playlistUrl: playlistUrl || '',
        lastUpdatedAt: serverTimestamp(),
        source: sourceTheme
    }, { merge: true });
};
