/**
 * EduPeak Custom DRM Video Player Engine
 * Completely masks YouTube video streams into a fully branded, custom-controlled player.
 * Features:
 *  - Zero visible YouTube logos, titles, share buttons, or "Watch on YouTube" watermarks
 *  - Custom Glassmorphism Controls (Play/Pause, Seek Bar with Buffer, Volume, Speed, Fullscreen)
 *  - Dynamic Anti-Piracy Floating Watermark (Student Name + Student ID)
 *  - Keyboard Shortcuts (Space, Arrow Keys, M, F)
 *  - Auto-hiding control bar with hover detection
 */

const EDUPEAK_PLAYER = (function() {
  let ytPlayer = null;
  let isApiLoaded = false;
  let isPlaying = false;
  let isMuted = false;
  let currentVolume = 100;
  let currentPlaybackRate = 1.0;
  let duration = 0;
  let currentTime = 0;
  let progressInterval = null;
  let controlsTimeout = null;
  let isDraggingProgress = false;
  let currentVideoId = "dQw4w9WgXcQ";

  // Parse YouTube video ID from various URL formats
  function extractYouTubeId(url) {
    if (!url) return "dQw4w9WgXcQ";
    if (url.length === 11 && !url.includes("/") && !url.includes(".")) {
      return url;
    }
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : "dQw4w9WgXcQ";
  }

  // Format seconds to mm:ss or hh:mm:ss
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Parse "mm:ss" or "hh:mm:ss" string to seconds
  function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(":").map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  }

  // Initialize YouTube IFrame API
  function initPlayer(initialVideoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ") {
    currentVideoId = extractYouTubeId(initialVideoUrl);
    
    // Inject YouTube IFrame API script if not present
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = function() {
        isApiLoaded = true;
        createYTPlayer(currentVideoId);
      };
    } else if (window.YT && window.YT.Player) {
      isApiLoaded = true;
      createYTPlayer(currentVideoId);
    }

    setupPlayerEventListeners();
    startWatermarkMovement();
    updateWatermarkUser();
  }

  function createYTPlayer(videoId) {
    const container = document.getElementById("edupeakYTPlayerMount");
    if (!container) return;

    if (!window.YT || !window.YT.Player) {
      // If YT API not ready yet, wait for onYouTubeIframeAPIReady callback
      return;
    }

    if (ytPlayer) {
      try {
        ytPlayer.destroy();
      } catch (e) {
        console.warn("Destroying previous player notice:", e);
      }
    }

    // Programmatically suppress captions / subtitles completely
    function disableCaptions(player) {
      if (!player) return;
      try {
        if (typeof player.unloadModule === "function") {
          player.unloadModule("captions");
          player.unloadModule("cc");
        }
        if (typeof player.setOption === "function") {
          player.setOption("captions", "track", {});
          player.setOption("captions", "reload", false);
          player.setOption("captions", "fontSize", -1);
          player.setOption("cc", "track", {});
          player.setOption("cc", "reload", false);
        }
      } catch (e) {
        // ignore
      }
    }

    function enforceNoCaptions(player) {
      if (!player) return;
      disableCaptions(player);
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        disableCaptions(player);
        if (attempts >= 6) clearInterval(interval);
      }, 500);
    }

    try {
      ytPlayer = new window.YT.Player('edupeakYTPlayerMount', {
        host: 'https://www.youtube.com',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          enablejsapi: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
          widget_referrer: window.location.href
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange,
          'onError': onPlayerError
        }
      });
    } catch (err) {
      console.warn("Player initialization notice:", err);
    }
  }

  function enforceNoCaptions(player) {
    if (!player) return;
    try {
      if (typeof player.unloadModule === 'function') player.unloadModule('captions');
      if (typeof player.unloadModule === 'function') player.unloadModule('cc');
      if (typeof player.setOption === 'function') player.setOption('captions', 'track', {});
      if (typeof player.setOption === 'function') player.setOption('cc', 'track', {});
    } catch (e) {}
  }

  function onPlayerReady(event) {
    try {
      duration = ytPlayer.getDuration() || 0;
      updateTimeDisplay(0, duration);
      setVolume(currentVolume);
      setPlaybackRate(currentPlaybackRate, false); // Do not notify toast on page reload/init
      enforceNoCaptions(ytPlayer);
    } catch (e) {
      console.warn("Player ready init:", e);
    }
  }

  function onPlayerStateChange(event) {
    const bigPlayBtn = document.getElementById("playerBigPlayBtn");
    const ctrlPlayIcon = document.getElementById("ctrlPlayIcon");
    const bigPlayIcon = document.getElementById("bigPlayIcon");
    const viewport = document.getElementById("edupeakPlayerViewport");

    const PLAYING = (window.YT && window.YT.PlayerState) ? window.YT.PlayerState.PLAYING : 1;
    const PAUSED = (window.YT && window.YT.PlayerState) ? window.YT.PlayerState.PAUSED : 2;
    const ENDED = (window.YT && window.YT.PlayerState) ? window.YT.PlayerState.ENDED : 0;
    const BUFFERING = (window.YT && window.YT.PlayerState) ? window.YT.PlayerState.BUFFERING : 3;

    if (event.data === PLAYING) {
      isPlaying = true;
      if (bigPlayBtn) bigPlayBtn.classList.add("hidden");
      if (ctrlPlayIcon) ctrlPlayIcon.className = "fa-solid fa-pause";
      if (bigPlayIcon) bigPlayIcon.className = "fa-solid fa-pause";
      if (viewport) viewport.classList.add("is-playing");
      enforceNoCaptions(ytPlayer);
      updateWatermarkUser();
      startProgressTracking();
      scheduleControlsFade();
    } else if (event.data === PAUSED || event.data === ENDED) {
      isPlaying = false;
      if (bigPlayBtn) bigPlayBtn.classList.remove("hidden");
      if (ctrlPlayIcon) ctrlPlayIcon.className = "fa-solid fa-play";
      if (bigPlayIcon) bigPlayIcon.className = "fa-solid fa-play";
      if (viewport) viewport.classList.remove("is-playing");
      showControls();
      stopProgressTracking();
    } else if (event.data === BUFFERING) {
      showControls();
    }
  }

  function onPlayerError(event) {
    console.warn("EduPeak DRM Player status notice (Code: " + event.data + ")");
  }

  // Load a new video into the custom player
  function loadVideo(videoUrl) {
    const newId = extractYouTubeId(videoUrl);
    currentVideoId = newId;

    if (ytPlayer && ytPlayer.loadVideoById) {
      try {
        ytPlayer.loadVideoById(newId);
        ytPlayer.pauseVideo();
        isPlaying = false;
        disableCaptions(ytPlayer);
        const bigPlayBtn = document.getElementById("playerBigPlayBtn");
        if (bigPlayBtn) bigPlayBtn.classList.remove("hidden");
        const ctrlPlayIcon = document.getElementById("ctrlPlayIcon");
        if (ctrlPlayIcon) ctrlPlayIcon.className = "fa-solid fa-play";
      } catch (e) {
        createYTPlayer(newId);
      }
    } else {
      createYTPlayer(newId);
    }
    updateWatermarkUser();
  }

  // Play / Pause Toggle
  function togglePlayPause() {
    if (!ytPlayer || typeof ytPlayer.getPlayerState !== "function") return;
    try {
      const state = ytPlayer.getPlayerState();
      const PLAYING = (window.YT && window.YT.PlayerState) ? window.YT.PlayerState.PLAYING : 1;
      if (state === PLAYING) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    } catch (e) {
      console.warn("Toggle play error:", e);
    }
  }

  function play() {
    if (ytPlayer && ytPlayer.playVideo) ytPlayer.playVideo();
  }

  function pause() {
    if (ytPlayer && typeof ytPlayer.pauseVideo === "function") {
      try { ytPlayer.pauseVideo(); } catch (e) {}
    }
    isPlaying = false;
    const bigPlayBtn = document.getElementById("playerBigPlayBtn");
    if (bigPlayBtn) bigPlayBtn.classList.remove("hidden");
    const ctrlPlayIcon = document.getElementById("ctrlPlayIcon");
    if (ctrlPlayIcon) ctrlPlayIcon.className = "fa-solid fa-play";
    const bigPlayIcon = document.getElementById("bigPlayIcon");
    if (bigPlayIcon) bigPlayIcon.className = "fa-solid fa-play";
    const viewport = document.getElementById("edupeakPlayerViewport");
    if (viewport) viewport.classList.remove("is-playing");
    stopProgressTracking();
  }

  // Seek to specific timestamp in seconds
  function seekTo(seconds) {
    if (!ytPlayer || typeof ytPlayer.seekTo !== "function") return;
    try {
      ytPlayer.seekTo(seconds, true);
      currentTime = seconds;
      updateProgressBar(currentTime, duration);
      updateTimeDisplay(currentTime, duration);
    } catch (e) {
      console.warn("Seek error:", e);
    }
  }

  // Seek relative by offset (+/- seconds)
  function seekRelative(offset) {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
    try {
      const cur = ytPlayer.getCurrentTime() || 0;
      const target = Math.max(0, Math.min(duration || 999999, cur + offset));
      seekTo(target);
      if (window.showToast) {
        window.showToast(`${offset > 0 ? '⏩ +' : '⏪ '}${offset}s`, "info");
      }
    } catch (e) {
      console.warn("Seek relative error:", e);
    }
  }

  // Volume & Mute Controls
  function setVolume(val) {
    currentVolume = parseInt(val, 10);
    const slider = document.getElementById("playerVolumeSlider");
    const icon = document.getElementById("ctrlVolumeIcon");
    if (slider) slider.value = currentVolume;

    if (ytPlayer && typeof ytPlayer.setVolume === "function") {
      try {
        if (currentVolume === 0) {
          ytPlayer.mute();
          isMuted = true;
          if (icon) icon.className = "fa-solid fa-volume-xmark";
        } else {
          ytPlayer.unMute();
          ytPlayer.setVolume(currentVolume);
          isMuted = false;
          if (icon) {
            icon.className = currentVolume < 50 ? "fa-solid fa-volume-low" : "fa-solid fa-volume-high";
          }
        }
      } catch (e) {
        console.warn("Volume set error:", e);
      }
    }
  }

  function toggleMute() {
    if (!ytPlayer) return;
    const icon = document.getElementById("ctrlVolumeIcon");
    const slider = document.getElementById("playerVolumeSlider");
    try {
      if (isMuted || currentVolume === 0) {
        isMuted = false;
        const restoreVol = currentVolume === 0 ? 80 : currentVolume;
        setVolume(restoreVol);
      } else {
        isMuted = true;
        ytPlayer.mute();
        if (icon) icon.className = "fa-solid fa-volume-xmark";
        if (slider) slider.value = 0;
      }
    } catch (e) {
      console.warn("Mute toggle error:", e);
    }
  }

  // Playback Rate
  function setPlaybackRate(rate, notify = false) {
    currentPlaybackRate = parseFloat(rate);
    if (ytPlayer && typeof ytPlayer.setPlaybackRate === "function") {
      try {
        ytPlayer.setPlaybackRate(currentPlaybackRate);
      } catch (e) {
        console.warn("Rate error:", e);
      }
    }

    const speedLabel = document.getElementById("currentSpeedText");
    if (speedLabel) speedLabel.textContent = `${currentPlaybackRate}x`;

    document.querySelectorAll(".speed-dropdown-menu button").forEach(btn => {
      btn.classList.toggle("active", parseFloat(btn.textContent) === currentPlaybackRate);
    });

    const menu = document.getElementById("playerSpeedMenu");
    if (menu) menu.classList.remove("active");

    if (notify && window.showToast) {
      window.showToast(`🚀 Playback speed: ${currentPlaybackRate}x`, "info");
    }
  }

  function toggleSpeedMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById("playerSpeedMenu");
    if (menu) menu.classList.toggle("active");
  }

  // Fullscreen Management
  function toggleFullscreen() {
    const playerWrapper = document.getElementById("edupeakPlayerWrapper");
    if (!playerWrapper) return;

    const icon = document.getElementById("ctrlFullscreenIcon");

    if (!document.fullscreenElement) {
      if (playerWrapper.requestFullscreen) {
        playerWrapper.requestFullscreen();
      } else if (playerWrapper.webkitRequestFullscreen) {
        playerWrapper.webkitRequestFullscreen();
      } else if (playerWrapper.msRequestFullscreen) {
        playerWrapper.msRequestFullscreen();
      }
      if (icon) icon.className = "fa-solid fa-compress";
      playerWrapper.classList.add("fullscreen-mode");
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      if (icon) icon.className = "fa-solid fa-expand";
      playerWrapper.classList.remove("fullscreen-mode");
    }
  }

  // Progress Bar & Time Tracker
  function startProgressTracking() {
    stopProgressTracking();
    progressInterval = setInterval(() => {
      if (!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
      try {
        currentTime = ytPlayer.getCurrentTime() || 0;
        duration = ytPlayer.getDuration() || duration || 0;

        if (!isDraggingProgress) {
          updateProgressBar(currentTime, duration);
          updateTimeDisplay(currentTime, duration);
        }

        // Buffer tracking
        if (ytPlayer.getVideoLoadedFraction) {
          const loadedFraction = ytPlayer.getVideoLoadedFraction() || 0;
          const bufferBar = document.getElementById("playerBufferBar");
          if (bufferBar) bufferBar.style.width = `${loadedFraction * 100}%`;
        }
      } catch (e) {
        // ignore state polling error
      }
    }, 250);
  }

  function stopProgressTracking() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }

  function updateProgressBar(cur, dur) {
    if (dur <= 0) return;
    const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
    const progressBar = document.getElementById("playerProgressBar");
    const thumb = document.getElementById("playerProgressThumb");
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (thumb) thumb.style.left = `${pct}%`;
  }

  function updateTimeDisplay(cur, dur) {
    const curEl = document.getElementById("playerCurrentTime");
    const durEl = document.getElementById("playerTotalDuration");
    if (curEl) curEl.textContent = formatTime(cur);
    if (durEl) durEl.textContent = formatTime(dur);
  }

  // Auto-hide Controls on Inactivity
  function showControls() {
    const controls = document.getElementById("playerControlsOverlay");
    const topBar = document.getElementById("playerTopBar");
    const wrapper = document.getElementById("edupeakPlayerWrapper");
    if (controls) controls.classList.remove("fade-out");
    if (topBar) topBar.classList.remove("fade-out");
    if (wrapper) wrapper.classList.remove("hide-cursor");
  }

  function hideControls() {
    if (!isPlaying) return;
    const controls = document.getElementById("playerControlsOverlay");
    const topBar = document.getElementById("playerTopBar");
    const wrapper = document.getElementById("edupeakPlayerWrapper");
    if (controls) controls.classList.add("fade-out");
    if (topBar) topBar.classList.add("fade-out");
    if (wrapper) wrapper.classList.add("hide-cursor");
  }

  function scheduleControlsFade() {
    clearTimeout(controlsTimeout);
    showControls();
    if (isPlaying) {
      controlsTimeout = setTimeout(() => {
        hideControls();
      }, 3000);
    }
  }

  let isWatermarkEnabled = false; // Disabled by default per user requirement
  let currentQuality = "auto";

  function setWatermarkEnabled(enabled) {
    isWatermarkEnabled = Boolean(enabled);
    const watermark = document.getElementById("playerDrmWatermark");
    if (watermark) {
      watermark.style.display = isWatermarkEnabled ? "flex" : "none";
    }
  }

  // Quality Selector Handler
  function toggleQualityMenu() {
    const menu = document.getElementById("playerQualityMenu");
    if (menu) menu.classList.toggle("active");
  }

  function setPlaybackQuality(quality, btnEl) {
    currentQuality = quality;

    const qualityLabelMap = {
      'auto': 'Auto',
      'hd1080': '1080p HD',
      'hd720': '720p HD',
      'large': '480p',
      'medium': '360p',
      'small': '240p',
      'tiny': '144p'
    };
    const displayLabel = qualityLabelMap[quality] || quality;

    if (ytPlayer) {
      try {
        if (quality === 'auto') {
          if (typeof ytPlayer.setPlaybackQuality === 'function') {
            ytPlayer.setPlaybackQuality('default');
          }
        } else {
          if (typeof ytPlayer.setPlaybackQuality === 'function') {
            ytPlayer.setPlaybackQuality(quality);
          }
          if (typeof ytPlayer.setPlaybackQualityRange === 'function') {
            ytPlayer.setPlaybackQualityRange(quality, quality);
          }
        }

        // Force player to flush buffer and re-fetch chunks at newly selected bitrate/resolution
        if (typeof ytPlayer.getCurrentTime === 'function' && typeof ytPlayer.seekTo === 'function') {
          const cur = ytPlayer.getCurrentTime();
          ytPlayer.seekTo(cur, true);
        }
      } catch (e) {
        console.warn("Set quality notice:", e);
      }
    }

    const labelEl = document.getElementById("playerQualityLabel");
    if (labelEl) labelEl.textContent = displayLabel;

    // Update top status bar resolution badge (.res-badge)
    const topResBadge = document.querySelector("#playerTopBar .res-badge");
    if (topResBadge) {
      const badgeText = quality === 'auto' ? '1080p Ultra HD' : (displayLabel.includes('HD') ? displayLabel : `${displayLabel} Stream`);
      topResBadge.innerHTML = `<i class="fa-solid fa-bolt"></i> ${badgeText}`;
    }

    const menu = document.getElementById("playerQualityMenu");
    if (menu) {
      menu.querySelectorAll("button").forEach(b => {
        b.classList.toggle("active", b.dataset.quality === quality || b === btnEl || b.getAttribute("onclick")?.includes(quality));
      });
      menu.classList.remove("active");
    }

    if (window.showToast) {
      window.showToast(`⚡ Video Quality set to ${displayLabel}`, "info");
    }
  }

  // Anti-Piracy Watermark Animation & Dynamic User Text (Strictly Shows Student NIC Only)
  function updateWatermarkUser() {
    const textEl = document.getElementById("playerWatermarkText");
    if (!textEl) return;

    let studentNic = "200512345678";

    if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.getCurrentUser) {
      const user = window.AUTH_SYSTEM.getCurrentUser();
      if (user && user.nic) {
        studentNic = user.nic;
      }
    }

    // Only display NIC number - no other text per user requirement
    textEl.textContent = studentNic;
  }

  function startWatermarkMovement() {
    const watermark = document.getElementById("playerDrmWatermark");
    if (!watermark) return;

    const positions = [
      { top: "15%", left: "15%" },
      { top: "20%", left: "65%" },
      { top: "60%", left: "20%" },
      { top: "70%", left: "60%" },
      { top: "45%", left: "40%" }
    ];
    let posIdx = 0;

    setInterval(() => {
      posIdx = (posIdx + 1) % positions.length;
      const p = positions[posIdx];
      watermark.style.top = p.top;
      watermark.style.left = p.left;
    }, 9000);
  }

  // Setup Event Listeners for Progress Scrubbing & Shortcuts
  function setupPlayerEventListeners() {
    const wrapper = document.getElementById("edupeakPlayerWrapper");
    const progressContainer = document.getElementById("playerProgressContainer");
    const hoverTooltip = document.getElementById("playerHoverTooltip");

    if (wrapper) {
      wrapper.addEventListener("mousemove", () => {
        scheduleControlsFade();
      });
      wrapper.addEventListener("mouseleave", () => {
        if (isPlaying) hideControls();
      });
    }

    if (progressContainer) {
      function handleProgressSeek(e) {
        const rect = progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        const seekSeconds = pct * duration;
        seekTo(seekSeconds);
      }

      progressContainer.addEventListener("mousedown", (e) => {
        isDraggingProgress = true;
        handleProgressSeek(e);
      });

      document.addEventListener("mousemove", (e) => {
        if (isDraggingProgress) {
          handleProgressSeek(e);
        }
      });

      document.addEventListener("mouseup", () => {
        isDraggingProgress = false;
      });

      progressContainer.addEventListener("mousemove", (e) => {
        if (!hoverTooltip) return;
        const rect = progressContainer.getBoundingClientRect();
        const hoverX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, hoverX / rect.width));
        const hoverTime = pct * duration;
        hoverTooltip.style.left = `${hoverX}px`;
        hoverTooltip.textContent = formatTime(hoverTime);
        hoverTooltip.style.opacity = "1";
      });

      progressContainer.addEventListener("mouseleave", () => {
        if (hoverTooltip) hoverTooltip.style.opacity = "0";
      });
    }

    // Close speed and quality menu on outside click
    document.addEventListener("click", (e) => {
      const speedWrapper = document.querySelector(".speed-selector-wrapper");
      const speedMenu = document.getElementById("playerSpeedMenu");
      if (speedMenu && speedWrapper && !speedWrapper.contains(e.target)) {
        speedMenu.classList.remove("active");
      }

      const qualityWrapper = document.querySelector(".quality-selector-wrapper");
      const qualityMenu = document.getElementById("playerQualityMenu");
      if (qualityMenu && qualityWrapper && !qualityWrapper.contains(e.target)) {
        qualityMenu.classList.remove("active");
      }
    });

    // Keyboard Shortcuts
    document.addEventListener("keydown", (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

      const lmsModal = document.getElementById("lmsModalWrapper");
      if (!lmsModal || !lmsModal.classList.contains("active")) return;

      if (e.code === "Space" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === "ArrowLeft" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        seekRelative(-10);
      } else if (e.key === "ArrowRight" || e.key === "l" || e.key === "L") {
        e.preventDefault();
        seekRelative(10);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setVolume(Math.min(100, currentVolume + 10));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setVolume(Math.max(0, currentVolume - 10));
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMute();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    });
  }

  return {
    init: initPlayer,
    loadVideo: loadVideo,
    togglePlayPause: togglePlayPause,
    play: play,
    pause: pause,
    seekTo: seekTo,
    seekRelative: seekRelative,
    setVolume: setVolume,
    toggleMute: toggleMute,
    setPlaybackRate: setPlaybackRate,
    toggleSpeedMenu: toggleSpeedMenu,
    toggleQualityMenu: toggleQualityMenu,
    setPlaybackQuality: setPlaybackQuality,
    setWatermarkEnabled: setWatermarkEnabled,
    toggleFullscreen: toggleFullscreen,
    parseTimeToSeconds: parseTimeToSeconds,
    updateWatermarkUser: updateWatermarkUser
  };
})();

// Auto-bind globally
window.EDUPEAK_PLAYER = EDUPEAK_PLAYER;

/**
 * EduPeak Live Classroom Custom Player Engine
 * Custom masks YouTube Live stream into a branded live stream player with NIC watermark, quality controls & audio.
 */
const EDUPEAK_LIVE_PLAYER = (function() {
  let liveYtPlayer = null;
  let isLivePlaying = false;
  let isSessionEnded = false;   // once true, no replay allowed
  let liveVolume = 100;
  let liveQuality = "auto";
  let isWatermarkEnabled = false;
  let activeSessionData = null;
  let streamEndCallbacks = [];
  let durationCheckInterval = null;

  function initLivePlayer(videoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ", sessionData = null) {
    if (sessionData) activeSessionData = sessionData;
    const videoId = extractYouTubeId(videoUrl);
    createLiveYTPlayer(videoId);
    updateLiveWatermark();
    startLiveWatermarkMovement();
    setupLivePlayerEvents();
  }

  function extractYouTubeId(url) {
    if (!url) return "";
    if (typeof url !== "string") return "";
    url = url.trim();
    if (url.length === 11 && !url.includes("/") && !url.includes(".") && !url.includes("?")) return url;
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/|shorts\/)([^#&\?]{11}).*/;
    const match = url.match(regExp);
    return (match && match[2] && match[2].length === 11) ? match[2] : "";
  }

  function getElapsedSeconds() {
    let startedAt = activeSessionData ? (activeSessionData.startedAt || activeSessionData.started_at) : null;
    const sessId = (activeSessionData && (activeSessionData.id || activeSessionData.scheduleId))
      || (window.LIVE_APP ? window.LIVE_APP.activeSessionId : null);
    if (!startedAt && sessId) {
      try { startedAt = localStorage.getItem("edupeak_session_started_" + sessId); } catch(e) {}
    }
    if (!startedAt) return 0;
    const startMs = new Date(startedAt).getTime();
    if (isNaN(startMs) || startMs <= 0) return 0;
    const nowMs = Date.now();
    const elapsed = Math.floor((nowMs - startMs) / 1000);
    return Math.max(0, elapsed);
  }

  function getPlaybackResumeSeconds(videoId) {
    const sessId = (activeSessionData && (activeSessionData.id || activeSessionData.scheduleId))
      || (window.LIVE_APP ? window.LIVE_APP.activeSessionId : null);
    let savedSec = 0;
    try {
      const key1 = sessId ? "edupeak_live_playback_" + sessId : null;
      const key2 = videoId ? "edupeak_live_playback_" + videoId : null;
      const val = (key1 && localStorage.getItem(key1)) || (key2 && localStorage.getItem(key2));
      if (val) {
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) savedSec = num;
      }
    } catch(e) {}
    const elapsed = getElapsedSeconds();
    return Math.max(savedSec, elapsed);
  }

  function triggerLiveEnded() {
    if (isSessionEnded) return;   // prevent double-fire
    isSessionEnded = true;
    stopDurationWatchdog();
    isLivePlaying = false;
    _hideUnmutePrompt();

    // Destroy player immediately — prevents any replay
    if (liveYtPlayer) {
      try { liveYtPlayer.stopVideo(); } catch(e) {}
      try { liveYtPlayer.destroy(); } catch(e) {}
      liveYtPlayer = null;
    }
    // Hide big play btn — session is over, no replay
    const bigPlayBtn = document.getElementById("livePlayerBigPlayBtn");
    if (bigPlayBtn) bigPlayBtn.style.display = "none";

    const sessionId = (activeSessionData && (activeSessionData.id || activeSessionData.scheduleId))
      || (window.LIVE_APP ? window.LIVE_APP.activeSessionId : null);

    try {
      window.dispatchEvent(new CustomEvent("edupeak-live-ended", {
        detail: {
          sessionId: sessionId,
          session: activeSessionData,
          endedAt: new Date().toISOString()
        }
      }));
    } catch(e) {}

    streamEndCallbacks.forEach(cb => {
      try { cb(sessionId, activeSessionData); } catch(e) {}
    });

    if (window.LIVE_APP && typeof window.LIVE_APP.handleAutoEndStream === "function") {
      window.LIVE_APP.handleAutoEndStream(sessionId);
    }
  }

  function startDurationWatchdog() {
    stopDurationWatchdog();
    durationCheckInterval = setInterval(() => {
      if (!liveYtPlayer) return;
      try {
        const curTime = typeof liveYtPlayer.getCurrentTime === "function" ? liveYtPlayer.getCurrentTime() : 0;
        if (curTime > 1) {
          const sessId = (activeSessionData && (activeSessionData.id || activeSessionData.scheduleId))
            || (window.LIVE_APP ? window.LIVE_APP.activeSessionId : null);
          const vId = (typeof liveYtPlayer.getVideoData === "function" && liveYtPlayer.getVideoData()?.video_id) || "";
          try {
            if (sessId) localStorage.setItem("edupeak_live_playback_" + sessId, String(Math.floor(curTime)));
            if (vId) localStorage.setItem("edupeak_live_playback_" + vId, String(Math.floor(curTime)));
          } catch(e) {}
        }

        const vidDuration = typeof liveYtPlayer.getDuration === "function" ? liveYtPlayer.getDuration() : 0;
        const isLiveType = typeof liveYtPlayer.getVideoData === "function" && liveYtPlayer.getVideoData()?.isLive;
        if (!isLiveType && vidDuration > 0) {
          if (curTime >= vidDuration - 0.5 && curTime > 0) {
            triggerLiveEnded();
          }
        }
      } catch(e) {}
    }, 1000);
  }

  function stopDurationWatchdog() {
    if (durationCheckInterval) {
      clearInterval(durationCheckInterval);
      durationCheckInterval = null;
    }
  }

  function createLiveYTPlayer(videoId, startOffset = null) {
    const container = document.getElementById("edupeakLiveYTPlayerMount");
    if (!container) return;

    if (!videoId && activeSessionData) {
      const u = activeSessionData.rawUrl || activeSessionData.rawurl || activeSessionData.raw_url || activeSessionData.embedUrl || activeSessionData.embedurl || activeSessionData.embed_url || "";
      videoId = extractYouTubeId(u);
    }

    // No URL configured — show message instead of playing placeholder
    if (!videoId) {
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f59e0b;font-size:1rem;font-weight:600;padding:2rem;text-align:center;">
        ⚠️ No stream URL has been configured for this session.<br><br>
        <small style="opacity:0.7">Teacher: add a YouTube URL in the edit form and save.</small>
      </div>`;
      return;
    }

    if (!window.YT) {
      if (!window._edupeakYtScriptLoading) {
        window._edupeakYtScriptLoading = true;
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
          document.head.appendChild(tag);
        }
      }
      setTimeout(() => createLiveYTPlayer(videoId, startOffset), 350);
      return;
    }

    if (!window.YT.Player) {
      setTimeout(() => createLiveYTPlayer(videoId, startOffset), 350);
      return;
    }

    if (liveYtPlayer) {
      try { liveYtPlayer.destroy(); } catch (e) {}
    }

    function disableLiveCaptions(player) {
      if (!player) return;
      try {
        if (typeof player.unloadModule === "function") {
          player.unloadModule("captions");
          player.unloadModule("cc");
        }
        if (typeof player.setOption === "function") {
          player.setOption("captions", "track", {});
          player.setOption("captions", "reload", false);
          player.setOption("captions", "fontSize", -1);
          player.setOption("cc", "track", {});
          player.setOption("cc", "reload", false);
        }
      } catch (e) {}
    }

    function enforceLiveNoCaptions(player) {
      if (!player) return;
      disableLiveCaptions(player);
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        disableLiveCaptions(player);
        if (attempts >= 6) clearInterval(interval);
      }, 500);
    }

    // Resume from saved position or live elapsed offset so reloading does NOT restart from 0
    const resumeSec = (typeof startOffset === "number" && startOffset > 0)
      ? Math.floor(startOffset)
      : Math.floor(getPlaybackResumeSeconds(videoId));

    const initialStart = resumeSec > 0 ? resumeSec : 0;

    try {
      liveYtPlayer = new window.YT.Player('edupeakLiveYTPlayerMount', {
        host: 'https://www.youtube.com',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,        // muted autoplay is allowed by all browsers
          controls: 0,
          enablejsapi: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          start: initialStart > 0 ? initialStart : 0,
          origin: window.location.origin,
          widget_referrer: window.location.href
        },
        events: {
          'onReady': () => {
            try {
              enforceLiveNoCaptions(liveYtPlayer);

              // Force muted play immediately — browsers always allow muted autoplay
              liveYtPlayer.mute();
              liveYtPlayer.setVolume(0);
              const targetPos = (initialStart > 0) ? initialStart : Math.floor(getPlaybackResumeSeconds(videoId));
              if (targetPos > 0) {
                try { liveYtPlayer.seekTo(targetPos, true); } catch (e) {}
              }
              liveYtPlayer.playVideo();

              // Show unmute prompt so student knows stream is playing
              _showUnmutePrompt();
              startDurationWatchdog();
            } catch (e) {
              console.warn("Live player init notice:", e);
            }
          },
          'onStateChange': (event) => {
            const PLAYING = (window.YT && window.YT.PlayerState) ? window.YT.PlayerState.PLAYING : 1;
            const PAUSED = (window.YT && window.YT.PlayerState) ? window.YT.PlayerState.PAUSED : 2;
            const ENDED = (window.YT && window.YT.PlayerState) ? window.YT.PlayerState.ENDED : 0;
            const bigPlayBtn = document.getElementById("livePlayerBigPlayBtn");

            if (event.data === PLAYING) {
              isLivePlaying = true;
              if (bigPlayBtn) bigPlayBtn.classList.add("hidden");
              enforceLiveNoCaptions(liveYtPlayer);
              updateLiveWatermark();
              startDurationWatchdog();

              const targetPos = Math.floor(getPlaybackResumeSeconds(videoId));
              const curTime = typeof liveYtPlayer.getCurrentTime === "function" ? liveYtPlayer.getCurrentTime() : 0;
              if (targetPos > 3 && curTime < 2) {
                try { liveYtPlayer.seekTo(targetPos, true); } catch(e) {}
              }

              // Hide any bot fallback prompt if playing
              const fallbackEl = document.getElementById("livePlayerBotCheckFallback");
              if (fallbackEl) fallbackEl.style.display = "none";

              // Show prompt only if muted and user has not unmuted yet
              if (_isMuted() && !_hasUserUnmuted) {
                _showUnmutePrompt();
              } else {
                _hideUnmutePrompt();
              }
            } else if (event.data === PAUSED) {
              if (isSessionEnded) return; // don't try to resume an ended session
              isLivePlaying = false;
              if (!_hasUserUnmuted) {
                try { liveYtPlayer.mute(); liveYtPlayer.playVideo(); } catch(e) {}
                _showUnmutePrompt();
              }
            } else if (event.data === ENDED) {
              if (!isSessionEnded) triggerLiveEnded();
            }
          },
          'onError': (event) => {
            console.warn("Live YouTube embed error encountered:", event.data);
            showBotFallbackPrompt();
          }
        }
      });
    } catch (e) {
      console.warn("Live player init notice:", e);
    }
  }

  function loadLiveStream(url, sessionData = null) {
    if (sessionData) {
      activeSessionData = sessionData;
      if (sessionData.id && sessionData.startedAt) {
        try { localStorage.setItem("edupeak_session_started_" + sessionData.id, sessionData.startedAt); } catch(e) {}
      }
    }
    const resolvedUrl = (typeof url === "string" && url.trim())
      ? url.trim()
      : (sessionData && (sessionData.rawUrl || sessionData.rawurl || sessionData.raw_url || sessionData.embedUrl || sessionData.embedurl || sessionData.embed_url || "")) || "";
    let videoId = extractYouTubeId(resolvedUrl);
    if (!videoId && activeSessionData) {
      const u = activeSessionData.rawUrl || activeSessionData.rawurl || activeSessionData.raw_url || activeSessionData.embedUrl || activeSessionData.embedurl || activeSessionData.embed_url || "";
      videoId = extractYouTubeId(u);
    }
    const resumeSec = Math.floor(getPlaybackResumeSeconds(videoId));

    // If player already exists and is already playing this video ID, DO NOT interrupt or reload playback!
    if (liveYtPlayer && typeof liveYtPlayer.getVideoData === "function") {
      const currentVideoData = liveYtPlayer.getVideoData();
      const curState = typeof liveYtPlayer.getPlayerState === "function" ? liveYtPlayer.getPlayerState() : -1;
      if (currentVideoData && currentVideoData.video_id === videoId && (isLivePlaying || curState === 1 || curState === 3)) {
        updateLiveWatermark();
        return;
      }
    }

    if (liveYtPlayer && liveYtPlayer.loadVideoById) {
      try {
        if (resumeSec > 0) {
          liveYtPlayer.loadVideoById({
            videoId: videoId,
            startSeconds: resumeSec
          });
        } else {
          liveYtPlayer.loadVideoById(videoId);
        }
        startDurationWatchdog();
      } catch (e) {
        createLiveYTPlayer(videoId, resumeSec);
      }
    } else {
      createLiveYTPlayer(videoId, resumeSec);
    }

    // Update direct stream fallback links for mobile/network bot-check bypass
    if (videoId) {
      const extLink = document.getElementById("livePlayerExternalStreamLink");
      if (extLink) {
        extLink.href = "https://www.youtube.com/watch?v=" + videoId;
        extLink.style.display = "inline-flex";
      }
      const directBtn = document.getElementById("botCheckDirectYtBtn");
      if (directBtn) {
        directBtn.href = "https://www.youtube.com/watch?v=" + videoId;
      }
    }

    updateLiveWatermark();
  }

  // ── Unmute helpers ──────────────────────────────────────────────────────
  let _hasUserUnmuted = false;

  function _isMuted() {
    try { return liveYtPlayer && liveYtPlayer.isMuted(); } catch(e) { return false; }
  }

  function _showUnmutePrompt() {
    if (_hasUserUnmuted) return; // Once unmuted, NEVER show again!
    let btn = document.getElementById("liveUnmutePromptBtn");
    const container = document.getElementById("edupeakLivePlayerViewport")
                   || document.getElementById("edupeakLivePlayerWrapper")
                   || document.getElementById("liveCustomPlayerContainer")
                   || document.body;

    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "liveUnmutePromptBtn";
      btn.className = "edupeak-live-unmute-btn";
      btn.innerHTML = '<span class="live-pulse-dot" style="width:8px;height:8px;background:#fff;box-shadow:none;display:inline-block;"></span> LIVE &nbsp;&#8226;&nbsp; <i class="fa-solid fa-volume-high"></i> Tap to Unmute';
      container.appendChild(btn);
    } else if (btn.parentElement !== container) {
      container.appendChild(btn);
    }

    const handleUnmuteClick = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      _hasUserUnmuted = true;
      _hideUnmutePrompt();
      _unmute();
    };
    btn.onclick = handleUnmuteClick;
    btn.ontouchend = handleUnmuteClick;

    btn.classList.remove("hidden");
    btn.classList.add("visible");
    btn.style.setProperty("display", "inline-flex", "important");
  }

  function _hideUnmutePrompt() {
    const btn = document.getElementById("liveUnmutePromptBtn");
    if (btn) {
      btn.classList.remove("visible");
      btn.classList.add("hidden");
      btn.style.setProperty("display", "none", "important");
    }
  }

  function _unmute() {
    _hasUserUnmuted = true;
    _hideUnmutePrompt();
    if (isSessionEnded) return;   // session over — no replay
    try {
      if (liveYtPlayer) {
        liveYtPlayer.unMute();
        const targetVol = (liveVolume && liveVolume > 0) ? liveVolume : 100;
        liveVolume = targetVol;
        liveYtPlayer.setVolume(targetVol);
        liveYtPlayer.playVideo();
      }
      const icon = document.getElementById("livePlayerVolumeIcon");
      if (icon) icon.className = (liveVolume < 50 ? "fa-solid fa-volume-low" : "fa-solid fa-volume-high");
      const slider = document.getElementById("livePlayerVolumeSlider");
      if (slider) slider.value = liveVolume || 100;
      const bigPlayBtn = document.getElementById("livePlayerBigPlayBtn");
      if (bigPlayBtn) bigPlayBtn.classList.add("hidden");
    } catch(e) {}
  }
  // ─────────────────────────────────────────────────────────────────────────

  function joinStream() {
    _unmute();
    if (liveYtPlayer && typeof liveYtPlayer.playVideo === "function") {
      try {
        liveYtPlayer.playVideo();
        if (typeof liveYtPlayer.unMute === "function") {
          liveYtPlayer.unMute();
        }
        liveYtPlayer.setVolume(liveVolume || 100);
      } catch (e) {}
    }
    isLivePlaying = true;
    const bigPlayBtn = document.getElementById("livePlayerBigPlayBtn");
    if (bigPlayBtn) bigPlayBtn.classList.add("hidden");
  }

  let shieldClickAttempts = 0;
  function onShieldClick() {
    // Live Broadcast streams cannot be paused by students clicking the screen.
    // If not currently playing, clicking connects/joins the stream.
    if (!isLivePlaying) {
      shieldClickAttempts++;
      joinStream();
      // If user clicks 2+ times while not playing, disable pointer events on shield so direct clicks reach YouTube iframe (play button / sign in)
      if (shieldClickAttempts >= 2) {
        const shield = document.getElementById("livePlayerClickShield");
        if (shield) {
          shield.style.pointerEvents = "none";
          setTimeout(() => {
            if (shield && isLivePlaying) shield.style.pointerEvents = "";
          }, 10000);
        }
      }
      return;
    }
    shieldClickAttempts = 0;
    // If player is currently muted, clicking anywhere on the video immediately unmutes it!
    if (_isMuted()) {
      _unmute();
      return;
    }
    // If stream is active and unmuted, pulse controls overlay briefly for volume/quality adjustment without pausing.
    const overlay = document.getElementById("livePlayerControlsOverlay");
    if (overlay) {
      overlay.style.opacity = "1";
      clearTimeout(overlay._hideTimeout);
      overlay._hideTimeout = setTimeout(() => {
        overlay.style.opacity = "";
      }, 3000);
    }
  }

  function togglePlayPause() {
    // Students cannot pause live streams. If paused, join stream.
    if (!isLivePlaying) {
      joinStream();
    }
  }

  function play() {
    joinStream();
  }

  function pause() {
    // Programmatic pause (e.g., closing LMS portal or switching tabs)
    if (liveYtPlayer && typeof liveYtPlayer.pauseVideo === "function") {
      try { liveYtPlayer.pauseVideo(); } catch (e) {}
    }
    isLivePlaying = false;
    const bigPlayBtn = document.getElementById("livePlayerBigPlayBtn");
    if (bigPlayBtn) bigPlayBtn.classList.remove("hidden");
  }

  function setVolume(val) {
    liveVolume = parseInt(val, 10);
    if (liveYtPlayer) {
      if (liveVolume > 0 && liveYtPlayer.isMuted && liveYtPlayer.isMuted()) {
        try { liveYtPlayer.unMute(); } catch (e) {}
        _hideUnmutePrompt();
      }
      if (liveYtPlayer.setVolume) {
        liveYtPlayer.setVolume(liveVolume);
      }
    }
    const icon = document.getElementById("livePlayerVolumeIcon");
    if (icon) {
      icon.className = liveVolume === 0 ? "fa-solid fa-volume-xmark" : (liveVolume < 50 ? "fa-solid fa-volume-low" : "fa-solid fa-volume-high");
    }
  }

  function toggleMute() {
    if (!liveYtPlayer) return;
    if (liveYtPlayer.isMuted()) {
      _unmute();
    } else {
      liveYtPlayer.mute();
      const icon = document.getElementById("livePlayerVolumeIcon");
      if (icon) icon.className = "fa-solid fa-volume-xmark";
      const slider = document.getElementById("livePlayerVolumeSlider");
      if (slider) slider.value = 0;
    }
  }

  function toggleQualityMenu() {
    const menu = document.getElementById("livePlayerQualityMenu");
    if (menu) menu.classList.toggle("active");
  }

  function setPlaybackQuality(quality, btnEl) {
    liveQuality = quality;
    if (liveYtPlayer && liveYtPlayer.setPlaybackQuality) {
      try {
        if (quality === 'auto') {
          liveYtPlayer.setPlaybackQuality('default');
        } else {
          liveYtPlayer.setPlaybackQuality(quality);
          if (liveYtPlayer.setPlaybackQualityRange) {
            liveYtPlayer.setPlaybackQualityRange(quality, quality);
          }
        }
      } catch (e) {}
    }

    const qualityLabelMap = {
      'auto': 'Auto',
      'hd1080': '1080p HD',
      'hd720': '720p HD',
      'large': '480p',
      'medium': '360p'
    };
    const displayLabel = qualityLabelMap[quality] || quality;
    const labelEl = document.getElementById("livePlayerQualityLabel");
    if (labelEl) labelEl.textContent = displayLabel;

    const topResBadge = document.querySelector("#edupeakLivePlayerWrapper .res-badge");
    if (topResBadge) {
      const badgeText = quality === 'auto' ? '1080p HD' : (displayLabel.includes('HD') ? displayLabel : `${displayLabel} Stream`);
      topResBadge.innerHTML = `<i class="fa-solid fa-bolt"></i> ${badgeText}`;
    }

    const menu = document.getElementById("livePlayerQualityMenu");
    if (menu) {
      menu.querySelectorAll("button").forEach(b => {
        b.classList.toggle("active", b === btnEl || b.getAttribute("onclick")?.includes(quality));
      });
      menu.classList.remove("active");
    }

    if (window.showToast) {
      window.showToast(`⚡ Live Stream Quality: ${displayLabel}`, "info");
    }
  }

  function toggleFullscreen() {
    const wrapper = document.getElementById("edupeakLivePlayerWrapper");
    if (!wrapper) return;

    const fsElement = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    const isPseudoFs = wrapper.classList.contains("fullscreen-mode");

    const updateFsIcon = (isFs) => {
      const fsBtns = document.querySelectorAll("#edupeakLivePlayerWrapper button[title='Fullscreen'], #livePlayerControlsOverlay .fa-expand, #livePlayerControlsOverlay .fa-compress");
      fsBtns.forEach(btn => {
        const icon = btn.tagName === "I" ? btn : btn.querySelector("i");
        if (icon) icon.className = isFs ? "fa-solid fa-compress" : "fa-solid fa-expand";
      });
    };

    if (!fsElement && !isPseudoFs) {
      wrapper.classList.add("fullscreen-mode");
      updateFsIcon(true);
      if (typeof wrapper.requestFullscreen === "function") {
        wrapper.requestFullscreen().catch(() => {});
      } else if (typeof wrapper.webkitRequestFullscreen === "function") {
        try { wrapper.webkitRequestFullscreen(); } catch(e) {}
      }
    } else {
      wrapper.classList.remove("fullscreen-mode");
      updateFsIcon(false);
      if (document.exitFullscreen && fsElement) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen && fsElement) {
        try { document.webkitExitFullscreen(); } catch(e) {}
      }
    }
  }

  function setWatermarkEnabled(enabled) {
    isWatermarkEnabled = Boolean(enabled);
    const wm = document.getElementById("livePlayerDrmWatermark");
    if (wm) {
      wm.style.display = isWatermarkEnabled ? "flex" : "none";
    }
  }

  function updateLiveWatermark() {
    const textEl = document.getElementById("livePlayerWatermarkText");
    if (!textEl) return;
    let studentNic = "200512345678";
    if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.getCurrentUser) {
      const user = window.AUTH_SYSTEM.getCurrentUser();
      if (user && user.nic) studentNic = user.nic;
    }
    textEl.textContent = studentNic;
  }

  function startLiveWatermarkMovement() {
    const watermark = document.getElementById("livePlayerDrmWatermark");
    if (!watermark) return;
    const positions = [
      { top: "20%", left: "20%" },
      { top: "25%", left: "70%" },
      { top: "65%", left: "25%" },
      { top: "70%", left: "65%" }
    ];
    let posIdx = 0;
    setInterval(() => {
      posIdx = (posIdx + 1) % positions.length;
      const p = positions[posIdx];
      watermark.style.top = p.top;
      watermark.style.left = p.left;
    }, 9000);
  }

  function setupLivePlayerEvents() {
    document.addEventListener("click", (e) => {
      const liveQWrapper = document.querySelector("#edupeakLivePlayerWrapper .quality-selector-wrapper");
      const liveQMenu = document.getElementById("livePlayerQualityMenu");
      if (liveQMenu && liveQWrapper && !liveQWrapper.contains(e.target)) {
        liveQMenu.classList.remove("active");
      }
    });

    const handleNativeFullscreenChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      const wrapper = document.getElementById("edupeakLivePlayerWrapper");
      if (!fsEl && wrapper) {
        wrapper.classList.remove("fullscreen-mode");
        const fsBtns = document.querySelectorAll("#edupeakLivePlayerWrapper button[title='Fullscreen'], #livePlayerControlsOverlay .fa-expand, #livePlayerControlsOverlay .fa-compress");
        fsBtns.forEach(btn => {
          const icon = btn.tagName === "I" ? btn : btn.querySelector("i");
          if (icon) icon.className = "fa-solid fa-expand";
        });
      }
    };
    document.addEventListener("fullscreenchange", handleNativeFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleNativeFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleNativeFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleNativeFullscreenChange);
  }

  function dismissBotPrompt() {
    const fallbackEl = document.getElementById("livePlayerBotCheckFallback");
    if (fallbackEl) fallbackEl.style.display = "none";
    const shield = document.getElementById("livePlayerClickShield");
    if (shield) shield.style.pointerEvents = "none";
    const unmuter = document.getElementById("liveUnmutePromptBtn");
    if (unmuter) unmuter.style.display = "none";
    const bigPlayBtn = document.getElementById("livePlayerBigPlayBtn");
    if (bigPlayBtn) bigPlayBtn.classList.add("hidden");
  }

  function showBotFallbackPrompt() {
    const fallbackEl = document.getElementById("livePlayerBotCheckFallback");
    if (fallbackEl) fallbackEl.style.display = "flex";
    const shield = document.getElementById("livePlayerClickShield");
    if (shield) shield.style.pointerEvents = "none";
  }

  try {
    window.addEventListener("beforeunload", () => {
      try {
        if (liveYtPlayer && typeof liveYtPlayer.getCurrentTime === "function") {
          const curTime = liveYtPlayer.getCurrentTime();
          if (curTime > 1) {
            const sessId = (activeSessionData && (activeSessionData.id || activeSessionData.scheduleId))
              || (window.LIVE_APP ? window.LIVE_APP.activeSessionId : null);
            const vId = (typeof liveYtPlayer.getVideoData === "function" && liveYtPlayer.getVideoData()?.video_id) || "";
            if (sessId) localStorage.setItem("edupeak_live_playback_" + sessId, String(Math.floor(curTime)));
            if (vId) localStorage.setItem("edupeak_live_playback_" + vId, String(Math.floor(curTime)));
          }
        }
      } catch(e) {}
    });
  } catch(e) {}

  return {
    init: initLivePlayer,
    loadLiveStream: loadLiveStream,
    loadStream: loadLiveStream,
    joinStream: joinStream,
    unmute: _unmute,
    onShieldClick: onShieldClick,
    togglePlayPause: togglePlayPause,
    play: play,
    pause: pause,
    setVolume: setVolume,
    toggleMute: toggleMute,
    toggleQualityMenu: toggleQualityMenu,
    setPlaybackQuality: setPlaybackQuality,
    toggleFullscreen: toggleFullscreen,
    setWatermarkEnabled: setWatermarkEnabled,
    updateLiveWatermark: updateLiveWatermark,
    onStreamEnded: function(cb) { if (typeof cb === "function") streamEndCallbacks.push(cb); },
    getElapsedSeconds: getElapsedSeconds,
    setSessionData: function(s) { activeSessionData = s; },
    triggerLiveEnded: triggerLiveEnded,
    dismissBotPrompt: dismissBotPrompt,
    showBotFallbackPrompt: showBotFallbackPrompt
  };
})();

window.EDUPEAK_LIVE_PLAYER = EDUPEAK_LIVE_PLAYER;

