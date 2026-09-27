import * as Crypto from "expo-crypto";

export const randomId = (): string => Crypto.randomUUID();
