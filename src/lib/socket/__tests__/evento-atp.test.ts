/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { emitirEventoAtpCreado, setSocketServer } from "@/lib/socket";

const SALAS_ESPERADAS = [
  "sala:encargados",
  "encargado",
  "supervisor",
  "mapa",
  "admin",
  "administrador",
];

describe("emitirEventoAtpCreado (H61)", () => {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  const emitGlobal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setSocketServer({ to, emit: emitGlobal } as any);
  });

  afterEach(() => {
    setSocketServer(null as any);
  });

  it("debe emitir el eventoATP creado solo en las salas autorizadas, sin broadcast global", () => {
    const payload = { id: "50000000-0000-4000-8000-000000000001" };

    emitirEventoAtpCreado(payload);

    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith(SALAS_ESPERADAS);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("evento_atp:creado", payload);
    expect(emitGlobal).not.toHaveBeenCalled();
  });
});
