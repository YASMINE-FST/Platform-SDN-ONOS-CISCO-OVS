export interface CiscoDevice {
  device_id: string;
  id?: string;
  ip: string;
  port: number | string;
  hwVersion?: string;
  swVersion?: string;
  mfr?: string;
  available?: boolean;
}

export interface CiscoCpu {
  five_seconds?: number;
  one_minute?: number;
  five_minutes?: number;
}

export interface CiscoMemoryPool {
  name?: string;
  total?: number;
  used?: number;
  free?: number;
  usage_percent?: number;
}

export interface CiscoInterface {
  name: string;
  description?: string;
  admin_status?: string;
  oper_status?: string;
  speed?: number;
  mtu?: number;
  in_octets?: number;
  out_octets?: number;
  in_pkts?: number;
  out_pkts?: number;
  errors?: number;
  ipv4?: string;
}

export interface CiscoRoute {
  destination?: string;
  prefix?: string;
  mask?: string;
  next_hop?: string;
  protocol?: string;
  metric?: number;
  distance?: number;
  interface?: string;
}

export interface CiscoArpEntry {
  ip: string;
  mac: string;
  interface?: string;
  type?: string;
}

export interface CiscoOspfStatus {
  router_id?: string;
  status?: string;
  areas?: Array<{ id: string; type?: string }>;
  neighbors?: Array<{ id: string; address?: string; state?: string; interface?: string }>;
}

export interface CiscoBgpRoute {
  prefix: string;
  next_hop?: string;
  as_path?: string;
  local_pref?: number;
  med?: number;
  status?: string;
}

export interface CiscoCdpNeighbor {
  device_id: string;
  ip_address?: string;
  platform?: string;
  capabilities?: string;
  local_interface?: string;
  remote_interface?: string;
}

export interface CiscoNtpStatus {
  status?: string;
  peers?: Array<{ address: string; stratum?: number; offset?: number; jitter?: number; state?: string }>;
}

export interface CiscoDhcpPool {
  name: string;
  network?: string;
  gateway?: string;
  dns?: string[];
  utilization?: number;
  leased?: number;
  total?: number;
}

export interface CiscoLogEntry {
  timestamp: string;
  severity: string;
  facility?: string;
  message: string;
}

export interface CiscoProcess {
  pid: number | string;
  name: string;
  cpu_percent?: number;
  memory_bytes?: number;
  state?: string;
  runtime?: string;
}
