import type { Message } from "discord.js";
import type { Command } from "./index";
import { SETTABLE_KEYS, type SettableKey } from "../config";
import { setConfigValue } from "../db";

export class SetCommand implements Command {
  readonly prefix = "!set";

  async execute(message: Message): Promise<void> {
    const [, key, value] = message.content.split(" ");
    if (!key || !value || !SETTABLE_KEYS.includes(key as SettableKey)) return;
    await setConfigValue(key as SettableKey, value);
    console.log(`Updated config: ${key} = ${value}`);
  }
}
