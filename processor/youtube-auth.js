require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline/promises');

async function main() {
  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
    console.error('❌ Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET in .env file');
    process.exit(1);
  }

  // Desktop apps often use localhost or a custom port for redirect URIs.
  // Google recommends setting up http://localhost:3000 in your Cloud Console.
  // We'll use http://localhost:3000 here.
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    'http://localhost:3000'
  );

  const scopes = [
    'https://www.googleapis.com/auth/youtube'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // Forces refresh token generation
  });

  console.log('\n======================================');
  console.log('1. Open this URL in your browser:');
  console.log(url);
  console.log('======================================\n');
  console.log('2. Log in with your Master YouTube Account.');
  console.log('3. Grant permissions.');
  console.log('4. The browser will redirect you to http://localhost:3000/?code=...');
  console.log('5. Copy the "code=" parameter from the URL bar (up until the &scope=... if it exists).');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await rl.question('\nPaste the code here: ');
  rl.close();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      console.log('\n⚠️ No refresh token returned. Did you already authorize this app? You might need to remove access from your Google Account settings and try again to force a new refresh token.');
    } else {
      console.log('\n✅ SUCCESS! Save this to your .env file:');
      console.log('\nYOUTUBE_REFRESH_TOKEN=' + tokens.refresh_token + '\n');
    }
  } catch (err) {
    console.error('\n❌ Error retrieving access token', err.message);
  }
}

main();
