const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function reset() {
  const snapshot = await db.collection('campaigns').doc('waitlist').collection('submissions').get();
  for (const doc of snapshot.docs) {
    await doc.ref.update({
      processed: false,
      processedPlaylistUrl: admin.firestore.FieldValue.delete(),
      translatedPlaylistUrl: admin.firestore.FieldValue.delete(),
      clonedPlaylistUrl: admin.firestore.FieldValue.delete(),
      translationStats: admin.firestore.FieldValue.delete()
    });
  }
  console.log('Reset all waitlist entries to unprocessed!');
  process.exit(0);
}
reset();
