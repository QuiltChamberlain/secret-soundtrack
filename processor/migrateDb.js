const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function migrate() {
  console.log('Migrating documents from root "waitlist" to "campaigns/waitlist/submissions"...');
  const oldRef = db.collection('waitlist');
  const newRef = db.collection('campaigns').doc('waitlist').collection('submissions');

  const snapshot = await oldRef.get();
  
  if (snapshot.empty) {
    console.log('Nothing to migrate.');
    process.exit(0);
  }

  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Copy to new location using same ID (email)
    await newRef.doc(doc.id).set(data);
    // Delete from old location
    await doc.ref.delete();
    console.log(`Migrated user: ${doc.id}`);
  }

  // Also create a placeholder document for the campaign itself so the console shows it nicely
  await db.collection('campaigns').doc('waitlist').set({
    name: 'Main Waitlist',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  console.log('Migration complete!');
  process.exit(0);
}
migrate();
