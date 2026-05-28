import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export class DailyTokenLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = "DailyTokenLimitError";
  }
}

export class DailyTokenBudget {
  constructor({
    limit = 250000,
    filePath = ".data/openai-gpt-5.4-token-usage.json",
    timeZone = "UTC",
  } = {}) {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("Daily token limit must be a positive integer.");
    }

    this.limit = limit;
    this.filePath = filePath;
    this.timeZone = timeZone;
    this.pendingOperation = Promise.resolve();
  }

  getDateKey(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: this.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  async getUsage() {
    const today = this.getDateKey();

    try {
      const contents = await readFile(this.filePath, "utf8");
      const usage = JSON.parse(contents);

      if (usage.date === today) {
        return usage;
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    return { date: today, totalTokens: 0, reservedTokens: 0 };
  }

  async updateUsage(operation) {
    const update = this.pendingOperation.then(operation, operation);
    this.pendingOperation = update.catch(() => {});
    return update;
  }

  async writeUsage(usage) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(usage, null, 2)}\n`, "utf8");
  }

  async reserve(maxPossibleTokens) {
    if (!Number.isInteger(maxPossibleTokens) || maxPossibleTokens <= 0) {
      throw new Error("Reserved token count must be a positive integer.");
    }

    return this.updateUsage(async () => {
      const usage = await this.getUsage();
      const reservedTokens = usage.reservedTokens || 0;
      const remaining = this.limit - usage.totalTokens - reservedTokens;

      if (maxPossibleTokens > remaining) {
        throw new DailyTokenLimitError(
          `OpenAI daily token limit reached: ${usage.totalTokens}/${this.limit} used, ` +
            `${remaining} remaining, ${maxPossibleTokens} required for this request.`
        );
      }

      await this.writeUsage({
        ...usage,
        reservedTokens: reservedTokens + maxPossibleTokens,
      });

      return maxPossibleTokens;
    });
  }

  async settle(reservedTokens, actualTokens) {
    if (!Number.isInteger(actualTokens) || actualTokens < 0) {
      throw new Error("Actual token count must be a non-negative integer.");
    }

    return this.updateUsage(async () => {
      const usage = await this.getUsage();
      const currentReservation = usage.reservedTokens || 0;
      const updated = {
        date: usage.date,
        totalTokens: usage.totalTokens + actualTokens,
        reservedTokens: currentReservation - reservedTokens,
      };

      if (updated.reservedTokens < 0 || updated.totalTokens > this.limit) {
        throw new Error("OpenAI daily token limit accounting became inconsistent.");
      }

      await this.writeUsage(updated);

      return updated;
    });
  }
}
