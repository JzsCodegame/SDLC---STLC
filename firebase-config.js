// Firebase configuration and initialization
// This module provides Firebase Firestore integration with graceful fallback

let firestoreReady = false;
let firestoreModule = null;

// Initialize Firebase
async function initializeFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const firestoreImports = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    const firebaseConfig = {
      apiKey: "AIzaSyDPuofAGrJ3vG4_5PQqxDptbqNN9Icecmo",
      authDomain: "miniquizacademy.firebaseapp.com",
      projectId: "miniquizacademy",
      storageBucket: "miniquizacademy.firebasestorage.app",
      messagingSenderId: "150545053086",
      appId: "1:150545053086:web:667d671cc5aa3dae60128f"
    };

    const app = initializeApp(firebaseConfig);
    const db = firestoreImports.getFirestore(app);
    
    firestoreModule = {
      db,
      collection: firestoreImports.collection,
      getDocs: firestoreImports.getDocs,
      addDoc: firestoreImports.addDoc,
      serverTimestamp: firestoreImports.serverTimestamp
    };
    
    firestoreReady = true;
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.log('Firebase not available, using fallback mode');
    firestoreReady = false;
  }
}

// Initialize on module load
const initPromise = initializeFirebase();

// Load questions from Firestore
export async function loadQuestionsFromFirestore() {
  await initPromise;
  
  if (!firestoreReady || !firestoreModule) {
    return null;
  }
  
  try {
    const questionsCollection = firestoreModule.collection(firestoreModule.db, 'questions');
    const querySnapshot = await firestoreModule.getDocs(questionsCollection);
    
    const questions = [];
    querySnapshot.forEach((doc) => {
      questions.push(doc.data());
    });
    
    return questions;
  } catch (error) {
    console.error('Error loading questions from Firestore:', error);
    return null;
  }
}

// Save score to Firestore
export async function saveScoreToFirestore(studentName, score, total, percent) {
  await initPromise;
  
  // Validate inputs
  if (!studentName || typeof studentName !== 'string' || studentName.trim() === '') {
    console.error('Invalid student name provided');
    return false;
  }
  
  if (typeof score !== 'number' || typeof total !== 'number' || typeof percent !== 'number') {
    console.error('Invalid score values provided');
    return false;
  }
  
  if (score < 0 || total < 0 || percent < 0 || percent > 100) {
    console.error('Score values out of valid range');
    return false;
  }
  
  if (!firestoreReady || !firestoreModule) {
    console.log('Firebase not available, score not saved to Firestore');
    return false;
  }
  
  try {
    const scoresCollection = firestoreModule.collection(firestoreModule.db, 'scores');
    await firestoreModule.addDoc(scoresCollection, {
      studentName: studentName.trim(),
      score,
      total,
      percent,
      timestamp: firestoreModule.serverTimestamp()
    });
    console.log('Score saved to Firestore successfully');
    return true;
  } catch (error) {
    console.error('Error saving score to Firestore:', error);
    return false;
  }
}
