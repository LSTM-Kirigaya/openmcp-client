// server/src/types.ts
export interface IMessage {
    type: string;
    data: Record<string, unknown>;
    timestamp?: number;
}

export type MessageHandler = (message: IMessage) => void;