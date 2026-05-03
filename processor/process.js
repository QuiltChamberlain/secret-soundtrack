require('dotenv').config();
const admin = require('firebase-admin');
const SpotifyWebApi = require('spotify-web-api-node');
const { google } = require('googleapis');
const fs = require('fs');
const { getTracks } = require('spotify-url-info')(fetch);
const readline = require('readline/promises');
const Translator = require('./translator');

// Predefined campaigns configuration
const CAMPAIGNS = [
  {
    id: 'waitlist',
    name: 'Main Waitlist',
    prefix: 'Secret Waitlist'
  },
  {
    id: 'demo-swap',
    name: 'Demo Swap (Example)',
    prefix: 'Secret Demo'
  }
];

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

// 4. Initialize YouTube API
let youtube;
if (process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN) {
  const youtubeAuth = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET
  );
  youtubeAuth.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
  });
  youtube = google.youtube({ version: 'v3', auth: youtubeAuth });
} else {
  console.log('⚠️ YouTube API credentials missing in .env. YouTube playlists will not be processed.');
}

const translator = new Translator(db, spotifyApi);

async function processSpotifyPlaylist(user, doc, playlistPrefix) {
  const match = user.playlistUrl.match(/playlist\/([a-zA-Z0-9]+)/);
  if (!match) {
    console.log(`  -> ⚠️ Invalid Spotify URL: ${user.playlistUrl}`);
    return;
  }
  const sourcePlaylistId = match[1];

  let trackUris = [];
  let tracksData = [];
  const cleanUrl = `https://open.spotify.com/playlist/${sourcePlaylistId}`;
  
  console.log(`  -> 📖 Scraping tracks from submitted Spotify playlist...`);
  await new Promise(resolve => setTimeout(resolve, 2000)); // Delay to avoid rate limits
  
  try {
    tracksData = await getTracks(cleanUrl);
    trackUris = tracksData
      .map(track => track.uri)
      .filter(uri => uri);
  } catch (err) {
    console.log(`  -> ⚠️ Could not fetch Spotify playlist: ${err.message}`);
    return;
  }

  if (trackUris.length === 0) {
    console.log(`  -> ⚠️ Playlist is empty or unavailable.`);
    return;
  }

  const username = user.email.split('@')[0];
  const newPlaylistName = `${playlistPrefix} - ${username}`;
  console.log(`  -> 🏗️ Creating new private playlist: "${newPlaylistName}"...`);
  const newPlaylist = await spotifyApi.createPlaylist(newPlaylistName, {
    description: 'Cloned automatically for the Secret Soundtrack exchange.',
    public: false
  });
  console.log(`  -> ✅ Playlist created with ID: ${newPlaylist.body.id}`);

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

  let textPlaylist = tracksData.map((t, index) => {
    const artist = t.artist || 'Unknown';
    return {
      name: t.name || 'Unknown',
      artist: artist,
      album: 'Unknown', // Will be populated by YT translation if available
      link: t.uri ? `https://open.spotify.com/track/${t.uri.split(':').pop()}` : 'Unknown'
    };
  });
  let youtubeUrl = null;
  let translationStats = null;
  let failedTranslations = [];
  let failedInsertions = [];
  
  if (youtube) {
    console.log(`  -> 🔄 Translating tracks to YouTube Music...`);
    const translatedTracks = [];
    
    for (const track of tracksData) {
      const artistName = track.artist || '';
      const durationMs = track.duration || 0;
      const ytResult = await translator.translateSpotifyToYoutube(track.uri, durationMs, track.name, artistName, '');
      translatedTracks.push(ytResult);
      if (!ytResult || !ytResult.id) {
        failedTranslations.push({ title: track.name, artist: artistName, album: '' });
      }
      // Strict Etiquette: 1 second delay between unofficial search queries
      await new Promise(r => setTimeout(r, 1000));
    }
    
    translationStats = translator.getTranslationStats(translatedTracks);
    console.log(`  -> 📊 Translation Stats: ${JSON.stringify(translationStats)}`);
    
    const validYoutubeIds = translatedTracks.filter(t => t !== null && t.id).map(t => t.id);
    
    if (validYoutubeIds.length > 0) {
      console.log(`  -> 📝 Generating YouTube Music tracklist to avoid API quota limits...`);
      const tracklistLines = tracksData.map((t, index) => {
        const ytMatch = translatedTracks[index];
        const artist = (ytMatch && ytMatch.artist && ytMatch.artist !== 'Unknown') ? ytMatch.artist : (t.artist || 'Unknown');
        const album = (ytMatch && ytMatch.album && ytMatch.album !== 'Unknown') ? ytMatch.album : 'Unknown';
        const link = ytMatch && ytMatch.id ? `https://music.youtube.com/watch?v=${ytMatch.id}` : `No YouTube Match`;
        
        textPlaylist[index].artist = artist;
        textPlaylist[index].album = album;
        textPlaylist[index].youtubeLink = link;

        return `${t.name} by ${artist} [Album: ${album}]\n${link}\n`;
      });
      const tracklistFilename = `./youtube_tracklists/${playlistPrefix.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${username}_translated.txt`;
      if (!fs.existsSync('./youtube_tracklists')) {
        fs.mkdirSync('./youtube_tracklists');
      }
      fs.writeFileSync(tracklistFilename, tracklistLines.join('\n'), 'utf8');
      console.log(`  -> ✅ Saved translated YouTube Music links to: ${tracklistFilename}`);
      
      youtubeUrl = `Local File: ${tracklistFilename}`;
      // textPlaylist is already updated above as an array of objects
    }
  }

  await doc.ref.update({
    processedPlaylistUrl: user.playlistUrl,
    clonedPlaylistUrl: newPlaylist.body.external_urls.spotify,
    translatedPlaylistUrl: youtubeUrl,
    textPlaylist: textPlaylist,
    translationStats: translationStats,
    failedTranslations: failedTranslations,
    failedInsertions: failedInsertions,
    lastProcessedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log(`  -> ✅ Marked as processed in database.`);
}

async function processYoutubePlaylist(user, doc, playlistPrefix) {
  if (!youtube) {
    console.log(`  -> ⚠️ Skipping YouTube playlist, credentials not configured.`);
    return;
  }

  const match = user.playlistUrl.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (!match) {
    console.log(`  -> ⚠️ Invalid YouTube URL: ${user.playlistUrl}`);
    return;
  }
  const sourcePlaylistId = match[1];

  console.log(`  -> 📖 Scraping tracks from submitted YouTube playlist...`);
  
  let videoIds = [];
  let pageToken = null;
  try {
    do {
      const res = await youtube.playlistItems.list({
        part: 'contentDetails',
        playlistId: sourcePlaylistId,
        maxResults: 50,
        pageToken: pageToken
      });
      const items = res.data.items;
      for (const item of items) {
        if (item.contentDetails && item.contentDetails.videoId) {
          videoIds.push(item.contentDetails.videoId);
        }
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);
  } catch (err) {
    console.log(`  -> ⚠️ Could not fetch YouTube playlist items: ${err.message}`);
    return;
  }

  if (videoIds.length === 0) {
    console.log(`  -> ⚠️ Playlist is empty or unavailable.`);
    return;
  }

  const username = user.email.split('@')[0];
  const newPlaylistName = `${playlistPrefix} - ${username}`;
  console.log(`  -> 📝 Skipping YouTube clone creation to avoid API limits. Generating tracklist...`);
  
  let failedClonedInsertions = [];

  // Fetch track metadata for translation
  console.log(`  -> 📖 Fetching YouTube video details for translation and tracklist...`);
  const ytTracksData = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    try {
      const vidRes = await youtube.videos.list({
        part: 'snippet,contentDetails',
        id: batch.join(',')
      });
      for (const item of vidRes.data.items) {
        // Parse ISO 8601 duration (e.g. PT4M13S)
        const match = item.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const hours = (parseInt(match[1]) || 0);
        const minutes = (parseInt(match[2]) || 0);
        const seconds = (parseInt(match[3]) || 0);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;

        ytTracksData.push({
          videoId: item.id,
          title: item.snippet.title,
          artist: item.snippet.channelTitle.replace(' - Topic', ''),
          durationSeconds: totalSeconds
        });
      }
    } catch (err) {
      console.log(`  -> ⚠️ Failed to fetch video details: ${err.message}`);
    }
  }

  let spotifyUrl = null;
  let translationStats = null;
  let failedTranslations = [];

  console.log(`  -> 🔄 Translating tracks to Spotify to fetch album metadata...`);
  const translatedTracks = [];
  
  for (const track of ytTracksData) {
    const spResult = await translator.translateYoutubeToSpotify(track.videoId, track.durationSeconds, track.title, track.artist);
    translatedTracks.push(spResult);
    if (!spResult || !spResult.id) {
      failedTranslations.push({ title: track.title, artist: track.artist, videoId: track.videoId });
    }
    // Etiquette: 1 second delay
    await new Promise(r => setTimeout(r, 1000));
  }

  const textPlaylist = ytTracksData.map((t, index) => {
    const spMatch = translatedTracks[index];
    const album = (spMatch && spMatch.album && spMatch.album !== 'Unknown') ? spMatch.album : 'Unknown';
    return {
      name: t.title || 'Unknown',
      artist: t.artist || 'Unknown',
      album: album,
      link: `https://music.youtube.com/watch?v=${t.videoId}`,
      spotifyLink: spMatch && spMatch.id ? `https://open.spotify.com/track/${spMatch.id.split(':').pop()}` : 'No Spotify Match'
    };
  });

  const tracklistLines = ytTracksData.map((t, index) => {
    const spMatch = translatedTracks[index];
    const album = (spMatch && spMatch.album && spMatch.album !== 'Unknown') ? spMatch.album : 'Unknown';
    return `${t.title} by ${t.artist} [Album: ${album}]\nhttps://music.youtube.com/watch?v=${t.videoId}\n`;
  });
  const tracklistFilename = `./youtube_tracklists/${playlistPrefix.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${username}_cloned.txt`;
  if (!fs.existsSync('./youtube_tracklists')) {
    fs.mkdirSync('./youtube_tracklists');
  }
  fs.writeFileSync(tracklistFilename, tracklistLines.join('\n'), 'utf8');
  console.log(`  -> ✅ Saved cloned YouTube Music links to: ${tracklistFilename}`);
  
  const newUrl = `Local File: ${tracklistFilename}`;

  translationStats = translator.getTranslationStats(translatedTracks);
  console.log(`  -> 📊 Translation Stats: ${JSON.stringify(translationStats)}`);
  
  const validSpotifyUris = translatedTracks.filter(t => t !== null && t.id).map(t => t.id);
  
  if (validSpotifyUris.length > 0) {
    console.log(`  -> 🏗️ Creating translated Spotify playlist...`);
    try {
      const spPlaylist = await spotifyApi.createPlaylist(newPlaylistName, {
        description: `Translated from YouTube Music. Accuracy: ${translationStats.success}/${translationStats.total} tracks matched.`,
        public: false
      });
      
      const spPlaylistId = spPlaylist.body.id;
      console.log(`  -> ✅ Translated Playlist created with ID: ${spPlaylistId}`);

      const spBatches = [];
      for (let i = 0; i < validSpotifyUris.length; i += 100) {
        spBatches.push(validSpotifyUris.slice(i, i + 100));
      }
      
      for (const batch of spBatches) {
        console.log(`  -> 📥 Adding batch of ${batch.length} tracks to translated playlist...`);
        const url = `https://api.spotify.com/v1/playlists/${spPlaylistId}/items`;
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
        
        // Etiquette: 1 second delay between batches
        await new Promise(r => setTimeout(r, 1000));
      }
      spotifyUrl = spPlaylist.body.external_urls.spotify;
      console.log(`  -> ✅ Successfully cloned translated playlist into: ${spotifyUrl}`);
    } catch(err) {
      console.log(`  -> ❌ Failed to create translated Spotify playlist: ${err.message}`);
    }
  }

  await doc.ref.update({
    processedPlaylistUrl: user.playlistUrl,
    clonedPlaylistUrl: newUrl,
    translatedPlaylistUrl: spotifyUrl,
    textPlaylist: textPlaylist,
    translationStats: translationStats,
    failedTranslations: failedTranslations,
    failedInsertions: failedClonedInsertions,
    lastProcessedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log(`  -> ✅ Marked as processed in database.`);
}

async function processWaitlist(campaignId, playlistPrefix, rl) {
  console.log('🔄 Refreshing Spotify Access Token...');
  try {
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);
    console.log('✅ Access token refreshed!\n');
  } catch (err) {
    console.error('❌ Could not refresh access token', err);
    return;
  }

  console.log(`\n📥 Retrieve all users from the "${campaignId}" collection`);
  const snapshot = await db.collection('campaigns').doc(campaignId).collection('submissions').get();
  
  if (snapshot.empty) {
    console.log(`No users found in the "${campaignId}" campaign.`);
    return;
  }

  for (const doc of snapshot.docs) {
    const user = doc.data();
    
    // Skip if no playlist URL or if already processed
    if (!user.playlistUrl) {
      continue;
    }
    // We check both the old frontend flag and the new URL comparison
    if (user.processed === true || user.playlistUrl === user.processedPlaylistUrl) {
      const answer = await rl.question(`⏭️  ${user.email} was already processed. Do a fresh pull? (y/N): `);
      if (answer.trim().toLowerCase() !== 'y') {
        console.log(`   Skipping ${user.email}`);
        continue;
      }
    }

    console.log(`\n🎧 Processing user: ${user.email}`);
    
    try {
      if (user.playlistUrl.includes('spotify.com')) {
        await processSpotifyPlaylist(user, doc, playlistPrefix);
      } else if (user.playlistUrl.includes('youtube.com')) {
        await processYoutubePlaylist(user, doc, playlistPrefix);
      } else {
        console.log(`  -> ⚠️ Unsupported playlist URL: ${user.playlistUrl}`);
      }
    } catch (err) {
      console.error(`  -> ❌ Failed to process playlist for ${user.email}:`, err.message);
    }
  }
  
  console.log(`\n🎉 Finished processing campaign: ${campaignId}.`);
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n--- Secret Soundtrack Processor ---');
  console.log('Available Campaigns:');
  CAMPAIGNS.forEach((camp, index) => {
    console.log(`[${index + 1}] ${camp.name} (Prefix: "${camp.prefix}")`);
  });

  let selectedCampaign;
  while (!selectedCampaign) {
    const input = await rl.question(`\nSelect a campaign (1-${CAMPAIGNS.length}): `);
    const choice = parseInt(input.trim(), 10);
    
    if (choice > 0 && choice <= CAMPAIGNS.length) {
      selectedCampaign = CAMPAIGNS[choice - 1];
    } else {
      console.log('⚠️ Invalid selection. Please enter a valid number.');
    }
  }
  
  console.log(`\n▶️ Starting process for: ${selectedCampaign.name} (ID: ${selectedCampaign.id})`);
  await processWaitlist(selectedCampaign.id, selectedCampaign.prefix, rl);
  
  rl.close();
}

main();
