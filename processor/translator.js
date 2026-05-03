const YTMusic = require('ytmusic-api');

function scrubTitle(title) {
  // Remove common extra tags from titles to improve cross-platform matching
  return title
    .replace(/\([^)]*remaster[^)]*\)/gi, '') // (Remastered...)
    .replace(/\[[^\]]*remaster[^\]]*\]/gi, '') // [Remastered...]
    .replace(/\([^)]*official[^)]*\)/gi, '') // (Official Music Video)
    .replace(/\[[^\]]*official[^\]]*\]/gi, '') // [Official Music Video]
    .replace(/\([^)]*lyric[^)]*\)/gi, '') // (Lyric Video)
    .replace(/\[[^\]]*lyric[^\]]*\]/gi, '') // [Lyric Video]
    .replace(/\([^)]*audio[^)]*\)/gi, '') // (Audio)
    .replace(/\[[^\]]*audio[^\]]*\]/gi, '') // [Audio]
    .replace(/\([^)]*video[^)]*\)/gi, '') // (Video)
    .replace(/\[[^\]]*video[^\]]*\]/gi, '') // [Video]
    .replace(/- \s*radio edit/gi, '') // - Radio Edit
    .replace(/- \s*remaster/gi, '') // - Remaster
    .replace(/- \s*single version/gi, '') // - Single Version
    .trim();
}

class Translator {
  constructor(db, spotifyApi) {
    this.db = db;
    this.spotifyApi = spotifyApi;
    this.dictionaryRef = db.collection('track_dictionary');
    this.ytmusic = new YTMusic();
    this.ytmusicInitialized = false;
  }

  async initYTMusic() {
    if (!this.ytmusicInitialized) {
      await this.ytmusic.initialize();
      this.ytmusicInitialized = true;
    }
  }

  async getDictEntry(key) {
    const doc = await this.dictionaryRef.doc(key).get();
    if (doc.exists) {
      return doc.data();
    }
    return null;
  }

  async saveDictEntry(spotifyId, youtubeId, title = 'Unknown', artist = 'Unknown', album = '') {
    const payload = {
      youtubeId,
      spotifyId,
      title,
      artist,
      lastMatchedAt: new Date().toISOString()
    };
    if (album) payload.album = album;
    // Save under both keys for bi-directional lookup
    await this.dictionaryRef.doc(spotifyId).set(payload, { merge: true });
    await this.dictionaryRef.doc(youtubeId).set(payload, { merge: true });
  }

  async translateSpotifyToYoutube(spotifyTrackUri, expectedDurationMs, title, artist, album) {
    await this.initYTMusic();
    const trackId = spotifyTrackUri.split(':').pop();
    
    // 1. Check Dictionary
    const dictEntry = await this.getDictEntry(trackId);
    if (dictEntry && dictEntry.youtubeId) {
      return { id: dictEntry.youtubeId, method: 'dictionary', title: dictEntry.title, artist: dictEntry.artist, album: dictEntry.album };
    }

    // 2. Fetch full Spotify metadata if we only have the URI
    let isrc = null;
    let durationMs = expectedDurationMs;
    let trackTitle = title;
    let trackArtist = artist;
    let trackAlbum = album || '';

    try {
      if (!title || !expectedDurationMs) {
        const trackData = await this.spotifyApi.getTrack(trackId);
        isrc = trackData.body.external_ids?.isrc;
        durationMs = trackData.body.duration_ms;
        trackTitle = trackData.body.name;
        trackArtist = trackData.body.artists.map(a => a.name).join(' ');
        trackAlbum = trackData.body.album?.name || '';
      }
    } catch(e) {
      console.log(`    ⚠️ Failed to fetch Spotify details for ${trackId}`);
      if (!title) return null; // We have no title to search with
    }

    const expectedSeconds = Math.round(durationMs / 1000);

    // 3. Search by ISRC
    if (isrc) {
      try {
        const results = await this.ytmusic.searchSongs(isrc);
        if (results && results.length > 0) {
          for (const res of results.slice(0, 3)) {
            if (res.duration) {
              const diff = Math.abs(res.duration - expectedSeconds);
              if (diff <= 3) {
                await this.saveDictEntry(trackId, res.videoId, trackTitle, trackArtist, trackAlbum);
                return { id: res.videoId, method: 'isrc', title: trackTitle, artist: trackArtist, album: trackAlbum };
              }
            }
          }
        }
      } catch (err) {
        console.log(`    ⚠️ YTMusic ISRC search error for ${trackTitle}: ${err.message}`);
      }
    }

    // 4. Search by scrubbed title
    const scrubbedTitle = scrubTitle(trackTitle);
    const query = `${scrubbedTitle} ${trackArtist}`;
    
    try {
      const results = await this.ytmusic.searchSongs(query);

      if (results && results.length > 0) {
        for (const res of results.slice(0, 5)) {
          if (res.duration) {
            const diff = Math.abs(res.duration - expectedSeconds);
            if (diff <= 5) {
              await this.saveDictEntry(trackId, res.videoId, trackTitle, trackArtist, trackAlbum);
              return { id: res.videoId, method: 'title_duration', title: trackTitle, artist: trackArtist, album: trackAlbum };
            }
          }
        }
      }
    } catch (err) {
      console.log(`    ⚠️ YTMusic title search error for ${trackTitle}: ${err.message}`);
    }

    return null;
  }

  async translateYoutubeToSpotify(youtubeId, expectedSeconds, title, artist, album = '') {
    // 1. Check dictionary
    const dictEntry = await this.getDictEntry(youtubeId);
    if (dictEntry && dictEntry.spotifyId) {
      return { id: `spotify:track:${dictEntry.spotifyId}`, method: 'dictionary', title: dictEntry.title, artist: dictEntry.artist, album: dictEntry.album };
    }

    // 2. Scrub title and search Spotify
    const scrubbedTitle = scrubTitle(title);
    const strictQuery = `track:${scrubbedTitle} artist:${artist}`;
    
    try {
      const res = await this.spotifyApi.searchTracks(strictQuery, { limit: 10 });
      const tracks = res.body.tracks.items;

      for (const track of tracks) {
        const diff = Math.abs((track.duration_ms / 1000) - expectedSeconds);
        if (diff <= 3) {
          await this.saveDictEntry(track.id, youtubeId, title, artist, track.album?.name || album);
          return { id: track.uri, method: 'title_duration', title: title, artist: artist, album: track.album?.name || album };
        }
      }

      // If strict search fails, try a looser query
      const looserQuery = `${scrubbedTitle} ${artist}`;
      const looserRes = await this.spotifyApi.searchTracks(looserQuery, { limit: 5 });
      for (const track of looserRes.body.tracks.items) {
         const diff = Math.abs((track.duration_ms / 1000) - expectedSeconds);
         if (diff <= 5) {
            await this.saveDictEntry(track.id, youtubeId, title, artist, track.album?.name || album);
            return { id: track.uri, method: 'loose_title_duration', title: title, artist: artist, album: track.album?.name || album };
         }
      }
      
      // Fallback: If no duration match, just grab the album from the first strict result
      if (tracks.length > 0) {
        return { id: null, method: 'fallback_album', title: title, artist: artist, album: tracks[0].album?.name || album };
      }
      // Or from the first loose result
      if (looserRes.body.tracks.items.length > 0) {
        return { id: null, method: 'fallback_album', title: title, artist: artist, album: looserRes.body.tracks.items[0].album?.name || album };
      }
    } catch(e) {
      console.log(`    ⚠️ Spotify search failed for ${youtubeId}: ${e.message}`);
    }

    return null;
  }

  getTranslationStats(results) {
    const stats = {
      total: results.length,
      success: 0,
      dictionary: 0,
      isrc: 0,
      title_duration: 0,
      loose_title_duration: 0,
      failed: 0
    };

    results.forEach(res => {
      if (!res || !res.id) {
        stats.failed++;
      } else {
        stats.success++;
        if (stats[res.method] !== undefined) {
          stats[res.method]++;
        }
      }
    });

    return stats;
  }
}

module.exports = Translator;
