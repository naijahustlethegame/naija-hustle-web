import { DEFAULT_AVATAR, type AvatarConfig } from "@/game/avatar/avatar";

const KEY = "naija-hustle:avatar";

export function loadAvatar(): AvatarConfig {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_AVATAR, ...JSON.parse(raw) } : DEFAULT_AVATAR;
  } catch { return DEFAULT_AVATAR; }
}
export function saveAvatar(a: AvatarConfig) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {}
}
