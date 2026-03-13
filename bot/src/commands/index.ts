import type { Message } from "discord.js";

export interface Command {
  readonly prefix: string;
  execute(message: Message): void | Promise<void>;
}

export class CommandHandler {
  private readonly commands: Command[] = [];

  register(...commands: Command[]): this {
    this.commands.push(...commands);
    return this;
  }

  async handle(message: Message): Promise<void> {
    for (const command of this.commands) {
      if (
        message.content === command.prefix ||
        message.content.startsWith(`${command.prefix} `)
      ) {
        await command.execute(message);
        return;
      }
    }
  }
}
