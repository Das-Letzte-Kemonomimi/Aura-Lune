export interface AudioCardProfile {
  name: string;
  description: string;
  available: boolean;
  is_pro_audio: boolean;
  bluetooth_codec: string | null;
}

export interface AudioCard {
  index: number;
  name: string;
  description: string;
  is_bluetooth: boolean;
  active_profile: string | null;
  profiles: AudioCardProfile[];
}
