const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} = require("@discordjs/voice");
const { spawn } = require("node:child_process");
const play = require("play-dl");
const ytdlCore = require("@distube/ytdl-core");
const ffmpegPath = require("ffmpeg-static");

const { normalizeYoutubeUrl, isYoutubeUrl } = require("../utils/youtubeUrl");

const { createDiscordWebhookConsoleLogger } = require("../utils/discordWebhookConsoleLogger");

function createMusicService({ botConfig, logger, loggingService }) {
  const webhookUrl = process.env.MUSIC_DEBUG_WEBHOOK_URL || "";
  const musicWebhookLogger = webhookUrl
    ? createDiscordWebhookConsoleLogger({ webhookUrl, scope: "music-webhook" })
    : {
      info() { return null; },
      warn() { return null; },
      error() { return null; },
    };

  if (webhookUrl) {
    logger.info("music webhook debug enabled", { configured: true });
  }
  const queues = new Map();

  function stopStreamProcess(queue, reason = "unknown") {
    if (!queue?.streamProcess) return;

    try {
      const processRef = queue.streamProcess;
      queue.streamProcess = null;

      if (!processRef.killed && typeof processRef.kill === "function") {
        processRef.kill();
      }
      logger.info("music external stream process stopped", {
        guildId: queue.guildId,
        reason,
      });
    } catch (error) {
      logger.warn("music external stream process stop failed", {
        guildId: queue.guildId,
        reason,
        error: error.message,
      });
    }
  }

  function getQueue(guildId) {
    return queues.get(guildId) || null;
  }

  function destroyQueue(guildId) {
    const queue = queues.get(guildId);
    if (queue) {
      stopStreamProcess(queue, "destroy-queue");
      queue.player.stop();
      queue.connection.destroy();
      queues.delete(guildId);
    }
  }

  async function createQueue(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      throw new Error("Kamu harus masuk voice channel dulu.");
    }

    const existing = getQueue(interaction.guild.id);
    if (existing) {
      if (existing.voiceChannelId !== voiceChannel.id) {
        throw new Error("Bot sedang aktif di voice channel lain. Masuk ke channel yang sama dulu.");
      }

      return existing;
    }

    const connection = joinVoiceChannel({
      guildId: interaction.guild.id,
      channelId: voiceChannel.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });

    connection.subscribe(player);

    const queue = {
      guildId: interaction.guild.id,
      textChannelId: interaction.channel.id,
      voiceChannelId: voiceChannel.id,
      voiceChannel,
      connection,
      player,
      resource: null,
      tracks: [],
      current: null,
      volume:
        typeof botConfig?.music?.defaultVolume === "number"
          ? botConfig.music.defaultVolume
          : 0.8,
      loop: false,
      idleSince: null,
      streamProcess: null,
    };

    // More detailed status logs (for debugging audio not playing)
    player.on(AudioPlayerStatus.Playing, () => {
      logger.info("music player status: PLAYING", { guildId: interaction.guild.id, channelId: voiceChannel.id });
      musicWebhookLogger.info("music player status: PLAYING", { guildId: interaction.guild.id, channelId: voiceChannel.id });
      queue.idleSince = null;
    });

    player.on("stateChange", (oldState, newState) => {
      try {
        logger.info("music player stateChange", {
          guildId: interaction.guild.id,
          old: oldState.status,
          new: newState.status,
        });
      } catch (_) {
        // ignore logging
      }
    });

    player.on(AudioPlayerStatus.Paused, () => {
      logger.warn("music player status: PAUSED", { guildId: interaction.guild.id });
    });

    player.on(AudioPlayerStatus.AutoPaused, () => {
      try {
        logger.info("music player status: AUTOPAUSED", { guildId: interaction.guild.id });

        const queue = queues.get(interaction.guild.id);
        if (!queue?.voiceChannel) return;

        const voiceChannel = queue.voiceChannel;
        const humanListeners = voiceChannel.members.filter((member) => !member.user.bot);

        if (humanListeners.size === 0) {
          logger.info("music autopaused because no human listeners", {
            guildId: interaction.guild.id,
            voiceChannelId: voiceChannel.id,
          });
          return;
        }

        queue.player.unpause();
      } catch (error) {
        logger.warn("music failed to unpause after autopaused", {
          guildId: interaction.guild.id,
          message: error.message,
        });
      }
    });

    player.on(AudioPlayerStatus.Buffering, () => {
      logger.info("music player status: BUFFERING", { guildId: interaction.guild.id });
    });

    player.on(AudioPlayerStatus.Idle, () => {
      logger.info("music player status: IDLE", { guildId: interaction.guild.id });
      stopStreamProcess(queue, "player-idle");
      queue.idleSince = Date.now();
      if (queue.loop && queue.current) {
        queue.tracks.push(queue.current);
      }
      queue.current = null;
      playNext(interaction.guild.id).catch((error) => logger.error("music idle next failed", { error: error.message }));
    });

    player.on("error", async (error) => {
      logger.error("music player error", { guildId: interaction.guild.id, error: error.message });
      await loggingService?.logBot?.(interaction.guild, "Music Error", error.message).catch((logError) => {
        logger?.warn?.("music error log failed", {
          guildId: interaction.guild.id,
          message: logError?.message || String(logError),
        });
        return null;
      });
    });

    queues.set(interaction.guild.id, queue);

    logger.info("music queue created", {
      guildId: interaction.guild.id,
      voiceChannelId: voiceChannel.id,
      textChannelId: interaction.channel.id,
    });

    return queue;
  }

  async function resolveTrack(query) {
    let trackUrl = null;
    let trackTitle = null;
    let trackSource = "youtube";

    // Check if it's a YouTube URL
    const ytValidation = play.yt_validate(query);
    if (ytValidation === "video") {
      try {
        const info = await play.video_basic_info(query);
        trackUrl = info.video_details.url;
        trackTitle = info.video_details.title;
        trackSource = "youtube";
      } catch (error) {
        logger.warn("music resolveTrack invalid YouTube URL", { query, error: error.message });
      }
    }

    // Check if it's a SoundCloud URL and try to resolve it
    if (!trackUrl) {
      const scValidation = play.so_validate(query);
      if (scValidation === "track") {
        try {
          const info = await play.soundcloud(query);
          trackTitle = info.name || info.title || query;
          trackSource = "soundcloud";
          // Continue to search for equivalent on YouTube
        } catch (error) {
          logger.warn("music resolveTrack SoundCloud lookup", { query, error: error.message });
          trackTitle = query;
        }
      }
    }

    // Fallback: search YouTube for the query or SoundCloud track
    if (!trackUrl) {
      try {
        const searchQuery = trackTitle || query;
        const results = await play.search(searchQuery, { limit: 3 });

        for (const result of results) {
          let resultUrl = null;

          // Try to get URL from result - play-dl may return different property names
          if (result?.url) {
            resultUrl = result.url;
          } else if (result?.id) {
            // Construct YouTube URL from video ID
            resultUrl = `https://www.youtube.com/watch?v=${result.id}`;
          } else if (result?.video_id) {
            resultUrl = `https://www.youtube.com/watch?v=${result.video_id}`;
          }

          if (resultUrl && typeof resultUrl === "string" && resultUrl.includes("youtube")) {
            trackUrl = resultUrl;
            trackTitle = result.title || result.name || trackTitle || searchQuery;
            if (trackSource === "soundcloud") {
              trackSource = "soundcloud-yt";
            }
            break;
          }
        }

        if (!trackUrl) {
          throw new Error("Track tidak ditemukan.");
        }
      } catch (error) {
        const noResult = String(error?.message || "").toLowerCase().includes("track tidak ditemukan");
        if (noResult) {
          logger.warn("music search no result", { query });
        } else {
          logger.error("music search failed", { query, error: error.message });
        }
        throw new Error("Track tidak ditemukan.");
      }
    }

    if (!trackUrl) {
      throw new Error("Tidak bisa mendapatkan URL track.");
    }

    return {
      title: trackTitle || query,
      url: trackUrl,
      source: trackSource,
      requestedBy: null,
    };
  }

  async function playNext(guildId, attempt = 0) {
    const queue = getQueue(guildId);
    if (!queue) return null;

    stopStreamProcess(queue, "before-next-track");

    // safety guard to avoid infinite recursion if streaming keeps failing
    if (attempt > 5) {
      logger.error("music playNext aborted: too many failed attempts", { guildId, attempt });
      return null;
    }

    const nextTrack = queue.tracks.shift();
    if (!nextTrack) return null;

    let resource = null;
    let normalizedUrl = null;
    let activeProcess = null;
    try {
      const urlToStream = nextTrack.url;

      logger.info("music playNext attempting stream", {
        attempt,
        provider: isYoutubeUrl(urlToStream) ? "youtube" : nextTrack.source,
      });

      if (!urlToStream || typeof urlToStream !== "string") {
        throw new Error(`Invalid URL type: ${typeof urlToStream}, value: ${urlToStream}`);
      }

      // Ensure it's a proper YouTube URL
      if (!urlToStream.includes("youtube.com") && !urlToStream.includes("youtu.be")) {
        throw new Error(`URL is not YouTube: ${urlToStream}`);
      }

      // Validate it's a proper URL string
      try {
        new URL(urlToStream);
      } catch (e) {
        throw new Error(`Malformed URL: ${urlToStream} - ${e.message}`);
      }

      // Normalisasi URL (khusus YouTube) untuk menghindari Invalid URL
      normalizedUrl = urlToStream;

      if (isYoutubeUrl(urlToStream)) {
        const safeUrl = normalizeYoutubeUrl(urlToStream);
        if (!safeUrl) {
          throw new Error(`Invalid YouTube URL after normalization: ${urlToStream}`);
        }
        normalizedUrl = safeUrl;
      }

      // Primary source: ytdl-core (kecuali YouTube, kita langsung prioritaskan yt-dlp+ffmpeg)
      if (isYoutubeUrl(normalizedUrl)) {
        throw new Error("skip ytdl-core for youtube; use yt-dlp+ffmpeg fallback");
      }

      const ytInfo = await ytdlCore.getInfo(normalizedUrl);

      // pilih format audio yang paling memungkinkan
      const audioFormats = ytdlCore.filterFormats(ytInfo.formats, "audioonly");
      if (!audioFormats || !audioFormats.length) {
        throw new Error("ytdl-core: no playable audio formats");
      }

      const selectedFormat = ytdlCore.chooseFormat(audioFormats, {
        quality: "highestaudio",
      });

      const stream = ytdlCore.downloadFromInfo(ytInfo, selectedFormat);

      if (!stream || typeof stream.pipe !== "function") {
        throw new Error("ytdl-core returned invalid stream");
      }

      resource = createAudioResource(stream, {
        inlineVolume: true,
      });
      logger.info("music stream source selected", { guildId, source: "ytdl-core" });

    } catch (error) {
      const message = String(error?.message || "");
      const expectedYoutubeSkip = message.includes("skip ytdl-core for youtube");
      const primaryLog = `music stream primary failed provider=ytdl-core attempt=${attempt} error="${message || "unknown"}"`;
      if (expectedYoutubeSkip) {
        logger.info(primaryLog);
      } else {
        logger.warn(primaryLog);
      }

      try {
        const playSource = await play.stream(normalizedUrl || nextTrack.url, {
          quality: 2,
          discordPlayerCompatibility: true,
        });

        if (!playSource?.stream) {
          throw new Error("play-dl returned empty stream");
        }

        resource = createAudioResource(playSource.stream, {
          inputType: playSource.type,
          inlineVolume: true,
        });
        logger.info("music stream source selected", { guildId, source: "play-dl" });
      } catch (fallbackError) {
        logger.warn(
          `music stream fallback failed provider=play-dl attempt=${attempt} error="${fallbackError?.message || "unknown"}"`,
        );

        try {
          const ytDlpArgs = [
            "-m",
            "yt_dlp",
            "--quiet",
            "--no-warnings",
            "--no-progress",
            "--no-playlist",
            "--no-part",
            "--output",
            "-",
            "-f",
            "251/250/249/bestaudio[acodec=opus]/bestaudio",
            normalizedUrl || nextTrack.url,
          ];

          const ytDlpProcess = spawn("python", ytDlpArgs, {
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
          });

          if (!ffmpegPath) {
            throw new Error("ffmpeg-static tidak ditemukan");
          }

          const ffmpegArgs = [
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-f",
            "s16le",
            "-ar",
            "48000",
            "-ac",
            "2",
            "pipe:1",
          ];

          const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
          });

          ytDlpProcess.stdout.pipe(ffmpegProcess.stdin);

          let stderrBuffer = "";
          ytDlpProcess.stderr.on("data", (chunk) => {
            if (stderrBuffer.length < 2500) {
              stderrBuffer += chunk.toString();
            }
          });
          ffmpegProcess.stderr.on("data", (chunk) => {
            if (stderrBuffer.length < 2500) {
              stderrBuffer += chunk.toString();
            }
          });

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              cleanup();
              reject(new Error("yt-dlp timeout saat menunggu stream audio"));
            }, 15_000);

            const onData = () => {
              cleanup();
              resolve();
            };

            const onYtExit = (code, signal) => {
              cleanup();
              reject(new Error(`yt-dlp exited early (code=${code}, signal=${signal})`));
            };

            const onFfmpegExit = (code, signal) => {
              cleanup();
              reject(new Error(`ffmpeg exited early (code=${code}, signal=${signal})`));
            };

            const onError = (spawnError) => {
              cleanup();
              reject(spawnError);
            };

            const cleanup = () => {
              clearTimeout(timeout);
              ffmpegProcess.stdout.off("data", onData);
              ytDlpProcess.off("exit", onYtExit);
              ffmpegProcess.off("exit", onFfmpegExit);
              ytDlpProcess.off("error", onError);
              ffmpegProcess.off("error", onError);
            };

            ffmpegProcess.stdout.once("data", onData);
            ytDlpProcess.once("exit", onYtExit);
            ffmpegProcess.once("exit", onFfmpegExit);
            ytDlpProcess.once("error", onError);
            ffmpegProcess.once("error", onError);
          });

          resource = createAudioResource(ffmpegProcess.stdout, {
            inputType: StreamType.Raw,
            inlineVolume: true,
          });
          activeProcess = {
            killed: false,
            kill() {
              if (this.killed) return;
              this.killed = true;

              if (!ytDlpProcess.killed) {
                ytDlpProcess.kill();
              }
              if (!ffmpegProcess.killed) {
                ffmpegProcess.kill();
              }
            },
          };

          ytDlpProcess.on("exit", (code, signal) => {
            logger.info("music yt-dlp process exited", {
              guildId,
              code,
              signal,
              stderr: stderrBuffer.trim().slice(0, 600),
            });
          });
          ffmpegProcess.on("exit", (code, signal) => {
            logger.info("music ffmpeg process exited", {
              guildId,
              code,
              signal,
              stderr: stderrBuffer.trim().slice(0, 600),
            });
          });

          logger.info("music stream source selected", { guildId, source: "yt-dlp+ffmpeg" });
        } catch (ytDlpError) {
          if (activeProcess && !activeProcess.killed) {
            activeProcess.kill();
          }

          logger.error("music stream yt-dlp fallback failed", {
            attempt,
            source: nextTrack.source,
            error: ytDlpError.message,
          });
          return playNext(guildId, attempt + 1);
        }
      }
    }

    if (!resource) {
      logger.error("music resource creation failed", {
        attempt,
        source: nextTrack.source,
      });
      return playNext(guildId, attempt + 1);
    }


    // Pastikan volume benar-benar diset ke resource
    if (resource.volume) {
      const targetVolume = Math.max(0, Math.min(2, queue.volume));
      resource.volume.setVolume(targetVolume);
    }

    // Debug: log volume dan status resource
    logger.info("music resource prepared", {
      volume: queue.volume,
      hasPlayer: Boolean(queue.player),
      hasConnection: Boolean(queue.connection),
    });

    musicWebhookLogger.info("music resource prepared", {
      guildId,
      volume: queue.volume,
      hasPlayer: Boolean(queue.player),
      hasConnection: Boolean(queue.connection),
    });

    queue.current = nextTrack;
    queue.resource = resource;
    queue.idleSince = null;
    queue.streamProcess = activeProcess;

    // Debug: sebelum play
    logger.info("music calling player.play", {
      source: nextTrack.source,
    });

    // Webhook disabled by env; keep minimal payload to avoid leaking metadata if enabled later
    musicWebhookLogger.info("music calling player.play", {
      source: nextTrack.source,
    });

    queue.player.play(resource);
    try {
      await entersState(queue.player, AudioPlayerStatus.Playing, 12_000);
    } catch (error) {
      logger.error("music track failed to reach PLAYING state", {
        source: nextTrack.source,
        error: error.message,
      });
      stopStreamProcess(queue, "not-playing-timeout");
      queue.current = null;
      queue.resource = null;
      return playNext(guildId, attempt + 1);
    }

    return nextTrack;
  }

  async function enqueue(interaction, query) {
    const queue = await createQueue(interaction);
    const track = await resolveTrack(query);
    track.requestedBy = interaction.user.tag;
    queue.tracks.push(track);

    if (!queue.current) {
      const startedTrack = await playNext(interaction.guild.id);
      if (!startedTrack) {
        throw new Error("Track gagal diputar. Coba lagu lain atau gunakan URL YouTube berbeda.");
      }
    }

    return { queue, track };
  }

  function pause(guildId) {
    const queue = getQueue(guildId);
    if (!queue) {
      return false;
    }
    return queue.player.pause();
  }

  function resume(guildId) {
    const queue = getQueue(guildId);
    if (!queue) {
      return false;
    }
    return queue.player.unpause();
  }

  async function skip(guildId) {
    const queue = getQueue(guildId);
    if (!queue) {
      return false;
    }
    queue.player.stop();
    return true;
  }

  async function stop(guildId) {
    const queue = getQueue(guildId);
    if (!queue) {
      return false;
    }
    queue.tracks = [];
    queue.player.stop();
    return true;
  }

  function setVolume(guildId, percent) {
    const queue = getQueue(guildId);
    if (!queue) {
      return null;
    }

    queue.volume = percent / 100;
    if (queue.resource?.volume) {
      queue.resource.volume.setVolume(queue.volume);
    }
    return queue.volume;
  }

  function toggleLoop(guildId) {
    const queue = getQueue(guildId);
    if (!queue) {
      return null;
    }
    queue.loop = !queue.loop;
    return queue.loop;
  }

  function cleanupIdleQueues() {
    for (const [guildId, queue] of queues.entries()) {
      if (queue.idleSince && Date.now() - queue.idleSince > 60_000) {
        destroyQueue(guildId);
      }
    }
  }

  function handleVoiceStateUpdate(oldState) {
    const queue = getQueue(oldState.guild.id);
    if (!queue) {
      return;
    }

    const channel = oldState.guild.channels.cache.get(queue.voiceChannelId);
    if (!channel?.members) {
      return;
    }

    const humans = channel.members.filter((member) => !member.user.bot);
    if (!humans.size) {
      destroyQueue(oldState.guild.id);
    }
  }

  return {
    enqueue,
    getQueue,
    pause,
    resume,
    skip,
    stop,
    setVolume,
    toggleLoop,
    cleanupIdleQueues,
    handleVoiceStateUpdate,
    leave(guildId) {
      destroyQueue(guildId);
    },
  };
}

module.exports = {
  createMusicService,
};
