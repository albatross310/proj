import { io } from "socket.io-client";
import { API_URL } from "./api.js";

// Create the Socket.IO client lazily and only in the browser — at module load
// on the server there is no WebSocket, and connecting during SSR would break
// the render. Used for live, server-authoritative word validation.
let socket;
export function getSocket() {
  if (!socket && typeof window !== "undefined") {
    socket = io(API_URL);
  }
  return socket;
}
