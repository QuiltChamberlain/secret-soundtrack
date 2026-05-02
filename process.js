require('dotenv').config();
const admin = require('firebase-admin');
const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const { getTracks } = require('spotify-url-info')(fetch);

// 1. Verify Firebase Admin Key Exists
if (!fs.existsSync('./serviceAccountKey.json')) {
  console.error('\n❌ ERROR: Missing serviceAccountKey.json');
  console.error('Please download it from Firebase Console (Project Settings -> Service Accounts -> Generate new private key)');
  console.error('and save it in this folder as serviceAccountKey.json\n');
  process.exit(1);
}

// 2. Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 3. Initialize Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
  refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
});

async function processWaitlist() {
  console.log('🔄 Refreshing Spotify Access Token...');
  try {
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);
    console.log('✅ Access token refreshed!\n');
  } catch (err) {
    console.error('❌ Could not refresh access token', err);
    return;
  }

  console.log('📥 Fetching waitlist from Firestore...');
  const snapshot = await db.collection('waitlist').get();
  
  if (snapshot.empty) {
    console.log('No users found in the waitlist.');
    return;
  }

  for (const doc of snapshot.docs) {
    const user = doc.data();
    
    // Skip if no playlist URL or if already processed
    if (!user.playlistUrl) {
      continue;
    }
    if (user.processed) {
      console.log(`⏭️  Skipping ${user.email} (Already processed)`);
      continue;
    }

    console.log(`\n🎧 Processing user: ${user.email}`);
    
    try {
      // Extract Playlist ID from URL (e.g. https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M)
      const match = user.playlistUrl.match(/playlist\/([a-zA-Z0-9]+)/);
      if (!match) {
        console.log(`  -> ⚠️ Invalid Spotify URL: ${user.playlistUrl}`);
        continue;
      }
      const sourcePlaylistId = match[1];

      let trackUris = [];
      const cleanUrl = `https://open.spotify.com/playlist/${sourcePlaylistId}`;
      
      console.log(`  -> 📖 Scraping tracks from submitted Spotify playlist...`);
      // Add a 2-second delay to avoid rate limiting from frequent scrapes
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const tracksData = await getTracks(cleanUrl);
      trackUris = tracksData
        .map(track => track.uri)
        .filter(uri => uri); // remove nulls in case of local tracks

      if (trackUris.length === 0) {
        console.log(`  -> ⚠️ Playlist is empty or unavailable.`);
        continue;
      }

      // Create a new playlist in the Master Account
      const newPlaylistName = `Secret Soundtrack Submission - ${user.email}`;
      console.log(`  -> 🏗️ Creating new private playlist: "${newPlaylistName}"...`);
      const newPlaylist = await spotifyApi.createPlaylist(newPlaylistName, {
        description: 'Cloned automatically for the Secret Soundtrack exchange.',
        public: false
      });
      console.log(`  -> ✅ Playlist created with ID: ${newPlaylist.body.id}`);

      // Add the tracks to our new cloned playlist (Spotify API limits 100 per request)
      const batches = [];
      for (let i = 0; i < trackUris.length; i += 100) {
        batches.push(trackUris.slice(i, i + 100));
      }
      
      for (const batch of batches) {
        console.log(`  -> 📥 Adding batch of ${batch.length} tracks to playlist...`);
        const url = `https://api.spotify.com/v1/playlists/${newPlaylist.body.id}/items`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${spotifyApi.getAccessToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uris: batch })
        });
        
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Spotify API Error: ${res.status} ${res.statusText} - ${errText}`);
        }
      }

      console.log(`  -> ✅ Successfully cloned into: ${newPlaylist.body.external_urls.spotify}`);

      // Mark user as processed in Firestore and save the new cloned link
      await doc.ref.update({
        processed: true,
        clonedPlaylistUrl: newPlaylist.body.external_urls.spotify
      });
      console.log(`  -> ✅ Marked as processed in database.`);
      
    } catch (err) {
      console.error(`  -> ❌ Failed to process playlist for ${user.email}:`, err.message);
    }
  }
  
  console.log('\n🎉 Finished processing waitlist.');
}

processWaitlist();
