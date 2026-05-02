require('dotenv').config();
const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');

const app = express();
const port = 8888;

const scopes = [
  'playlist-modify-public',
  'playlist-modify-private',
  'playlist-read-private',
  'playlist-read-collaborative'
];

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

app.get('/login', (req, res) => {
  // The 'true' argument forces the Spotify consent dialog to show,
  // guaranteeing the user grants the new modify scopes instead of reusing old ones.
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes, 'handshake', true);
  res.redirect(authorizeURL);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.send('Error: No authorization code returned. Did you cancel?');
  }

  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const refreshToken = data.body['refresh_token'];
    
    console.log('\n\n=========================================');
    console.log('🎉 SUCCESS! Here is your Refresh Token:');
    console.log('=========================================');
    console.log(refreshToken);
    console.log('=========================================\n');
    console.log('Copy the token above and add it to your .env file as:');
    console.log('SPOTIFY_REFRESH_TOKEN=your_copied_token');
    console.log('\n(You can now stop this script by pressing Ctrl+C)');
    
    res.send('Success! Check your terminal for the Refresh Token.');
  } catch (error) {
    console.error('Error getting Tokens:', error);
    res.send(`Error getting tokens: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`\nLocal server running to handle authentication...`);
  console.log(`Please go to your browser and open this exact link to log into the master Spotify account:`);
  console.log(`http://127.0.0.1:${port}/login\n`);
});
