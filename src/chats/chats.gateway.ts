import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { DirectMessageRecord } from '../prisma/prisma.service';
import type { Server, Socket } from 'socket.io';

type SocketJwtPayload = {
  userId: number;
  uuid: string;
  organizationId: number;
};

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3999', 'http://127.0.0.1:3999'],
    credentials: true,
  },
})
export class ChatsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly onlineUsers = new Map<
    number,
    { count: number; organizationId: number }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<SocketJwtPayload>(token);
      const user = await this.prisma.userMaster.findUnique({
        where: { id: payload.userId },
      });

      if (!user || user.isDeleted || !user.isActive) {
        client.disconnect();
        return;
      }

      client.data.userId = user.id;
      client.data.organizationId = user.organizationId;
      client.join(this.getUserRoom(user.id));
      client.join(this.getOrganizationRoom(user.organizationId));

      client.emit('presence:snapshot', {
        onlineUserIds: this.getOnlineUserIdsForOrganization(user.organizationId),
      });

      const onlineEntry = this.onlineUsers.get(user.id);

      if (onlineEntry) {
        onlineEntry.count += 1;
      } else {
        this.onlineUsers.set(user.id, {
          count: 1,
          organizationId: user.organizationId,
        });

        this.server
          .to(this.getOrganizationRoom(user.organizationId))
          .emit('presence:changed', {
            userId: user.id,
            isOnline: true,
          });
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as number | undefined;
    const organizationId = client.data.organizationId as number | undefined;

    if (!userId || !organizationId) {
      return;
    }

    const onlineEntry = this.onlineUsers.get(userId);

    if (!onlineEntry) {
      return;
    }

    if (onlineEntry.count > 1) {
      onlineEntry.count -= 1;
      return;
    }

    this.onlineUsers.delete(userId);
    this.server.to(this.getOrganizationRoom(organizationId)).emit('presence:changed', {
      userId,
      isOnline: false,
    });
  }

  emitDirectMessage(message: DirectMessageRecord, participantUserId: number) {
    const roomIds = new Set([message.senderId, participantUserId]);

    roomIds.forEach((userId) => {
      this.server.to(this.getUserRoom(userId)).emit('direct_message:new', message);
    });
  }

  emitDirectMessageRead(readByUserId: number, notifyUserId: number): void {
    this.server
      .to(this.getUserRoom(notifyUserId))
      .emit('direct_message:read', { readByUserId });
  }

  @SubscribeMessage('direct_message:typing')
  handleDirectMessageTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { participantUserId?: number; isTyping?: boolean },
  ) {
    const userId = client.data.userId as number | undefined;

    if (!userId) {
      return;
    }

    if (
      typeof body.participantUserId !== 'number' ||
      !Number.isInteger(body.participantUserId) ||
      body.participantUserId <= 0 ||
      body.participantUserId === userId
    ) {
      return;
    }

    this.server.to(this.getUserRoom(body.participantUserId)).emit('direct_message:typing', {
      fromUserId: userId,
      isTyping: Boolean(body.isTyping),
    });
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth.token;

    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken;
    }

    const header = client.handshake.headers.authorization;

    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }

    return null;
  }

  private getUserRoom(userId: number) {
    return `user:${userId}`;
  }

  private getOrganizationRoom(organizationId: number) {
    return `organization:${organizationId}`;
  }

  private getOnlineUserIdsForOrganization(organizationId: number) {
    return Array.from(this.onlineUsers.entries())
      .filter(([, value]) => value.organizationId === organizationId)
      .map(([userId]) => userId);
  }
}
