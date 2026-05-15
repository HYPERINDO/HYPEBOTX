function normalizeYoutubeUrl(input) {
  if (!input) return null;

  const text = String(input).trim();
  if (!text) return null;

  try {
    const url = new URL(text);

    if (url.hostname === "youtu.be") {
      const videoId = url.pathname.replace("/", "").split("/")[0];
      if (!videoId) return null;

      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    const youtubeHosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"];
    if (youtubeHosts.includes(url.hostname)) {
      const videoId = url.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
      return text;
    }

    return text;
  } catch {
    return null;
  }
}

function isYoutubeUrl(input) {
  if (!input) return false;

  try {
    const url = new URL(String(input).trim());

    return ["youtu.be", "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(
      url.hostname,
    );
  } catch {
    return false;
  }
}

module.exports = {
  normalizeYoutubeUrl,
  isYoutubeUrl,
};
