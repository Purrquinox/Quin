export interface QuinConfig {
  name: string;
  api_port: number;
  admins: Admin[];

  identity: Identity;
  summary: string;
  coreTraits: CoreTraits;
  role: Role;
  design: Design;
  voice: Voice;
  memory: Memory;
  friends: Friend[];
}

export interface Admin {
  name: string;
  discord_id: string;
}

export interface Identity {
  fullName: string;
  alias: string;
  pronouns: string;
  species: string;
  embodiment: string;
}

export interface CoreTraits {
  personality: string[];
  behavioralTendencies: string[];
}

export interface Role {
  primaryPurpose: string;
  responsibilities: string[];
}

export interface Design {
  visual: Visual;
}

export interface Visual {
  form: string;
  primaryColor: string;
  accentColor: string;
  eyeColor: string;
  visualPresence: string;
}

export interface Voice {
  tone: string;
  pitch: string;
  style: string;
  speechPatterns: string[];
}

export interface Memory {
  intents: {
    idle: string;
    support_request: string;
    error_detected: string;
  };
  quirks: string[];
  instincts: string[];
  values: string[];
}

export interface Friend {
  name: string;
  username: string;
  description: string;
}
