const admin = require('firebase-admin');
const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config();

const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function main() {
  console.log('🔄 Initializing Spotify API...');
  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
  });

  try {
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);
    console.log('✅ Spotify API ready!\n');
  } catch (err) {
    console.error('❌ Could not authenticate Spotify API', err);
    return;
  }

  console.log('Fetching track_dictionary...');
  const snapshot = await db.collection('track_dictionary').get();
  
  if (snapshot.empty) {
    console.log('Dictionary is empty.');
    return;
  }

  const uniqueSpotifyIds = new Set();
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!data.album) {
      if (data.spotifyId) {
        uniqueSpotifyIds.add(data.spotifyId);
      }
    }
  });

  if (uniqueSpotifyIds.size === 0) {
    console.log('All entries already have album information!');
    return;
  }

  const spIds = Array.from(uniqueSpotifyIds);
  console.log(`Found ${spIds.length} unique Spotify tracks to fetch metadata for...`);
  
  const metadataMap = {};

  let count = 0;
  // Fetch from Spotify one by one to avoid batch errors
  for (const spId of spIds) {
    try {
      const res = await spotifyApi.getTrack(spId);
      const track = res.body;
      if (track) {
        metadataMap[track.id] = {
          title: track.name,
          artist: track.artists.map(a => a.name).join(' '),
          album: track.album ? track.album.name : ''
        };
      }
      count++;
      process.stdout.write(`\rFetched metadata: ${count}/${spIds.length}`);
      await new Promise(r => setTimeout(r, 200)); // Etiquette
    } catch (err) {
      console.error(`\n❌ Failed to fetch Spotify track ${spId}:`, err.message);
    }
  }

  console.log('\nUpdating Firestore documents...');
  const batchWrite = db.batch();
  let operations = 0;
  let totalUpdated = 0;

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!data.album) {
      if (data.spotifyId && metadataMap[data.spotifyId]) {
        const meta = metadataMap[data.spotifyId];
        const ref = db.collection('track_dictionary').doc(doc.id);
        
        batchWrite.update(ref, {
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          lastMatchedAt: new Date().toISOString()
        });
        
        operations++;
        totalUpdated++;
      }
    }
  });

  if (operations > 0) {
    await batchWrite.commit();
  }

  console.log(`✅ Successfully updated ${totalUpdated} dictionary entries with Album data!`);
  process.exit(0);
}

main();
