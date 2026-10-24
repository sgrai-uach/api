import type { AvisoItemDTO } from "@/modules/incidentes/types";

export interface ServerToClientEvents {
    "aviso:nuevo": (aviso: AvisoItemDTO | Record<string, unknown>) => void;
    "aviso:verificado": (payload: { avisoId: string; incidenteId: string; folio: string }) => void;
    "aviso:descartado": (payload: { avisoId: string; motivoDescarte: string }) => void;
    "incidente:creado": (payload: unknown) => void;
    "incidente:actualizado": (payload: unknown) => void;
    "recurso:actualizado": (payload: unknown) => void;
    "prevencion:creada": (payload: unknown) => void;
    "recuperacion:creada": (payload: unknown) => void;
    "asistencia_social:creada": (payload: unknown) => void;
    "punto_critico:creado": (payload: unknown) => void;
    "punto_critico:eliminado": (payload: {
        id: string;
        codigo: string;
        nombre: string;
        eliminadoPorId: string;
        eliminadoEn: string;
    }) => void;
    "punto_critico:actualizado": (payload: unknown) => void;
    "cuadrilla:creada": (payload: unknown) => void;
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
