import type { Message } from "discord.js";
import type { Command } from "./index";
import { loadConfig, saveConfig, SETTABLE_KEYS, type SettableKey } from "../config";

export class SetCommand implements Command {
  readonly prefix = "!set";

  execute(message: Message): void {
    const [, key, value] = message.content.split(" ");

    if (!key || !value || !SETTABLE_KEYS.includes(key as SettableKey)) return;

    const config = loadConfig();
    config[key as SettableKey] = value;
    saveConfig(config);
    console.log(`Updated config: ${key} = ${value}`);
  }
}
