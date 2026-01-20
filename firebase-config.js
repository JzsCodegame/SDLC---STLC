// Firebase configuration and initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDPuofAGrJ3vG4_5PQqxDptbqNN9Icecmo",
  authDomain: "miniquizacademy.firebaseapp.com",
  projectId: "miniquizacademy",
  storageBucket: "miniquizacademy.firebasestorage.app",
  messagingSenderId: "150545053086",
  appId: "1:150545053086:web:667d671cc5aa3dae60128f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Load questions from Firestore
export async function loadQuestionsFromFirestore() {
  try {
    const questionsCollection = collection(db, 'questions');
    const querySnapshot = await getDocs(questionsCollection);
    
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
  try {
    const scoresCollection = collection(db, 'scores');
    await addDoc(scoresCollection, {
      studentName,
      score,
      total,
      percent,
      timestamp: serverTimestamp()
    });
    console.log('Score saved to Firestore successfully');
    return true;
  } catch (error) {
    console.error('Error saving score to Firestore:', error);
    return false;
  }
}
