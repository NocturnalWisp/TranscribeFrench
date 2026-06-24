import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));
const localAudioRoot = resolve(repoRoot, "content/audio-exercises");

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".webm": "audio/webm",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8"
};

const serveLocalAudioExercises = (): Plugin => ({
  name: "serve-local-audio-exercises",
  configureServer(server) {
    server.middlewares.use("/local-audio-exercises", (request, response, next) => {
      const requestPath = decodeURIComponent(request.url ?? "/");
      const relativePath = requestPath.split("?")[0] ?? "/";
      const filePath = resolve(localAudioRoot, `.${relativePath}`);

      if (!filePath.startsWith(localAudioRoot)) {
        response.statusCode = 403;
        response.end("Forbidden");
        return;
      }

      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        next();
        return;
      }

      const extension = extname(filePath).toLowerCase();
      response.setHeader("Content-Type", CONTENT_TYPES[extension] ?? "application/octet-stream");
      createReadStream(filePath).pipe(response);
    });
  }
});

export default defineConfig({
  plugins: [react(), serveLocalAudioExercises()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("firebase/database")) {
            return "firebase-database";
          }

          if (id.includes("firebase/")) {
            return "firebase";
          }

          if (
            id.includes("@chakra-ui") ||
            id.includes("@emotion") ||
            id.includes("framer-motion")
          ) {
            return "chakra";
          }

          if (id.includes("react-dom") || id.includes("/react/")) {
            return "react";
          }
        }
      }
    }
  }
});
