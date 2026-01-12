import type { WebSocketMessage } from "../../shared/websocket/types"

export enum WorkerIPCMessageType {
  WorkerStarted = "worker-started",
  WorkerShutdown = "worker-shutdown",
  WorkerError = "worker-error",
  Heartbeat = "heartbeat",
  SendToUser = "send-to-user",
  Broadcast = "broadcast",
}

export interface WorkerIPCMessage {
  type: WorkerIPCMessageType
  [key: string]: any
}

export interface SendToUserMessage extends WorkerIPCMessage {
  type: WorkerIPCMessageType.SendToUser
  userId: number
  message: WebSocketMessage
}

export interface BroadcastMessage extends WorkerIPCMessage {
  type: WorkerIPCMessageType.Broadcast
  message: WebSocketMessage
}
