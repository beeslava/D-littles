import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
apiKey: 'AIzaSyBy2khuIYakyubDuR5NxBPJ4LfuiuXmSfY',
authDomain: 'dlittles-7769b.firebaseapp.com',
databaseURL: 'https://dlittles-7769b-default-rtdb.firebaseio.com',
projectId: 'dlittles-7769b',
storageBucket: 'dlittles-7769b.firebasestorage.app',
messagingSenderId: '152504530063',
appId: '1:152504530063:web:909c791bd6e4b204faecfa'
};

export const firebaseApp = initializeApp(firebaseConfig);

export const database = getDatabase(firebaseApp);

export const auth = getAuth(firebaseApp);
