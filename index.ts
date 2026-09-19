import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { config, higgsfield, NotEnoughCreditsError, AuthenticationError, ValidationError } from "@higgsfield/client/v2";

// Verify credentials exist without printing or exposing them
if (!process.env.HF_CREDENTIALS && !process.env.HF_KEY) {
  console.error("Error: HF_CREDENTIALS is not set in .env.local");
  process.exit(1);
}

config({
  credentials: process.env.HF_CREDENTIALS || process.env.HF_KEY,
});

async function main() {
  console.log("Submitting video generation request to bytedance/seedance-2.5/text-to-video...");
  console.log("Prompt: 'A cinematic scene at sunset'");
  console.log("Parameters: duration: 5, resolution: 720p, aspect_ratio: 16:9");

  try {
    const result: any = await higgsfield.subscribe(
      "bytedance/seedance-2.5/text-to-video",
      {
        input: {
          prompt: "A cinematic scene at sunset",
          duration: 5,
          resolution: "720p",
          aspect_ratio: "16:9",
        },
        withPolling: true,
      }
    );

    const status = result?.status || (result?.isCompleted ? "completed" : undefined);

    if (status === "completed" || result?.isCompleted) {
      const videoUrl =
        result?.video?.url ||
        result?.jobs?.[0]?.results?.raw?.url ||
        result?.videos?.[0]?.url ||
        (typeof result?.video === "string" ? result.video : undefined) ||
        result?.output?.video_url;

      if (videoUrl) {
        console.log("Generation completed successfully!");
        console.log("Generated Video URL:", videoUrl);
        return videoUrl;
      } else {
        console.error("Generation reported completion, but no video URL was found in the response:");
        console.error(JSON.stringify(result, null, 2));
        process.exit(1);
      }
    } else if (status === "failed" || result?.isFailed) {
      console.error("Generation failed:", result?.error || result?.message || "Unknown generation failure");
      process.exit(1);
    } else if (status === "nsfw" || status === "moderated" || result?.isNsfw) {
      console.error("Generation was rejected by content moderation (NSFW / policy filter).");
      process.exit(1);
    } else if (status === "canceled") {
      console.error("Generation request was canceled.");
      process.exit(1);
    } else {
      console.error("Generation ended with unexpected status:", status, result);
      process.exit(1);
    }
  } catch (error: any) {
    if (
      error instanceof NotEnoughCreditsError ||
      error?.name === "AccountError" ||
      error?.statusCode === 403 ||
      error?.message?.toLowerCase().includes("not enough credits")
    ) {
      console.error("Execution Blocked: Not enough credits on your Higgsfield account to complete this generation.");
      console.error("Please add credits in your Higgsfield Console: https://console.higgsfield.ai/billing");
    } else if (
      error instanceof AuthenticationError ||
      error?.name === "AuthenticationError" ||
      error?.response?.status === 401
    ) {
      console.error("Execution Blocked: Authentication failed. Please check your credentials in .env.local.");
    } else if (
      error instanceof ValidationError ||
      error?.name === "ValidationError" ||
      error?.response?.status === 422
    ) {
      console.error("Execution Blocked: Validation error for model parameters:", error?.message || error);
    } else {
      console.error("Execution Blocked: Generation request encountered an error:", error?.message || error);
    }
    process.exit(1);
  }
}

main();
