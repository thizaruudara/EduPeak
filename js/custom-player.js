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

      // Record final watched time to EDUPEAK_WATCH_TRACKER
      try {
        if (window.EDUPEAK_WATCH_TRACKER && window.LMS_STATE && window.EDUPEAK_DATA && window.EDUPEAK_DATA.lmsLessons) {
          const curLesson = window.EDUPEAK_DATA.lmsLessons[window.LMS_STATE.currentLessonIndex];
          if (curLesson && curLesson.id) {
            const curT = (ytPlayer && typeof ytPlayer.getCurrentTime === "function") ? ytPlayer.getCurrentTime() : currentTime;
            const durT = (ytPlayer && typeof ytPlayer.getDuration === "function") ? ytPlayer.getDuration() : duration;
            window.EDUPEAK_WATCH_TRACKER.recordWatch(curLesson.id, "lesson", curLesson.courseId, curT, durT);
          }
        }
      } catch(e) {}
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
    const isPseudoFs = playerWrapper.classList.contains("fullscreen-mode");
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

    if (!fsElement && !isPseudoFs) {
      if (icon) icon.className = "fa-solid fa-compress";
      playerWrapper.classList.add("fullscreen-mode");
      document.body.classList.add("edupeak-fullscreen-locked");

      const isPortrait = window.matchMedia && window.matchMedia("(orientation: portrait)").matches;
      const isMobile = window.innerWidth <= 900 || window.innerHeight <= 900;
      if (isPortrait && isMobile) {
        playerWrapper.classList.add("mobile-landscape-rotate");
      }

      if (screen.orientation && typeof screen.orientation.lock === "function") {
        screen.orientation.lock("landscape").catch(() => {});
      }

      if (playerWrapper.requestFullscreen) {
        playerWrapper.requestFullscreen().catch(() => {});
      } else if (playerWrapper.webkitRequestFullscreen) {
        try { playerWrapper.webkitRequestFullscreen(); } catch(e) {}
      } else if (playerWrapper.msRequestFullscreen) {
        try { playerWrapper.msRequestFullscreen(); } catch(e) {}
      }
    } else {
      if (icon) icon.className = "fa-solid fa-expand";
      playerWrapper.classList.remove("fullscreen-mode", "mobile-landscape-rotate");
      document.body.classList.remove("edupeak-fullscreen-locked");

      if (screen.orientation && typeof screen.orientation.unlock === "function") {
        try { screen.orientation.unlock(); } catch(e) {}
      }

      if (document.exitFullscreen && fsElement) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen && fsElement) {
        try { document.webkitExitFullscreen(); } catch(e) {}
      } else if (document.msExitFullscreen && fsElement) {
        try { document.msExitFullscreen(); } catch(e) {}
      }
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

        // Periodic watch progress persistence
        if (!isDraggingProgress && Math.floor(currentTime) % 5 === 0) {
          try {
            if (window.EDUPEAK_WATCH_TRACKER && window.LMS_STATE && window.EDUPEAK_DATA && window.EDUPEAK_DATA.lmsLessons) {
              const curLesson = window.EDUPEAK_DATA.lmsLessons[window.LMS_STATE.currentLessonIndex];
              if (curLesson && curLesson.id) {
                window.EDUPEAK_WATCH_TRACKER.recordWatch(curLesson.id, "lesson", curLesson.courseId, currentTime, duration);
              }
            }
          } catch(e) {}
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

  // Clean Native Video State (Agora WebRTC & Direct OBS HLS)
  let activeCleanMode = null; // 'agora' | 'custom_hls' | null
  let agoraClient = null;
  let hlsInstance = null;
  let agoraRemoteAudioTracks = [];

  function initLivePlayer(videoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ", sessionData = null) {
    if (sessionData) activeSessionData = sessionData;
    const videoId = extractYouTubeId(videoUrl);
    createLiveYTPlayer(videoId);
    updateLiveWatermark();
    triggerStartupBanners(10000);
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

  let lastLiveSyncTime = 0;

  function syncToLiveEdge(force = false) {
    if (!liveYtPlayer) return;
    const now = Date.now();
    if (!force && (now - lastLiveSyncTime < 15000)) return; // 15s cooldown to prevent any oscillation
    try {
      const isLive = typeof liveYtPlayer.getVideoData === "function" && liveYtPlayer.getVideoData()?.isLive;
      const curTime = typeof liveYtPlayer.getCurrentTime === "function" ? liveYtPlayer.getCurrentTime() : 0;
      const dur = typeof liveYtPlayer.getDuration === "function" ? liveYtPlayer.getDuration() : 0;

      if (isLive) {
        // Only seek if genuinely lagging behind live buffer (> 25s)
        if (dur > 0 && (force || (dur - curTime > 25))) {
          lastLiveSyncTime = now;
          liveYtPlayer.seekTo(dur, true);
        }
      } else {
        const targetElapsed = getElapsedSeconds();
        if (targetElapsed > 0 && (force || Math.abs(curTime - targetElapsed) > 15)) {
          lastLiveSyncTime = now;
          liveYtPlayer.seekTo(targetElapsed, true);
        }
      }
    } catch(e) {}
  }

  function getPlaybackResumeSeconds(videoId) {
    // For live broadcasts, NEVER resume from past saved positions!
    // The player must synchronize directly to the real-time live moment (0 delay).
    const isLiveBroadcast = !activeSessionData || activeSessionData.status === "live";
    if (isLiveBroadcast) {
      return getElapsedSeconds();
    }
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
    if (agoraClient) {
      try { agoraClient.leave(); } catch(e) {}
      agoraClient = null;
    }
    if (hlsInstance) {
      try { hlsInstance.destroy(); } catch(e) {}
      hlsInstance = null;
    }
    agoraRemoteAudioTracks = [];
    const cleanVideo = document.getElementById("cleanLiveVideoElement");
    if (cleanVideo) {
      try { cleanVideo.pause(); cleanVideo.src = ""; } catch(e) {}
    }
    isLivePlaying = false;
    releaseLiveWakeLock();

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
    } else if (sessionId) {
      const nowIso = new Date().toISOString();
      try {
        let scheds = JSON.parse(localStorage.getItem("edupeak_schedules_db") || "[]");
        const s = scheds.find(item => item.id === sessionId);
        if (s) {
          s.status = "ended";
          s.endedAt = nowIso;
          localStorage.setItem("edupeak_schedules_db", JSON.stringify(scheds));
        }
      } catch(e) {}
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.updateLiveSessionStatus === "function") {
        try { window.SUPABASE_HELPER.updateLiveSessionStatus(sessionId, "ended", { endedAt: nowIso }); } catch(e) {}
      }
    }
  }

  function checkAndEnforceLiveStream() {
    if (!liveYtPlayer || isSessionEnded) return false;
    const isLiveSession = !activeSessionData || activeSessionData.status === "live";
    if (!isLiveSession) return false;

    try {
      const videoData = typeof liveYtPlayer.getVideoData === "function" ? liveYtPlayer.getVideoData() : null;
      const vidDuration = typeof liveYtPlayer.getDuration === "function" ? liveYtPlayer.getDuration() : 0;

      if (videoData && videoData.video_id) {
        // YouTube API: isLive is true/1 during active live streams.
        // For ended streams or recorded videos, isLive is false/0/undefined AND duration > 0.
        const isRealLive = Boolean(videoData.isLive);
        if (!isRealLive && vidDuration > 0) {
          console.warn("[EduPeak Live Player] YouTube stream has concluded (isLive is false, duration > 0). Ending live session immediately:", activeSessionData?.id);
          try { liveYtPlayer.stopVideo(); } catch(e) {}
          triggerLiveEnded();
          return true;
        }
      }
    } catch(e) {}
    return false;
  }

  function startDurationWatchdog() {
    stopDurationWatchdog();
    durationCheckInterval = setInterval(() => {
      if (!liveYtPlayer) return;
      try {
        const videoData = typeof liveYtPlayer.getVideoData === "function" ? liveYtPlayer.getVideoData() : null;
        const isLiveType = videoData && Boolean(videoData.isLive);
        const isLiveSession = !activeSessionData || activeSessionData.status === "live";
        const curTime = typeof liveYtPlayer.getCurrentTime === "function" ? liveYtPlayer.getCurrentTime() : 0;
        const vidDuration = typeof liveYtPlayer.getDuration === "function" ? liveYtPlayer.getDuration() : 0;

        const playerState = typeof liveYtPlayer.getPlayerState === "function" ? liveYtPlayer.getPlayerState() : -1;
        if (playerState === 0) {
          triggerLiveEnded();
          return;
        }

        // Strictly verify live status: if session is marked "live" but YouTube reports an ended archived video, conclude it immediately!
        if (isLiveSession && videoData && videoData.video_id) {
          if (!isLiveType && vidDuration > 0) {
            console.warn("[EduPeak Watchdog] Stream is not live on YouTube. Ending broadcast:", activeSessionData?.id);
            triggerLiveEnded();
            return;
          }
        }

        // If it's a concluded or non-live session, allow saving playback
        if (!isLiveSession && curTime > 1) {
          const sessId = (activeSessionData && (activeSessionData.id || activeSessionData.scheduleId))
            || (window.LIVE_APP ? window.LIVE_APP.activeSessionId : null);
          const vId = (videoData && videoData.video_id) || "";
          try {
            if (sessId) localStorage.setItem("edupeak_live_playback_" + sessId, String(Math.floor(curTime)));
            if (vId) localStorage.setItem("edupeak_live_playback_" + vId, String(Math.floor(curTime)));
          } catch(e) {}
        }

        // Keep synchronized with live timing smoothly (NO micro-seeking while stream is healthy)
        if (isLiveSession && isLiveType) {
          const now = Date.now();
          // Real YouTube live stream: only sync if student lagged behind significantly (> 25s) with 20s cooldown
          if (vidDuration > 0 && curTime > 0 && (vidDuration - curTime > 25) && (now - lastLiveSyncTime > 20000)) {
            lastLiveSyncTime = now;
            try { liveYtPlayer.seekTo(vidDuration, true); } catch(e) {}
          }
        }

        if (!isLiveType && vidDuration > 0) {
          if ((curTime >= vidDuration - 1.2 || curTime >= vidDuration) && curTime > 0) {
            triggerLiveEnded();
            return;
          }
        }
      } catch(e) {}
    }, 3000);
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
    isSessionEnded = false;

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

    const isLiveBroadcast = !activeSessionData || activeSessionData.status === "live";
    const initialStart = (!isLiveBroadcast && resumeSec > 0) ? resumeSec : 0;

    const pVars = {
      autoplay: 1,
      mute: 1,        // muted autoplay is allowed by all browsers
      controls: 0,
      enablejsapi: 1,
      fs: 0,
      rel: 0,
      playsinline: 1,
      origin: window.location.origin,
      widget_referrer: window.location.href
    };
    if (initialStart > 0) {
      pVars.start = initialStart;
    }

    try {
      liveYtPlayer = new window.YT.Player('edupeakLiveYTPlayerMount', {
        host: 'https://www.youtube.com',
        videoId: videoId,
        playerVars: pVars,
        events: {
          'onReady': () => {
            try {
              triggerStartupMask();
              _showUnmutePrompt();
              startDurationWatchdog();
              setTimeout(() => {
                checkAndEnforceLiveStream();
              }, 600);
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
              requestLiveWakeLock();
              if (checkAndEnforceLiveStream()) {
                return;
              }
              if (bigPlayBtn) bigPlayBtn.classList.add("hidden");
              updateLiveWatermark();
              startDurationWatchdog();
              triggerStartupMask();
              scheduleLiveControlsFade();

              // Smooth playback: do NOT seek while stream is already playing
              // YouTube Live naturally maintains the live edge

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

              // Check user role: students are NOT allowed to stop or pause live broadcasts
              const user = (window.AUTH_SYSTEM && window.AUTH_SYSTEM.getCurrentUser) ? window.AUTH_SYSTEM.getCurrentUser() : null;
              const isStaff = user && (user.role === "teacher" || user.role === "admin");
              const isLiveSession = !activeSessionData || activeSessionData.status === "live";

              if (!isStaff && isLiveSession) {
                // Instantly resume live stream smoothly (no seekTo to avoid stutter/buffer loop)
                isLivePlaying = true;
                try {
                  liveYtPlayer.playVideo();
                } catch(e) {}
                return;
              }

              isLivePlaying = false;
              showLiveControls();
              // Check if paused because the video reached the end
              const curTime = typeof liveYtPlayer.getCurrentTime === "function" ? liveYtPlayer.getCurrentTime() : 0;
              const vidDuration = typeof liveYtPlayer.getDuration === "function" ? liveYtPlayer.getDuration() : 0;
              const isLiveType = typeof liveYtPlayer.getVideoData === "function" && liveYtPlayer.getVideoData()?.isLive;
              if (!isLiveType && vidDuration > 0 && curTime >= vidDuration - 2) {
                triggerLiveEnded();
                return;
              }
              if (!_hasUserUnmuted) {
                try { liveYtPlayer.mute(); liveYtPlayer.playVideo(); } catch(e) {}
                _showUnmutePrompt();
              }
            } else if (event.data === ENDED) {
              triggerLiveEnded();
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
    if (sessionData && (sessionData.streamProvider === "agora" || sessionData.provider === "agora" || sessionData.streamProvider === "custom_hls" || sessionData.provider === "custom_hls")) {
      return loadCleanLiveStream(url, sessionData, sessionData.streamProvider || sessionData.provider);
    }
    // Switch off clean native player when returning to YouTube
    activeCleanMode = null;
    if (agoraClient) { try { agoraClient.leave(); } catch(e) {} agoraClient = null; }
    if (hlsInstance) { try { hlsInstance.destroy(); } catch(e) {} hlsInstance = null; }
    agoraRemoteAudioTracks = [];
    const cleanMount = document.getElementById("cleanLiveVideoMount");
    if (cleanMount) cleanMount.style.display = "none";
    const ytCropper = document.getElementById("edupeakYtCropperWrapper");
    if (ytCropper) ytCropper.style.display = "";

    setupLivePlayerEvents();
    isSessionEnded = false;
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
        triggerStartupMask();
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

    triggerStartupMask();
    updateLiveWatermark();
  }

  async function loadCleanLiveStream(url, sessionData = null, mode = "agora") {
    setupLivePlayerEvents();
    isSessionEnded = false;
    if (sessionData) {
      activeSessionData = sessionData;
      if (sessionData.id && sessionData.startedAt) {
        try { localStorage.setItem("edupeak_session_started_" + sessionData.id, sessionData.startedAt); } catch(e) {}
      }
    }

    const provider = mode || (sessionData && (sessionData.streamProvider || sessionData.provider)) || "agora";
    activeCleanMode = provider;

    // Shut down YouTube live player if active
    if (liveYtPlayer) {
      try { liveYtPlayer.stopVideo(); } catch(e) {}
      try { liveYtPlayer.destroy(); } catch(e) {}
      liveYtPlayer = null;
    }

    // Hide YouTube frame mount and display clean native video mount
    const ytCropper = document.getElementById("edupeakYtCropperWrapper");
    if (ytCropper) ytCropper.style.display = "none";

    const cleanMount = document.getElementById("cleanLiveVideoMount");
    if (cleanMount) cleanMount.style.display = "block";

    // Clean up any existing Agora or HLS instances
    if (agoraClient) { try { await agoraClient.leave(); } catch(e) {} agoraClient = null; }
    if (hlsInstance) { try { hlsInstance.destroy(); } catch(e) {} hlsInstance = null; }
    agoraRemoteAudioTracks = [];

    if (provider === "agora") {
      await initAgoraAudiencePlayback(sessionData);
    } else {
      initHlsPlayback(url || (sessionData && (sessionData.hlsUrl || sessionData.rawUrl)), sessionData);
    }

    isLivePlaying = true;
    updateLiveWatermark();
    startLiveWatermarkMovement();
    startDurationWatchdog();
    triggerStartupBanners(10000);
    scheduleLiveControlsFade();
  }

  async function initAgoraAudiencePlayback(sessionData) {
    const agoraBox = document.getElementById("agoraRemoteVideoBox");
    const cleanVideo = document.getElementById("cleanLiveVideoElement");
    if (cleanVideo) {
      cleanVideo.style.display = "none";
      try { cleanVideo.pause(); } catch(e) {}
    }
    if (agoraBox) {
      agoraBox.style.display = "block";
      agoraBox.innerHTML = "";
    }

    if (!window.AgoraRTC) {
      console.warn("[Agora Audience] AgoraRTC SDK is loading or not available.");
      if (agoraBox) {
        agoraBox.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;text-align:center;padding:1.5rem;">
            <div>
              <i class="fa-solid fa-satellite-dish" style="font-size:2rem;margin-bottom:0.75rem;color:#f59e0b;"></i>
              <p style="font-weight:600;color:#fff;">Connecting to Real-time Stream...</p>
              <small style="color:#94a3b8;">Agora WebRTC Client initializing</small>
            </div>
          </div>`;
      }
      return;
    }

    const appId = (sessionData && sessionData.agoraAppId)
      || localStorage.getItem("edupeak_agora_app_id")
      || (window.EDUPEAK_AGORA_DEFAULT_APP_ID || "13256742c55e4a7687838c72cd148cad");
    const channel = (sessionData && (sessionData.agoraChannel || sessionData.channel))
      || (sessionData && sessionData.id ? `edupeak_${sessionData.id.replace(/[^a-zA-Z0-9_-]/g, '')}` : "edupeak_main_live");

    try {
      agoraClient = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      await agoraClient.setClientRole("audience", { level: 1 });

      agoraClient.on("user-published", async (user, mediaType) => {
        try {
          await agoraClient.subscribe(user, mediaType);
          if (mediaType === "video") {
            const remoteVideoTrack = user.videoTrack;
            if (agoraBox) {
              remoteVideoTrack.play("agoraRemoteVideoBox");
            }
          }
          if (mediaType === "audio") {
            const remoteAudioTrack = user.audioTrack;
            if (!agoraRemoteAudioTracks.includes(remoteAudioTrack)) {
              agoraRemoteAudioTracks.push(remoteAudioTrack);
            }
            remoteAudioTrack.play();
            remoteAudioTrack.setVolume(liveVolume);
          }
          isLivePlaying = true;
          requestLiveWakeLock();
          const bigPlayBtn = document.getElementById("livePlayerBigPlayBtn");
          if (bigPlayBtn) bigPlayBtn.classList.add("hidden");
        } catch (subErr) {
          console.error("[Agora Audience] Subscribe failed:", subErr);
        }
      });

      agoraClient.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "audio" && user.audioTrack) {
          agoraRemoteAudioTracks = agoraRemoteAudioTracks.filter(t => t !== user.audioTrack);
        }
      });

      let rtcToken = (sessionData && (sessionData.agoraToken || sessionData.token)) || null;
      if (!rtcToken) {
        try {
          const tokRes = await fetch(`/api/agora/token?channel=${encodeURIComponent(channel)}&role=subscriber`);
          if (tokRes.ok) {
            const tokJson = await tokRes.json();
            if (tokJson && tokJson.token) rtcToken = tokJson.token;
          }
        } catch (tokErr) {
          console.warn("[Agora Audience] Token endpoint fallback:", tokErr);
        }
      }

      await agoraClient.join(appId, channel, rtcToken || null, null);
      console.log(`[Agora Audience] Joined channel: ${channel}`);
    } catch (err) {
      console.error("[Agora Audience] Join error:", err);
      if (agoraBox) {
        agoraBox.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f59e0b;text-align:center;padding:1.5rem;">
            <div>
              <i class="fa-solid fa-tower-broadcast" style="font-size:2.2rem;margin-bottom:0.75rem;color:#38bdf8;"></i>
              <p style="font-weight:600;color:#fff;font-size:1.05rem;">Live Broadcast Standby</p>
              <small style="color:#94a3b8;">Waiting for teacher broadcast on channel <b>${channel}</b></small>
            </div>
          </div>`;
      }
    }
  }

  function initHlsPlayback(streamUrl, sessionData) {
    const agoraBox = document.getElementById("agoraRemoteVideoBox");
    const cleanVideo = document.getElementById("cleanLiveVideoElement");
    if (agoraBox) {
      agoraBox.style.display = "none";
      agoraBox.innerHTML = "";
    }
    if (!cleanVideo) return;
    cleanVideo.style.display = "block";
    cleanVideo.onplaying = () => {
      isLivePlaying = true;
      requestLiveWakeLock();
    };

    const hlsUrl = streamUrl || (sessionData && (sessionData.hlsUrl || sessionData.rawUrl || sessionData.streamUrl)) || "";
    if (!hlsUrl) {
      console.warn("[EduPeak HLS] No HLS URL provided.");
      return;
    }

    if (window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 3
      });
      hlsInstance.loadSource(hlsUrl);
      hlsInstance.attachMedia(cleanVideo);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
        cleanVideo.volume = (liveVolume / 100);
        cleanVideo.play().catch(() => {
          _showUnmutePrompt();
        });
      });
      hlsInstance.on(Hls.Events.ERROR, function(event, data) {
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("[EduPeak HLS] Network issue, reconnecting...", data);
              hlsInstance.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("[EduPeak HLS] Media decode issue, recovering...", data);
              hlsInstance.recoverMediaError();
              break;
            default:
              console.error("[EduPeak HLS] Fatal error:", data);
              hlsInstance.destroy();
              break;
          }
        }
      });
    } else if (cleanVideo.canPlayType("application/vnd.apple.mpegurl")) {
      cleanVideo.src = hlsUrl;
      cleanVideo.volume = (liveVolume / 100);
      cleanVideo.play().catch(() => {
        _showUnmutePrompt();
      });
    }
  }

  // ── Unmute helpers ──────────────────────────────────────────────────────
  let _hasUserUnmuted = false;

  function _isMuted() {
    if (activeCleanMode === "agora") {
      return liveVolume === 0;
    }
    if (activeCleanMode === "custom_hls") {
      const cleanVideo = document.getElementById("cleanLiveVideoElement");
      return cleanVideo ? (cleanVideo.muted || cleanVideo.volume === 0) : false;
    }
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

  let liveControlsTimeout = null;

  function showLiveControls() {
    const controls = document.getElementById("livePlayerControlsOverlay");
    const topBar = document.getElementById("livePlayerTopBar");
    const wrapper = document.getElementById("edupeakLivePlayerWrapper");
    if (controls) {
      controls.classList.remove("fade-out");
      controls.style.opacity = "";
    }
    if (topBar) {
      topBar.classList.remove("fade-out");
      topBar.style.opacity = "";
    }
    if (wrapper) wrapper.classList.remove("hide-cursor");
  }

  function hideLiveControls() {
    if (!isLivePlaying) return;
    const controls = document.getElementById("livePlayerControlsOverlay");
    const topBar = document.getElementById("livePlayerTopBar");
    const wrapper = document.getElementById("edupeakLivePlayerWrapper");
    if (controls) {
      controls.classList.add("fade-out");
      controls.style.opacity = "";
    }
    if (topBar) {
      topBar.classList.add("fade-out");
      topBar.style.opacity = "";
    }
    if (wrapper) wrapper.classList.add("hide-cursor");
  }

  function scheduleLiveControlsFade() {
    clearTimeout(liveControlsTimeout);
    showLiveControls();
    if (isLivePlaying) {
      liveControlsTimeout = setTimeout(() => {
        hideLiveControls();
      }, 2800);
    }
  }

  function _unmute() {
    _hasUserUnmuted = true;
    _hideUnmutePrompt();
    if (isSessionEnded) return;   // session over — no replay
    try {
      const targetVol = (liveVolume && liveVolume > 0) ? liveVolume : 100;
      liveVolume = targetVol;

      if (liveYtPlayer) {
        liveYtPlayer.unMute();
        liveYtPlayer.setVolume(targetVol);
        liveYtPlayer.playVideo();
      }
      if (activeCleanMode === "agora") {
        agoraRemoteAudioTracks.forEach(t => { try { t.setVolume(targetVol); } catch(e) {} });
      } else if (activeCleanMode === "custom_hls") {
        const cleanVideo = document.getElementById("cleanLiveVideoElement");
        if (cleanVideo) {
          cleanVideo.muted = false;
          cleanVideo.volume = targetVol / 100;
          cleanVideo.play().catch(() => {});
        }
      }
      const icon = document.getElementById("livePlayerVolumeIcon");
      if (icon) icon.className = (liveVolume < 50 ? "fa-solid fa-volume-low" : "fa-solid fa-volume-high");
      const slider = document.getElementById("livePlayerVolumeSlider");
      if (slider) slider.value = liveVolume || 100;
      const bigPlayBtn = document.getElementById("livePlayerBigPlayBtn");
      if (bigPlayBtn) bigPlayBtn.classList.add("hidden");
    } catch(e) {}
    triggerStartupBanners(10000);
    scheduleLiveControlsFade();
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
    if (activeCleanMode === "custom_hls") {
      const cleanVideo = document.getElementById("cleanLiveVideoElement");
      if (cleanVideo) {
        cleanVideo.muted = false;
        cleanVideo.play().catch(() => {});
      }
    }
    isLivePlaying = true;
    const bigPlayBtn = document.getElementById("livePlayerBigPlayBtn");
    if (bigPlayBtn) bigPlayBtn.classList.add("hidden");
    scheduleLiveControlsFade();
  }

  let shieldClickAttempts = 0;
  function onShieldClick() {
    // Live Broadcast streams cannot be paused by students clicking the screen.
    // If not currently playing, clicking connects/joins the stream.
    if (!isLivePlaying) {
      shieldClickAttempts++;
      joinStream();
      // If user clicks 2+ times while not playing, disable pointer events on shield so direct clicks reach YouTube iframe (play button / sign in)
      if (shieldClickAttempts >= 2 && !activeCleanMode) {
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
    // If stream is active and unmuted, show controls and top bar, auto-fading after 3s
    scheduleLiveControlsFade();
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
    if (activeCleanMode === "custom_hls") {
      const cleanVideo = document.getElementById("cleanLiveVideoElement");
      if (cleanVideo) {
        try { cleanVideo.pause(); } catch(e) {}
      }
    }
    isLivePlaying = false;
    const bigPlayBtn = document.getElementById("livePlayerBigPlayBtn");
    if (bigPlayBtn) bigPlayBtn.classList.remove("hidden");
    showLiveControls();
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
    if (activeCleanMode === "agora") {
      agoraRemoteAudioTracks.forEach(t => { try { t.setVolume(liveVolume); } catch(e) {} });
    } else if (activeCleanMode === "custom_hls") {
      const cleanVideo = document.getElementById("cleanLiveVideoElement");
      if (cleanVideo) {
        cleanVideo.volume = Math.max(0, Math.min(1, liveVolume / 100));
        if (liveVolume > 0 && cleanVideo.muted) cleanVideo.muted = false;
      }
    }
    const icon = document.getElementById("livePlayerVolumeIcon");
    if (icon) {
      icon.className = liveVolume === 0 ? "fa-solid fa-volume-xmark" : (liveVolume < 50 ? "fa-solid fa-volume-low" : "fa-solid fa-volume-high");
    }
  }

  function toggleMute() {
    if (!liveYtPlayer && !activeCleanMode) return;
    if (activeCleanMode === "agora") {
      if (liveVolume === 0) {
        liveVolume = 100;
        agoraRemoteAudioTracks.forEach(t => { try { t.setVolume(100); } catch(e) {} });
        const icon = document.getElementById("livePlayerVolumeIcon");
        if (icon) icon.className = "fa-solid fa-volume-high";
        const slider = document.getElementById("livePlayerVolumeSlider");
        if (slider) slider.value = 100;
      } else {
        liveVolume = 0;
        agoraRemoteAudioTracks.forEach(t => { try { t.setVolume(0); } catch(e) {} });
        const icon = document.getElementById("livePlayerVolumeIcon");
        if (icon) icon.className = "fa-solid fa-volume-xmark";
        const slider = document.getElementById("livePlayerVolumeSlider");
        if (slider) slider.value = 0;
      }
      return;
    }
    if (activeCleanMode === "custom_hls") {
      const cleanVideo = document.getElementById("cleanLiveVideoElement");
      if (cleanVideo) {
        cleanVideo.muted = !cleanVideo.muted;
        const icon = document.getElementById("livePlayerVolumeIcon");
        if (icon) icon.className = cleanVideo.muted ? "fa-solid fa-volume-xmark" : (cleanVideo.volume < 0.5 ? "fa-solid fa-volume-low" : "fa-solid fa-volume-high");
        const slider = document.getElementById("livePlayerVolumeSlider");
        if (slider) slider.value = cleanVideo.muted ? 0 : Math.round(cleanVideo.volume * 100);
      }
      return;
    }
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

  // =========================================================================
  // SCREEN WAKE LOCK & ORIENTATION MANAGEMENT
  // =========================================================================
  let liveWakeLock = null;

  async function requestLiveWakeLock() {
    if ("wakeLock" in navigator && typeof navigator.wakeLock.request === "function") {
      try {
        if (!liveWakeLock || liveWakeLock.released) {
          liveWakeLock = await navigator.wakeLock.request("screen");
          liveWakeLock.addEventListener("release", () => {
            console.log("[EduPeak Live] Screen Wake Lock released");
            liveWakeLock = null;
          });
          console.log("[EduPeak Live] Screen Wake Lock active - screen timeout prevented");
        }
      } catch (err) {
        console.warn("[EduPeak Live] Screen Wake Lock error:", err);
      }
    }
  }

  function releaseLiveWakeLock() {
    if (liveWakeLock !== null) {
      try {
        liveWakeLock.release().then(() => {
          liveWakeLock = null;
        }).catch(() => {
          liveWakeLock = null;
        });
      } catch (e) {
        liveWakeLock = null;
      }
    }
  }

  async function lockOrientationLandscape() {
    try {
      if (screen.orientation && typeof screen.orientation.lock === "function") {
        await screen.orientation.lock("landscape");
        return true;
      } else if (screen.lockOrientation) {
        screen.lockOrientation("landscape");
        return true;
      } else if (screen.webkitLockOrientation) {
        screen.webkitLockOrientation("landscape");
        return true;
      } else if (screen.mozLockOrientation) {
        screen.mozLockOrientation("landscape");
        return true;
      } else if (screen.msLockOrientation) {
        screen.msLockOrientation("landscape");
        return true;
      }
    } catch (err) {
      console.log("[EduPeak Live] Native orientation lock not permitted or supported on device:", err.message || err);
    }
    return false;
  }

  function unlockOrientation() {
    try {
      if (screen.orientation && typeof screen.orientation.unlock === "function") {
        screen.orientation.unlock();
      } else if (screen.unlockOrientation) {
        screen.unlockOrientation();
      } else if (screen.webkitUnlockOrientation) {
        screen.webkitUnlockOrientation();
      } else if (screen.mozUnlockOrientation) {
        screen.mozUnlockOrientation();
      } else if (screen.msUnlockOrientation) {
        screen.msUnlockOrientation();
      }
    } catch (err) {}
  }

  function toggleFullscreen() {
    const wrapper = document.getElementById("edupeakLivePlayerWrapper");
    if (!wrapper) return;
    const theaterContainer = document.getElementById("theaterPlayerContainer");

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
      // ENTER FULLSCREEN
      wrapper.classList.add("fullscreen-mode");
      document.body.classList.add("edupeak-fullscreen-locked");
      if (theaterContainer) theaterContainer.classList.add("fullscreen-active");
      updateFsIcon(true);

      // Keep screen awake (no timeout during live)
      requestLiveWakeLock();

      // Check orientation & apply rotation for mobile portrait
      const isPortrait = window.matchMedia && window.matchMedia("(orientation: portrait)").matches;
      const isMobile = window.innerWidth <= 900 || window.innerHeight <= 900;
      if (isPortrait && isMobile) {
        wrapper.classList.add("mobile-landscape-rotate");
      }

      // Try native screen orientation lock
      lockOrientationLandscape().then((locked) => {
        if (!locked && isPortrait && isMobile) {
          wrapper.classList.add("mobile-landscape-rotate");
        }
      });

      // Request native browser fullscreen if supported
      if (typeof wrapper.requestFullscreen === "function") {
        wrapper.requestFullscreen().catch(() => {});
      } else if (typeof wrapper.webkitRequestFullscreen === "function") {
        try { wrapper.webkitRequestFullscreen(); } catch(e) {}
      }
    } else {
      // EXIT FULLSCREEN
      wrapper.classList.remove("fullscreen-mode", "mobile-landscape-rotate");
      document.body.classList.remove("edupeak-fullscreen-locked");
      if (theaterContainer) theaterContainer.classList.remove("fullscreen-active");
      updateFsIcon(false);

      unlockOrientation();

      if (document.exitFullscreen && fsElement) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen && fsElement) {
        try { document.webkitExitFullscreen(); } catch(e) {}
      }

      if (!isLivePlaying) {
        releaseLiveWakeLock();
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
    // Update anti-piracy NIC watermark
    const textEl = document.getElementById("livePlayerWatermarkText");
    if (textEl) {
      let studentNic = "200512345678";
      if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.getCurrentUser) {
        const user = window.AUTH_SYSTEM.getCurrentUser();
        if (user && user.nic) studentNic = user.nic;
      }
      textEl.textContent = studentNic;
    }

    // Pull lesson title and teacher name from activeSessionData
    const topic = (activeSessionData && (activeSessionData.topic || activeSessionData.title || activeSessionData.subject || "")) || "Physics Live Masterclass";
    const teacher = (activeSessionData && (activeSessionData.teacherName || activeSessionData.teacher_name || activeSessionData.teacher || "")) || "Amalsha Wanniarachchi";
    const batch = (activeSessionData && (activeSessionData.examYear || activeSessionData.exam_year || activeSessionData.batch || "")) || "2027 A/L";

    // Update 10-second top banner elements
    const bannerTopic = document.getElementById("bannerTopicTitle");
    if (bannerTopic && topic) bannerTopic.textContent = topic;
    const bannerTeach = document.getElementById("bannerTeacherName");
    if (bannerTeach && teacher) bannerTeach.textContent = teacher;
    const bannerBatch = document.getElementById("bannerBatchBadge");
    if (bannerBatch && batch) bannerBatch.textContent = batch;

    // Update 10-second bottom banner ticker track elements
    ["liveMarqueeTopic1", "liveMarqueeTopic2"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = topic;
    });
    ["liveMarqueeTeacher1", "liveMarqueeTeacher2"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = teacher;
    });

    // Update top bar lesson title + teacher name
    const topLesson = document.getElementById("liveTopLessonTitle");
    if (topLesson && topic) topLesson.textContent = topic;
    const topTeacher = document.getElementById("liveTopTeacherName");
    if (topTeacher && teacher) topTeacher.textContent = teacher;

    // Update legacy ticker elements if present
    ["liveTickerTitle1", "liveTickerTitle2"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = topic;
    });
    ["liveTickerTeacher1", "liveTickerTeacher2"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = teacher;
    });
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

  let _liveEventsAttached = false;
  function setupLivePlayerEvents() {
    const onLiveActivity = () => {
      scheduleLiveControlsFade();
    };

    const liveWrapper = document.getElementById("edupeakLivePlayerWrapper");
    const viewport = document.getElementById("edupeakLivePlayerViewport");
    const theater = document.getElementById("theaterPlayerContainer");
    const shield = document.getElementById("livePlayerClickShield");
    const topBar = document.getElementById("livePlayerTopBar");
    const controls = document.getElementById("livePlayerControlsOverlay");

    [liveWrapper, viewport, theater, shield, topBar, controls].forEach(el => {
      if (el && !el._edupeakEventsAttached) {
        el._edupeakEventsAttached = true;
        el.addEventListener("mousemove", onLiveActivity);
        el.addEventListener("mouseenter", onLiveActivity);
        el.addEventListener("pointermove", onLiveActivity);
        el.addEventListener("touchstart", onLiveActivity, { passive: true });
        el.addEventListener("mouseleave", () => {
          if (isLivePlaying) hideLiveControls();
        });
      }
    });

    if (!_liveEventsAttached) {
      _liveEventsAttached = true;

      document.addEventListener("mousemove", (e) => {
        const wrapper = document.getElementById("edupeakLivePlayerWrapper");
        if (!wrapper || wrapper.style.display === "none") return;
        const rect = wrapper.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          onLiveActivity();
        }
      });

      document.addEventListener("click", (e) => {
        const liveQWrapper = document.querySelector("#edupeakLivePlayerWrapper .quality-selector-wrapper");
        const liveQMenu = document.getElementById("livePlayerQualityMenu");
        if (liveQMenu && liveQWrapper && !liveQWrapper.contains(e.target)) {
          liveQMenu.classList.remove("active");
        }
      });

      // Block students from seeking backward/forward or stopping the live stream
      document.addEventListener("keydown", (e) => {
        const liveWrapper = document.getElementById("edupeakLivePlayerWrapper");
        if (!liveWrapper || liveWrapper.style.display === "none") return;

        const isLiveSession = !activeSessionData || activeSessionData.status === "live";
        if (!isLiveSession) return;

        const user = (window.AUTH_SYSTEM && window.AUTH_SYSTEM.getCurrentUser) ? window.AUTH_SYSTEM.getCurrentUser() : null;
        const isStaff = user && (user.role === "teacher" || user.role === "admin");
        if (isStaff) return; // Allow staff full control

        const activeEl = document.activeElement;
        const tag = (activeEl && activeEl.tagName) ? activeEl.tagName.toLowerCase() : "";
        if (tag === "input" || tag === "textarea" || tag === "select") return;

        // Block seek and pause keys: Space, Left/Right arrows, J, K, L, Home, End, 0-9
        const seekKeys = [" ", "Spacebar", "ArrowLeft", "ArrowRight", "j", "J", "k", "K", "l", "L", "Home", "End"];
        if (seekKeys.includes(e.key) || (e.key >= "0" && e.key <= "9")) {
          e.preventDefault();
          e.stopPropagation();
          if (e.key === " " || e.key === "k" || e.key === "K") {
            if (liveYtPlayer && typeof liveYtPlayer.playVideo === "function") {
              try {
                liveYtPlayer.playVideo();
              } catch(err) {}
            }
          }
        }
      }, true);

      const handleNativeFullscreenChange = () => {
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        const wrapper = document.getElementById("edupeakLivePlayerWrapper");
        const theaterContainer = document.getElementById("theaterPlayerContainer");
        if (!fsEl && wrapper) {
          wrapper.classList.remove("fullscreen-mode", "mobile-landscape-rotate");
          document.body.classList.remove("edupeak-fullscreen-locked");
          if (theaterContainer) theaterContainer.classList.remove("fullscreen-active");
          unlockOrientation();
          const fsBtns = document.querySelectorAll("#edupeakLivePlayerWrapper button[title='Fullscreen'], #livePlayerControlsOverlay .fa-expand, #livePlayerControlsOverlay .fa-compress");
          fsBtns.forEach(btn => {
            const icon = btn.tagName === "I" ? btn : btn.querySelector("i");
            if (icon) icon.className = "fa-solid fa-expand";
          });
          if (!isLivePlaying) {
            releaseLiveWakeLock();
          }
        }
      };
      document.addEventListener("fullscreenchange", handleNativeFullscreenChange);
      document.addEventListener("webkitfullscreenchange", handleNativeFullscreenChange);
      document.addEventListener("mozfullscreenchange", handleNativeFullscreenChange);
      document.addEventListener("MSFullscreenChange", handleNativeFullscreenChange);

      // Re-acquire Screen Wake Lock when tab becomes visible during live broadcast
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          const wrapper = document.getElementById("edupeakLivePlayerWrapper");
          const isFs = wrapper && wrapper.classList.contains("fullscreen-mode");
          if (isLivePlaying || isFs) {
            requestLiveWakeLock();
          }
        }
      });

      // Handle orientation changes while in fullscreen
      window.addEventListener("orientationchange", () => {
        const wrapper = document.getElementById("edupeakLivePlayerWrapper");
        if (wrapper && wrapper.classList.contains("fullscreen-mode")) {
          setTimeout(() => {
            const isLandscape = window.innerWidth > window.innerHeight;
            if (isLandscape) {
              wrapper.classList.remove("mobile-landscape-rotate");
            } else {
              wrapper.classList.add("mobile-landscape-rotate");
            }
          }, 150);
        }
      });

      // Escape key exits fullscreen
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const wrapper = document.getElementById("edupeakLivePlayerWrapper");
          if (wrapper && wrapper.classList.contains("fullscreen-mode")) {
            toggleFullscreen();
          }
        }
      });
    }
  }

  function initLivePlayer() {
    setupLivePlayerEvents();
    startLiveWatermarkMovement();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setupLivePlayerEvents);
    } else {
      setupLivePlayerEvents();
    }
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

  let startupBannerTimer = null;
  let startupBannerHideTimer = null;

  function triggerStartupBanners(durationMs = 10000) {
    const topBanner = document.getElementById("liveStartupTopBanner") || document.getElementById("livePlayerTopMask");
    const bottomBanner = document.getElementById("liveStartupBottomBanner");

    clearTimeout(startupBannerTimer);
    clearTimeout(startupBannerHideTimer);

    updateLiveWatermark();

    // On mobile devices (<= 768px), keep banners hidden for clean view (matches 2nd screenshot)
    if (window.innerWidth <= 768) {
      if (topBanner) {
        topBanner.style.display = "none";
        topBanner.style.visibility = "hidden";
      }
      if (bottomBanner) {
        bottomBanner.style.display = "none";
        bottomBanner.style.visibility = "hidden";
      }
      return;
    }

    if (topBanner) {
      topBanner.classList.remove("banner-fade-out", "mask-faded", "fade-out");
      topBanner.style.display = "flex";
      topBanner.style.opacity = "1";
      topBanner.style.visibility = "visible";
    }
    if (bottomBanner) {
      bottomBanner.classList.remove("banner-fade-out", "mask-faded", "fade-out");
      bottomBanner.style.display = "flex";
      bottomBanner.style.opacity = "1";
      bottomBanner.style.visibility = "visible";
    }

    // Keep fully visible for EXACTLY durationMs (10.0 seconds), then smoothly fade away
    startupBannerTimer = setTimeout(() => {
      if (topBanner) {
        topBanner.classList.add("banner-fade-out");
      }
      if (bottomBanner) {
        bottomBanner.classList.add("banner-fade-out");
      }

      // After 1000ms smooth CSS transition finishes, set hidden
      startupBannerHideTimer = setTimeout(() => {
        if (topBanner && topBanner.classList.contains("banner-fade-out")) {
          topBanner.style.visibility = "hidden";
        }
        if (bottomBanner && bottomBanner.classList.contains("banner-fade-out")) {
          bottomBanner.style.visibility = "hidden";
        }
      }, 1000);
    }, durationMs);
  }

  function triggerStartupMask() {
    triggerStartupBanners(10000);
  }

  function retryPlayback() {
    dismissBotPrompt();
    if (liveYtPlayer && typeof liveYtPlayer.playVideo === "function") {
      try { liveYtPlayer.playVideo(); } catch(e) {}
    }
    triggerStartupBanners(10000);
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
    loadCleanLiveStream: loadCleanLiveStream,
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
    showControls: showLiveControls,
    hideControls: hideLiveControls,
    scheduleControlsFade: scheduleLiveControlsFade,
    onStreamEnded: function(cb) { if (typeof cb === "function") streamEndCallbacks.push(cb); },
    getElapsedSeconds: getElapsedSeconds,
    setSessionData: function(s) { activeSessionData = s; },
    triggerLiveEnded: triggerLiveEnded,
    dismissBotPrompt: dismissBotPrompt,
    showBotFallbackPrompt: showBotFallbackPrompt,
    triggerStartupMask: triggerStartupMask,
    triggerStartupBanners: triggerStartupBanners,
    retryPlayback: retryPlayback
  };
})();

window.EDUPEAK_LIVE_PLAYER = EDUPEAK_LIVE_PLAYER;

