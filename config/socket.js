import { Server } from "socket.io";

let io = null;

/**
 * Attaches Socket.io to the existing HTTP server so the admin panel
 * can get pushed WhatsApp events (new messages, status updates) in real time.
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("[socket] client connected:", socket.id);
    socket.on("disconnect", () => console.log("[socket] client disconnected:", socket.id));
  });

  return io;
};

// Safe accessor — returns null instead of throwing if sockets aren't initialized
// (e.g. during limited/debug checks), so callers can use getIO()?.emit(...).
const getIO = () => io;

export { initSocket, getIO };
