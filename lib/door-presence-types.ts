export type DoorPresence = {
  online: boolean;
  clients: number;
  devices: string[];
  updatedAt: string | null;
  configured: boolean;
};

export function emptyDoorPresence(configured = false): DoorPresence {
  return {
    online: false,
    clients: 0,
    devices: [],
    updatedAt: null,
    configured,
  };
}
