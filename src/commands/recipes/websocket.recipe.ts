import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../../utils/file.utils';

export async function applyWebSocketRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const wsPath = path.join(sharedPath, 'websocket');

  await ensureDir(wsPath);
  await ensureDir(path.join(wsPath, 'gateways'));
  await ensureDir(path.join(wsPath, 'decorators'));
  await ensureDir(path.join(wsPath, 'guards'));

  // Base Gateway
  const baseGatewayContent = `import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";

export interface WsClient extends Socket {
  userId?: string;
  tenantId?: string;
  rooms: Set<string>;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  },
  namespace: "/",
  transports: ["websocket", "polling"],
})
export class BaseGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  protected readonly logger = new Logger(BaseGateway.name);
  protected clients: Map<string, WsClient> = new Map();
  protected userSockets: Map<string, Set<string>> = new Map();

  afterInit(server: Server) {
    this.logger.log("WebSocket Gateway initialized");
  }

  handleConnection(client: WsClient) {
    this.logger.log(\`Client connected: \${client.id}\`);
    this.clients.set(client.id, client);
  }

  handleDisconnect(client: WsClient) {
    this.logger.log(\`Client disconnected: \${client.id}\`);
    this.clients.delete(client.id);

    // Remove from user sockets mapping
    if (client.userId) {
      const userSockets = this.userSockets.get(client.userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
    }
  }

  /**
   * Associate a socket with a user ID
   */
  protected associateUser(client: WsClient, userId: string) {
    client.userId = userId;

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);
  }

  /**
   * Send event to specific user (all their connected sockets)
   */
  protected sendToUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }

  /**
   * Send event to all users in a room
   */
  protected sendToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }

  /**
   * Broadcast to all connected clients
   */
  protected broadcast(event: string, data: any, excludeClient?: string) {
    if (excludeClient) {
      this.server.except(excludeClient).emit(event, data);
    } else {
      this.server.emit(event, data);
    }
  }
}
`;
  await writeFile(path.join(wsPath, 'gateways/base.gateway.ts'), baseGatewayContent);

  // Events Gateway
  const eventsGatewayContent = `import {
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { UseGuards } from "@nestjs/common";
import { BaseGateway, WsClient } from "./base.gateway";
import { WsJwtGuard } from "../guards/ws-jwt.guard";

export class EventsGateway extends BaseGateway {
  @UseGuards(WsJwtGuard)
  @SubscribeMessage("authenticate")
  handleAuthenticate(
    @ConnectedSocket() client: WsClient,
    @MessageBody() data: { userId: string }
  ) {
    this.associateUser(client, data.userId);
    return { event: "authenticated", data: { success: true } };
  }

  @SubscribeMessage("join_room")
  handleJoinRoom(
    @ConnectedSocket() client: WsClient,
    @MessageBody() data: { room: string }
  ) {
    client.join(data.room);
    client.rooms.add(data.room);
    this.logger.log(\`Client \${client.id} joined room \${data.room}\`);

    // Notify others in room
    client.to(data.room).emit("user_joined", {
      userId: client.userId,
      room: data.room,
    });

    return { event: "joined_room", data: { room: data.room } };
  }

  @SubscribeMessage("leave_room")
  handleLeaveRoom(
    @ConnectedSocket() client: WsClient,
    @MessageBody() data: { room: string }
  ) {
    client.leave(data.room);
    client.rooms.delete(data.room);

    // Notify others in room
    client.to(data.room).emit("user_left", {
      userId: client.userId,
      room: data.room,
    });

    return { event: "left_room", data: { room: data.room } };
  }

  @SubscribeMessage("message")
  handleMessage(
    @ConnectedSocket() client: WsClient,
    @MessageBody() data: { room?: string; content: string; type?: string }
  ) {
    const message = {
      id: Date.now().toString(),
      userId: client.userId,
      content: data.content,
      type: data.type || "text",
      timestamp: new Date().toISOString(),
    };

    if (data.room) {
      this.sendToRoom(data.room, "new_message", message);
    } else {
      this.broadcast("new_message", message, client.id);
    }

    return { event: "message_sent", data: message };
  }

  @SubscribeMessage("typing")
  handleTyping(
    @ConnectedSocket() client: WsClient,
    @MessageBody() data: { room: string; isTyping: boolean }
  ) {
    client.to(data.room).emit("user_typing", {
      userId: client.userId,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage("ping")
  handlePing(@ConnectedSocket() client: WsClient) {
    return { event: "pong", data: { timestamp: Date.now() } };
  }
}
`;
  await writeFile(path.join(wsPath, 'gateways/events.gateway.ts'), eventsGatewayContent);

  // Presence service
  const presenceServiceContent = `import { Injectable, Logger } from "@nestjs/common";
import { Server } from "socket.io";

export interface UserPresence {
  userId: string;
  status: "online" | "away" | "busy" | "offline";
  lastSeen: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private presence: Map<string, UserPresence> = new Map();
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  /**
   * Set user as online
   */
  setOnline(userId: string, metadata?: Record<string, any>) {
    const presence: UserPresence = {
      userId,
      status: "online",
      lastSeen: new Date(),
      metadata,
    };
    this.presence.set(userId, presence);
    this.broadcastPresence(userId, presence);
  }

  /**
   * Set user as offline
   */
  setOffline(userId: string) {
    const presence = this.presence.get(userId);
    if (presence) {
      presence.status = "offline";
      presence.lastSeen = new Date();
      this.broadcastPresence(userId, presence);
    }
  }

  /**
   * Update user status
   */
  updateStatus(userId: string, status: UserPresence["status"]) {
    const presence = this.presence.get(userId);
    if (presence) {
      presence.status = status;
      presence.lastSeen = new Date();
      this.broadcastPresence(userId, presence);
    }
  }

  /**
   * Get user presence
   */
  getPresence(userId: string): UserPresence | undefined {
    return this.presence.get(userId);
  }

  /**
   * Get all online users
   */
  getOnlineUsers(): UserPresence[] {
    return Array.from(this.presence.values()).filter(
      (p) => p.status !== "offline"
    );
  }

  /**
   * Check if user is online
   */
  isOnline(userId: string): boolean {
    const presence = this.presence.get(userId);
    return presence?.status === "online";
  }

  /**
   * Get presence for multiple users
   */
  getMultiplePresence(userIds: string[]): Map<string, UserPresence> {
    const result = new Map<string, UserPresence>();
    for (const id of userIds) {
      const presence = this.presence.get(id);
      if (presence) {
        result.set(id, presence);
      }
    }
    return result;
  }

  private broadcastPresence(userId: string, presence: UserPresence) {
    if (this.server) {
      this.server.emit("presence_update", { userId, presence });
    }
  }
}
`;
  await writeFile(path.join(wsPath, 'presence.service.ts'), presenceServiceContent);

  // WS JWT Guard
  const wsJwtGuardContent = `import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractToken(client);

      if (!token) {
        throw new WsException("Unauthorized: No token provided");
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      (client as any).userId = payload.sub;
      (client as any).user = payload;

      return true;
    } catch (error) {
      throw new WsException("Unauthorized: Invalid token");
    }
  }

  private extractToken(client: Socket): string | undefined {
    // Try auth header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7);
    }

    // Try query param
    const queryToken = client.handshake.query.token;
    if (queryToken) {
      return Array.isArray(queryToken) ? queryToken[0] : queryToken;
    }

    // Try auth object
    const authToken = (client.handshake.auth as any)?.token;
    if (authToken) {
      return authToken;
    }

    return undefined;
  }
}
`;
  await writeFile(path.join(wsPath, 'guards/ws-jwt.guard.ts'), wsJwtGuardContent);

  // WebSocket module
  const wsModuleContent = `import { Module, Global } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { EventsGateway } from "./gateways/events.gateway";
import { PresenceService } from "./presence.service";
import { WsJwtGuard } from "./guards/ws-jwt.guard";

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: "7d" },
    }),
  ],
  providers: [EventsGateway, PresenceService, WsJwtGuard],
  exports: [EventsGateway, PresenceService],
})
export class WebSocketModule {}
`;
  await writeFile(path.join(wsPath, 'websocket.module.ts'), wsModuleContent);

  // Index exports
  await writeFile(path.join(wsPath, 'index.ts'), `export * from "./gateways/base.gateway";
export * from "./gateways/events.gateway";
export * from "./presence.service";
export * from "./guards/ws-jwt.guard";
export * from "./websocket.module";
`);

  await writeFile(path.join(wsPath, 'gateways/index.ts'), `export * from "./base.gateway";
export * from "./events.gateway";
`);

  await writeFile(path.join(wsPath, 'guards/index.ts'), `export * from "./ws-jwt.guard";
`);

  console.log(chalk.green('  ✓ Base WebSocket Gateway with room management'));
  console.log(chalk.green('  ✓ Events Gateway (join/leave rooms, messaging, typing)'));
  console.log(chalk.green('  ✓ Presence Service (online/offline tracking)'));
  console.log(chalk.green('  ✓ WebSocket JWT Guard'));
  console.log(chalk.green('  ✓ WebSocket Module'));
}
