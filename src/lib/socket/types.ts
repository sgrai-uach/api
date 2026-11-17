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
    "cuadrilla:actualizada": (payload: unknown) => void;
    "cuadrilla:desactivada": (payload: unknown) => void;
    "patrulla:actualizada": (payload: {
        patrullaId: string;
        nombre: string;
        estado: string;
        delegacionId: string | null;
        usuarioLiderId: string | null;
        misionActivaId?: string | null;
        incidenteId?: string | null;
        actualizadoEn: string;
    }) => void;
    "patrulla:liberada": (payload: {
        patrullaId: string;
        nombre: string;
        misionPreviaId?: string | null;
        incidenteId: string;
        estado: string;
        liberadaEn: string;
    }) => void;
    "patrulla:desactivada": (payload: {
        patrullaId: string;
        nombre: string;
        eliminadoPorId?: string | null;
        eliminadoEn: string;
    }) => void;
    "mision:asignada": (payload: {
        notificacionId?: string;
        misionId: string;
        codigo: string;
        tipoMision: string;
        patrullaId?: string | null;
        cuadrillaId?: string | null;
        incidenteId?: string | null;
        incidenteCodigo?: string | null;
        incidenteFolio?: string | null;
        tipoAfectacion?: string | null;
        direccion?: string | null;
        prioridad?: string;
        asignadoEn: string;
    }) => void;
    "mision:actualizada": (payload: {
        misionId: string;
        codigo: string;
        estado: string;
        tipoMision: string;
        patrullaId?: string | null;
        cuadrillaId?: string | null;
        incidenteId?: string | null;
        fechaInicio: string | null;
        hito: {
            id: string;
            hito: string;
            descripcion: string;
            registradoPorId: string | null;
            creadoEn: string;
        };
        actualizadoEn: string;
    }) => void;
    "notificacion:trazabilidad_actualizada": (payload: {
        notificacionId: string;
        misionId: string;
        patrullaId: string;
        estado: "PENDIENTE_ENVIO" | "ENVIADA" | "RECIBIDA" | "LEIDA";
        intentosEnvio: number;
        creadaAt: string;
        enviadaAt?: string | null;
        recibidaAt?: string | null;
        leidaAt?: string | null;
        actualizadoEn: string;
    }) => void;
}

export interface ClientToServerEvents {
    join: (room: string) => void;
    leave: (room: string) => void;
    unirse: (room: string) => void;
    salir: (room: string) => void;
    "notificacion:ack": (
        payload: { notificacionId: string; estado: "RECIBIDA" | "LEIDA" },
        callback?: (response: { ok: boolean; message?: string; error?: string }) => void
    ) => void;
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
