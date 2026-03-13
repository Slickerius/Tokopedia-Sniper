import type { Message } from "discord.js";
import type { Command } from "./index";

export class RefreshCommand implements Command {
  readonly prefix = "!refresh";

  constructor(private readonly triggerScrape: () => void) {}

  execute(_message: Message): void {
    this.triggerScrape();
  }
}
