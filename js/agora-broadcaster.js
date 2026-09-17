/**
 * EduPeak Agora Real-Time Broadcaster Engine
 * Enables lecturers to stream live directly from their browser using:
 * - OBS Virtual Camera
 * - Standard Webcams
 * - Desktop / PowerPoint / Whiteboard Screen Share
 * Powered by Agora RTC Web SDK with zero external watermarks.
 */

(function(window) {
  'use strict';

  const DEFAULT_TESTING_APP_ID = "13256742c55e4a7687838c72cd148cad"; // EduPeak Live Agora App ID

  const EDUPEAK_AGORA_BROADCASTER = {
    client: null,
    localAudioTrack: null,
    localVideoTrack: null,
    localScreenTrack: null,
    previewContainer: null,
    isLive: false,
    isAudioMuted: false,
    isVideoMuted: false,
    isScreenSharing: false,
    currentVideoDeviceId: null,
    currentAudioDeviceId: null,
    currentAppId: "",
    currentChannel: "",
    audioLevelInterval: null,

    getAppId(preferredAppId) {
      if (preferredAppId && String(preferredAppId).trim().length > 10) {
        return String(preferredAppId).trim();
      }
      try {
        const saved = localStorage.getItem("edupeak_agora_app_id");
        if (saved && saved.trim().length > 10) return saved.trim();
      } catch(e) {}
      return DEFAULT_TESTING_APP_ID;
    },

    setAppId(appId) {
      if (appId && appId.trim()) {
        try { localStorage.setItem("edupeak_agora_app_id", appId.trim()); } catch(e) {}
      }
    },

    async getMediaDevices() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return { cameras: [], mics: [], video: [], audio: [] };
      }

      // Probe video permission separately
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
        vStream.getTracks().forEach(t => t.stop());
      } catch (e) {
        console.warn("[Agora Broadcaster] Video permission probe notice:", e);
      }

      // Probe audio permission separately
      try {
        const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        aStream.getTracks().forEach(t => t.stop());
      } catch (e) {
        console.warn("[Agora Broadcaster] Audio permission probe notice:", e);
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === "videoinput").map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 5)}...`,
          isObsVirtual: /obs|virtual/i.test(d.label || ""),
          isObs: /obs|virtual/i.test(d.label || "")
        }));
        const mics = devices.filter(d => d.kind === "audioinput").map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 5)}...`
        }));
        return { cameras, mics, video: cameras, audio: mics };
      } catch (err) {
        console.warn("[Agora Broadcaster] Failed to enumerate devices:", err);
        return { cameras: [], mics: [], video: [], audio: [] };
      }
    },

    async enumerateDevices() {
      return this.getMediaDevices();
    },

    async startCameraPreview(containerEl, videoDeviceId = null, audioDeviceId = null) {
      if (!window.AgoraRTC) {
        throw new Error("Agora RTC Web SDK is not loaded. Please verify your internet connection.");
      }
      this.previewContainer = containerEl;
      this.isScreenSharing = false;

      // Clean up previous tracks if active
      await this.stopLocalTracks();

      try {
        const videoConfig = {
          encoderConfig: this.currentProfile || "1080p_1",
          optimizationMode: "detail"
        };
        if (videoDeviceId) videoConfig.cameraId = videoDeviceId;

        const audioConfig = {};
        if (audioDeviceId) audioConfig.microphoneId = audioDeviceId;

        // Create camera track independently
        try {
          this.localVideoTrack = await window.AgoraRTC.createCameraVideoTrack(videoConfig);
        } catch (vErr) {
          console.warn("[Agora Broadcaster] Camera track creation notice:", vErr);
        }

        // Create audio track independently
        try {
          this.localAudioTrack = await window.AgoraRTC.createMicrophoneAudioTrack(audioConfig);
        } catch (aErr) {
          console.warn("[Agora Broadcaster] Mic track creation notice:", aErr);
        }

        this.currentVideoDeviceId = videoDeviceId;
        this.currentAudioDeviceId = audioDeviceId;

        const targetEl = typeof containerEl === 'string' ? document.getElementById(containerEl) : containerEl;
        if (targetEl) {
          if (this.localVideoTrack) {
            targetEl.innerHTML = "";
            this.localVideoTrack.play(targetEl);
          } else {
            targetEl.innerHTML = `
              <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;text-align:center;padding:1.5rem;">
                <div>
                  <i class="fa-solid fa-camera-slash" style="font-size:2.2rem;margin-bottom:0.75rem;color:#f59e0b;"></i>
                  <p style="font-weight:600;color:#fff;font-size:0.95rem;margin-bottom:0.25rem;">Camera Permission Required</p>
                  <small style="color:#94a3b8;line-height:1.4;display:block;">Please allow camera & microphone permissions in Chrome, or select OBS Virtual Camera on the right.</small>
                </div>
              </div>`;
          }
        }

        this.startAudioMeter();
        return { success: true, hasVideo: !!this.localVideoTrack, hasAudio: !!this.localAudioTrack };
      } catch (err) {
        console.error("[Agora Broadcaster] Error starting camera preview:", err);
        throw err;
      }
    },

    async startScreenSharePreview(containerEl) {
      if (!window.AgoraRTC) {
        throw new Error("Agora RTC Web SDK is not loaded.");
      }
      this.previewContainer = containerEl;
      this.isScreenSharing = true;

      // Clean up video track (keep mic if alive)
      if (this.localVideoTrack) {
        try { this.localVideoTrack.stop(); this.localVideoTrack.close(); } catch(e) {}
        this.localVideoTrack = null;
      }
      if (this.localScreenTrack) {
        try { this.localScreenTrack.stop(); this.localScreenTrack.close(); } catch(e) {}
        this.localScreenTrack = null;
      }

      try {
        this.localScreenTrack = await window.AgoraRTC.createScreenVideoTrack({
          encoderConfig: "1080p_2",
          optimizationMode: "detail"
        }, "auto");

        // If audio track doesn't exist yet, create microphone track
        if (!this.localAudioTrack) {
          try {
            this.localAudioTrack = await window.AgoraRTC.createMicrophoneAudioTrack();
          } catch(e) {}
        }

        if (containerEl && this.localScreenTrack) {
          containerEl.innerHTML = "";
          // Handle screen track which may be an array if system audio was captured
          const trackToPlay = Array.isArray(this.localScreenTrack) ? this.localScreenTrack[0] : this.localScreenTrack;
          trackToPlay.play(containerEl);
        }

        this.startAudioMeter();
        return { success: true };
      } catch (err) {
        console.error("[Agora Broadcaster] Error starting screen share:", err);
        throw err;
      }
    },

    async startBroadcast(appId, channelName, options = {}) {
      if (!window.AgoraRTC) {
        throw new Error("Agora RTC Web SDK not loaded");
      }
      const finalAppId = this.getAppId(appId);
      const finalChannel = channelName ? channelName.trim() : "edupeak_live";

      this.currentAppId = finalAppId;
      this.currentChannel = finalChannel;

      try {
        if (!this.client) {
          this.client = window.AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        }

        // Set as Broadcaster / Host
        await this.client.setClientRole("host");

        // Join channel with Token authentication if required
        const uid = Math.floor(Math.random() * 900000) + 100000;
        let rtcToken = options.token || options.agoraToken || null;
        if (!rtcToken) {
          try {
            const tokRes = await fetch(`/api/agora/token?channel=${encodeURIComponent(finalChannel)}&role=publisher`);
            if (tokRes.ok) {
              const tokJson = await tokRes.json();
              if (tokJson && tokJson.token) rtcToken = tokJson.token;
            }
          } catch(tokErr) {
            console.warn("[Agora Broadcaster] Token endpoint fallback:", tokErr);
          }
        }
        await this.client.join(finalAppId, finalChannel, rtcToken || null, uid);

        // Make sure tracks exist
        if (!this.localVideoTrack && !this.localScreenTrack) {
          await this.startCameraPreview(this.previewContainer, this.currentVideoDeviceId, this.currentAudioDeviceId);
        }

        const publishTracks = [];
        if (this.localAudioTrack) publishTracks.push(this.localAudioTrack);

        if (this.isScreenSharing && this.localScreenTrack) {
          if (Array.isArray(this.localScreenTrack)) {
            publishTracks.push(...this.localScreenTrack);
          } else {
            publishTracks.push(this.localScreenTrack);
          }
        } else if (this.localVideoTrack) {
          publishTracks.push(this.localVideoTrack);
        }

        if (publishTracks.length > 0) {
          await this.client.publish(publishTracks);
        }

        this.isLive = true;
        console.log(`[Agora Broadcaster] Successfully ON AIR in channel: ${finalChannel}`);
        return { success: true, channel: finalChannel };
      } catch (err) {
        console.error("[Agora Broadcaster] Failed to publish stream:", err);
        throw err;
      }
    },

    async stopBroadcast() {
      if (this.client) {
        try {
          if (this.isLive) {
            const unpubTracks = [];
            if (this.localAudioTrack) unpubTracks.push(this.localAudioTrack);
            if (this.localVideoTrack) unpubTracks.push(this.localVideoTrack);
            if (this.localScreenTrack) {
              if (Array.isArray(this.localScreenTrack)) unpubTracks.push(...this.localScreenTrack);
              else unpubTracks.push(this.localScreenTrack);
            }
            if (unpubTracks.length) await this.client.unpublish(unpubTracks);
          }
          await this.client.leave();
        } catch(e) {
          console.warn("Agora leave notice:", e);
        }
        this.client = null;
      }

      this.isLive = false;
      this.stopAudioMeter();
      await this.stopLocalTracks();
      console.log("[Agora Broadcaster] Broadcast stopped.");
      return { success: true };
    },

    async stopLocalTracks() {
      if (this.localAudioTrack) {
        try { this.localAudioTrack.stop(); this.localAudioTrack.close(); } catch(e) {}
        this.localAudioTrack = null;
      }
      if (this.localVideoTrack) {
        try { this.localVideoTrack.stop(); this.localVideoTrack.close(); } catch(e) {}
        this.localVideoTrack = null;
      }
      if (this.localScreenTrack) {
        try {
          if (Array.isArray(this.localScreenTrack)) {
            this.localScreenTrack.forEach(t => { t.stop(); t.close(); });
          } else {
            this.localScreenTrack.stop();
            this.localScreenTrack.close();
          }
        } catch(e) {}
        this.localScreenTrack = null;
      }
    },

    toggleMute() {
      if (!this.localAudioTrack) return false;
      this.isAudioMuted = !this.isAudioMuted;
      this.localAudioTrack.setEnabled(!this.isAudioMuted);
      return this.isAudioMuted;
    },

    toggleVideo() {
      const activeTrack = this.isScreenSharing ? this.localScreenTrack : this.localVideoTrack;
      if (!activeTrack) return false;
      this.isVideoMuted = !this.isVideoMuted;
      if (Array.isArray(activeTrack)) {
        activeTrack[0].setEnabled(!this.isVideoMuted);
      } else {
        activeTrack.setEnabled(!this.isVideoMuted);
      }
      return this.isVideoMuted;
    },

    getIsBroadcasting() {
      return Boolean(this.isLive);
    },

    async publishStream(appId, channel) {
      return this.startBroadcast(appId || this.currentAppId, channel || this.currentChannel);
    },

    async unpublishStream() {
      return this.stopBroadcast();
    },

    async startPreview(containerId) {
      return this.startCameraPreview(containerId, this.currentVideoDeviceId, this.currentAudioDeviceId);
    },

    stopPreview() {
      return this.stopLocalTracks();
    },

    toggleAudioMute() {
      return this.toggleMute();
    },

    toggleVideoMute() {
      return this.toggleVideo();
    },

    async toggleScreenShare(containerId) {
      if (this.isScreenSharing) {
        await this.stopScreenShare(containerId || this.previewContainer);
        return false;
      } else {
        await this.startScreenShare(containerId || this.previewContainer);
        return true;
      }
    },

    onAudioVolume(cb) {
      this.volumeCallback = cb;
    },

    setChannel(ch) {
      this.currentChannel = ch;
    },

    setAppId(id) {
      this.currentAppId = id;
    },

    setProfile(prof) {
      this.currentProfile = prof;
    },

    async switchCamera(deviceId) {
      this.currentVideoDeviceId = deviceId;
      if (this.previewContainer) {
        await this.startCameraPreview(this.previewContainer, deviceId, this.currentAudioDeviceId);
      }
    },

    async switchMicrophone(deviceId) {
      this.currentAudioDeviceId = deviceId;
      if (this.previewContainer) {
        await this.startCameraPreview(this.previewContainer, this.currentVideoDeviceId, deviceId);
      }
    },

    startAudioMeter() {
      this.stopAudioMeter();
      const meterBar = document.getElementById("broadcasterAudioMeterBar") || document.getElementById("studioAudioVuBar");

      this.audioLevelInterval = setInterval(() => {
        if (!this.localAudioTrack || this.isAudioMuted) {
          if (meterBar) meterBar.style.width = "0%";
          if (typeof this.volumeCallback === "function") this.volumeCallback(0);
          return;
        }
        try {
          const level = this.localAudioTrack.getVolumeLevel ? this.localAudioTrack.getVolumeLevel() : 0;
          const pct = Math.min(100, Math.round(level * 100 * 1.5));
          if (meterBar) meterBar.style.width = `${pct}%`;
          if (typeof this.volumeCallback === "function") this.volumeCallback(level);
        } catch(e) {}
      }, 100);
    },

    stopAudioMeter() {
      if (this.audioLevelInterval) {
        clearInterval(this.audioLevelInterval);
        this.audioLevelInterval = null;
      }
      const meterBar = document.getElementById("broadcasterAudioMeterBar") || document.getElementById("studioAudioVuBar");
      if (meterBar) meterBar.style.width = "0%";
      if (typeof this.volumeCallback === "function") this.volumeCallback(0);
    }
  };

  window.EDUPEAK_AGORA_BROADCASTER = EDUPEAK_AGORA_BROADCASTER;
})(window);
