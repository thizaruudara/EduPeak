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

    try {
      ytPlayer = new window.YT.Player('edupeakYTPlayerMount', {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
          origin: window.location.origin
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

  function onPlayerReady(event) {
    try {
      duration = ytPlayer.getDuration() || 0;
      updateTimeDisplay(0, duration);
      setVolume(currentVolume);
      setPlaybackRate(currentPlaybackRate, false); // Do not notify toast on page reload/init
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
    if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
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

  // Anti-Piracy Watermark Animation & Dynamic User Text
  function updateWatermarkUser() {
    const textEl = document.getElementById("playerWatermarkText");
    if (!textEl) return;

    let studentName = "Kasun Jayasundara";
    let studentId = "EP-2027-001";
    let branch = "Victory Embilipitiya";

    if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.getCurrentUser) {
      const user = window.AUTH_SYSTEM.getCurrentUser();
      if (user) {
        studentName = user.name || studentName;
        studentId = user.id || studentId;
        branch = user.school || user.district || branch;
      }
    }

    textEl.textContent = `${studentName} (${studentId}) • ${branch} • EduPeak DRM Protected`;
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

    // Close speed menu on outside click
    document.addEventListener("click", (e) => {
      const speedWrapper = document.querySelector(".speed-selector-wrapper");
      const speedMenu = document.getElementById("playerSpeedMenu");
      if (speedMenu && speedWrapper && !speedWrapper.contains(e.target)) {
        speedMenu.classList.remove("active");
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
    toggleFullscreen: toggleFullscreen,
    parseTimeToSeconds: parseTimeToSeconds
  };
})();

// Auto-bind globally
window.EDUPEAK_PLAYER = EDUPEAK_PLAYER;
