export type GateRequestStatus = "pending" | "approved" | "denied";

export type GateEvent =
  | { type: "hello" }
  | { type: "request"; id: string; status: GateRequestStatus }
  | { type: "pending" };
