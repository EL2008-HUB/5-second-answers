import { io, Socket } from "socket.io-client";

import { API_CONFIG } from "../config/api";

export const createRoomSocket = (): Socket =>
  io(API_CONFIG.BASE_URL, {
    autoConnect: true,
    reconnection: true,
    transports: ["websocket"],
  });
