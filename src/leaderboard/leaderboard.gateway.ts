import { forwardRef, Inject, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { verify } from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { LeaderboardService } from './leaderboard.service';

@WebSocketGateway({
  namespace: '/leaderboard',
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
})
export class LeaderboardGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('LeaderboardGateway');

  constructor(
    @Inject(forwardRef(() => LeaderboardService))
    private readonly leaderboardService: LeaderboardService,
  ) { }

  /**
   * Extract JWT token from:
   * 1. Query parameter (token=...)
   * 2. Authorization header (Bearer ...)
   * 3. Cookies (access_token)
   */
  private extractTokenFromRequest(client: Socket): string | undefined {
    // Try query parameter first
    const queryToken = client.handshake.query.token as string | undefined;
    if (queryToken) return queryToken;

    // Try Authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Try cookie
    const cookies = client.handshake.headers.cookie;
    if (cookies) {
      const match = cookies.match(/access_token=([^;]+)/);
      if (match) return match[1];
    }

    return undefined;
  }

  private extractUserIdFromToken(token?: string): string | undefined {
    if (!token) return undefined;

    try {
      const decoded = verify(
        token,
        process.env.JWT_ACCESS_SECRET || 'default',
      ) as any;
      return decoded.sub || undefined;
    } catch (error) {
      this.logger.debug(
        `Failed to verify token: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractTokenFromRequest(client);
      console.log('handshake auth:', client.handshake.auth);
      const userId = this.extractUserIdFromToken(token);
      console.log('resolved userId:', userId);

      (client.data as any).userId = userId;

      this.logger.log(
        `Client connected: ${client.id} | User: ${userId || 'anonymous'}`,
      );

      const leaderboard =
        await this.leaderboardService.getCategorizedLeaderboard(userId);

      client.emit('leaderboard:init', leaderboard);
    } catch (e) {
      this.logger.error(`Connection error for client ${client.id}: ${e}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data as any).userId;
    this.logger.log(
      `Client disconnected: ${client.id} | User: ${userId || 'anonymous'}`,
    );
  }

  @SubscribeMessage('subscribe-category')
  async handleSubscribeCategory(
    client: Socket,
    payload: { category: string; jlptLevel?: string },
  ) {
    try {
      const userId = (client.data as any).userId;

      this.logger.log(
        `${client.id} subscribed to ${payload.category}${payload.jlptLevel ? ` (${payload.jlptLevel})` : ''}`,
      );

      const leaderboard =
        await this.leaderboardService.getCategoryLeaderboard(
          payload.category,
          userId,
          payload.jlptLevel,
        );

      client.emit(`${payload.category}-leaderboard`, leaderboard);
    } catch (error) {
      this.logger.error(
        `Error in subscribe-category: ${error instanceof Error ? error.message : String(error)}`,
      );
      client.emit('error', { message: 'Failed to fetch leaderboard' });
    }
  }

  @SubscribeMessage('subscribe-module')
  async handleSubscribeModule(
    client: Socket,
    payload: { moduleId: string },
  ) {
    try {
      const userId = (client.data as any).userId;

      this.logger.log(`${client.id} subscribed to module ${payload.moduleId}`);

      const leaderboard =
        await this.leaderboardService.getModuleLeaderboard(
          payload.moduleId,
          userId,
        );

      client.emit(`module-${payload.moduleId}-leaderboard`, leaderboard);
    } catch (error) {
      this.logger.error(
        `Error in subscribe-module: ${error instanceof Error ? error.message : String(error)}`,
      );
      client.emit('error', { message: 'Failed to fetch leaderboard' });
    }
  }

  async broadcastUpdate() {
    const sockets = await this.server.fetchSockets();
    
    for (const socket of sockets) {
      const userId = (socket.data as any).userId;
      
      try {
        const leaderboard = 
          await this.leaderboardService.getCategorizedLeaderboard(userId);
        socket.emit('leaderboard:update', leaderboard);
      } catch (e) {
        this.logger.error(`Failed to broadcast to ${socket.id}: ${e}`);
      }
    }
  }
}