const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function check() {
  console.log('Checking root "waitlist" collection...');
  const snapshot = await db.collection('waitlist').get();
  if (snapshot.empty) {
    console.log('Root "waitlist" collection is empty or does not exist.');
  } else {
    console.log(`Found ${snapshot.size} documents in root "waitlist" collection:`);
    snapshot.forEach(doc => {
      console.log(`- ID: ${doc.id}, Data:`, doc.data());
    });
  }
  process.exit(0);
}
check();
