const YTMusic = require('ytmusic-api');

async function test() {
  const ytmusic = new YTMusic();
  await ytmusic.initialize();

  const musics = await ytmusic.searchSongs('Never Gonna Give You Up');
  console.log(musics[0]);
}
test();
