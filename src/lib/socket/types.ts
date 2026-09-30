import type { AvisoItemDTO } from "@/modules/incidentes/types";

export interface ServerToClientEvents {
    "aviso:nuevo": (aviso: AvisoItemDTO | Record<string, unknown>) => void;
    "aviso:verificado": (payload: { avisoId: string; incidenteId: string; folio: string }) => void;
    "aviso:descartado": (payload: { avisoId: string; motivoDescarte: string }) => void;
    "incidente:creado": (payload: unknown) => void;
}

export interface ClientToServerEvents {
    join: (room: string) => void;
    leave: (room: string) => void;
    unirse: (room: string) => void;
    salir: (room: string) => void;
}

export interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    userId?: string;
    role?: string;
}

export interface RedisSocketMessage {
    room: string;
    event: keyof ServerToClientEvents;
    payload: unknown;
}
