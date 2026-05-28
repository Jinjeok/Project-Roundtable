import { randomUUID } from "crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { DailyTokenBudget } from "./dailyTokenBudget.js";
import { DiceRoller } from "./diceRoller.js";
import { GeminiClient } from "./geminiClient.js";
import { OpenAIClient } from "./openaiClient.js";
import { PromptBuilder } from "./promptBuilder.js";

const SESSION_DIR = path.join(process.cwd(), ".data", "sessions");
const GPT54_MODEL = "gpt-5.4";
const GPT54_MINI_MODEL = "gpt-5.4-mini";
const COMPACT_THRESHOLD = 10;
const KEEP_RECENT = 5;
const tokenBudgets = globalThis.__roundtableTokenBudgets || new Map();
globalThis.__roundtableTokenBudgets = tokenBudgets;

const PROLOGUE = `길을 잃은 지 사흘째 밤, 축축한 안개 사이로 무너진 예배당이 모습을 드러냅니다.
문은 반쯤 열려 있고, 안쪽 어둠 속에서 약한 불빛이 한 번 깜빡입니다.
그때, 어딘가에서 낮은 목소리가 들립니다. "돌아가라. 아직 늦지 않았다."

무엇을 하시겠습니까?
1. 문틈으로 안을 살펴본다.
2. 목소리의 주인에게 말을 건다.
3. 무기를 꺼내 들고 예배당으로 들어간다.

원하시는 행동을 문장으로 입력해 주세요. 명령어 안내는 /help 입니다.`;

const HELP = `하고 싶은 행동을 자유롭게 입력하시면 Warden이 결과를 진행합니다.

예시
- 문에 귀를 대고 안쪽 소리를 듣는다
- 등불을 켜고 예배당 안으로 들어간다
- 돌아가라는 목소리의 정체를 묻는다

명령어
- /help: 도움말 표시
- /scenario: 즉시 위험한 사건 생성
- /roll 1d20: 주사위 직접 굴림
- /test_ai: AI 함수 호출 모의 테스트`;

function now() {
  return new Date().toISOString();
}

function addDebug(session, level, event, detail) {
  session.debugLogs.push({
    id: randomUUID(),
    timestamp: now(),
    level,
    event,
    detail,
  });
}

function addMessage(session, role, content, extras = {}) {
  session.messages.push({
    id: randomUUID(),
    role,
    content,
    timestamp: now(),
    ...extras,
  });
}

function getConfig() {
  const provider = (
    process.env.AI_PROVIDER ||
    (process.env.OPENAI_API_KEY ? "openai" : "gemini")
  ).toLowerCase();
  const openAIMode = (process.env.OPENAI_MODE || "gpt54_then_mini").toLowerCase();

  if (!["openai", "gemini"].includes(provider)) {
    throw new Error("AI_PROVIDER는 openai 또는 gemini여야 합니다.");
  }
  if (!["gpt54_then_mini", "mini_only"].includes(openAIMode)) {
    throw new Error("OPENAI_MODE는 gpt54_then_mini 또는 mini_only여야 합니다.");
  }

  const apiKey =
    provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;

  return {
    provider,
    openAIMode,
    enabled: Boolean(apiKey && !apiKey.includes("your_api_key")),
    gpt54Limit: Number.parseInt(
      process.env.OPENAI_GPT54_DAILY_TOKEN_LIMIT || "250000",
      10
    ),
    maxOutputTokens: Number.parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS || "2048", 10),
    usageTimeZone: process.env.OPENAI_USAGE_TIME_ZONE || "UTC",
    usageFile:
      process.env.OPENAI_USAGE_FILE || ".data/openai-gpt-5.4-token-usage.json",
  };
}

function createSession() {
  const config = getConfig();
  const session = {
    id: randomUUID(),
    createdAt: now(),
    state: {
      characterHP: 10,
      characterName: "이름 없는 방랑자",
      currentScene: "안개가 자욱한 숲길, 폐허가 된 예배당 앞",
      summary: "",
    },
    messages: [],
    debugLogs: [],
  };

  addMessage(session, "warden", PROLOGUE);
  addDebug(session, "info", "session_created", {
    provider: config.enabled ? config.provider : "offline",
    openAIMode: config.provider === "openai" ? config.openAIMode : null,
    gpt54Limit:
      config.provider === "openai" && config.openAIMode === "gpt54_then_mini"
        ? config.gpt54Limit
        : null,
  });
  return session;
}

function sessionPath(sessionId) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    throw new Error("올바르지 않은 세션 ID입니다.");
  }
  return path.join(SESSION_DIR, `${sessionId}.json`);
}

async function saveSession(session) {
  await mkdir(SESSION_DIR, { recursive: true });
  await writeFile(sessionPath(session.id), `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

async function loadSession(sessionId) {
  try {
    return JSON.parse(await readFile(sessionPath(sessionId), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function loadLatestSession() {
  try {
    await mkdir(SESSION_DIR, { recursive: true });
    const files = (await readdir(SESSION_DIR)).filter((f) => f.endsWith(".json"));
    if (files.length === 0) return null;
    const stats = await Promise.all(
      files.map(async (f) => ({ id: f.slice(0, -5), mtime: (await stat(path.join(SESSION_DIR, f))).mtime }))
    );
    stats.sort((a, b) => b.mtime - a.mtime);
    return loadSession(stats[0].id);
  } catch {
    return null;
  }
}

function publicSession(session) {
  const config = getConfig();
  return {
    id: session.id,
    state: session.state,
    messages: session.messages.filter((message) => message.visible !== false),
    debugLogs: session.debugLogs,
    config: {
      provider: config.enabled ? config.provider : "offline",
      openAIMode: config.provider === "openai" ? config.openAIMode : null,
      gpt54Limit:
        config.provider === "openai" && config.openAIMode === "gpt54_then_mini"
          ? config.gpt54Limit
          : null,
    },
  };
}

async function generateSummary(historyText, config) {
  const prompt = `다음은 Cairn RPG 게임의 대화 기록입니다.
핵심 사건, 전투 결과, 장소, 캐릭터 상태 변화를 포함해 2~3문장으로 요약하세요.
**반드시 한국어로 작성하세요.**

대화 기록:
${historyText}`;

  if (config.provider === "gemini" && config.enabled) {
    return new GeminiClient(process.env.GEMINI_API_KEY).generateText(prompt);
  }
  if (config.provider === "openai" && config.enabled) {
    return new OpenAIClient(process.env.OPENAI_API_KEY, GPT54_MINI_MODEL, {
      maxOutputTokens: 300,
    }).generateText(prompt);
  }
  return "";
}

async function compactHistory(session) {
  const config = getConfig();
  if (!config.enabled) return;

  const active = session.messages.filter((m) => !m.compacted);
  if (active.length <= COMPACT_THRESHOLD) return;

  const toCompact = active.slice(0, -KEEP_RECENT);
  const historyText = toCompact
    .filter((m) => m.visible !== false)
    .map((m) => `${m.role === "player" ? "플레이어" : "Warden"}: ${m.content}`)
    .join("\n");

  if (!historyText) return;

  const summary = await generateSummary(historyText, config);
  if (!summary) return;

  const compactIds = new Set(toCompact.map((m) => m.id).filter(Boolean));
  for (const m of session.messages) {
    if (compactIds.has(m.id)) m.compacted = true;
  }

  session.state.summary = summary;
  addDebug(session, "info", "compact_done", {
    compacted: toCompact.length,
    kept: KEEP_RECENT,
    summary,
  });
}

function createAIClient(session) {
  const config = getConfig();
  if (!config.enabled) {
    return null;
  }

  if (config.provider === "gemini") {
    return new GeminiClient(process.env.GEMINI_API_KEY);
  }

  const budgetKey = `${config.usageFile}:${config.gpt54Limit}:${config.usageTimeZone}`;
  if (!tokenBudgets.has(budgetKey)) {
    tokenBudgets.set(
      budgetKey,
      new DailyTokenBudget({
        limit: config.gpt54Limit,
        filePath: config.usageFile,
        timeZone: config.usageTimeZone,
      })
    );
  }
  const tokenBudget = tokenBudgets.get(budgetKey);

  return new OpenAIClient(
    process.env.OPENAI_API_KEY,
    config.openAIMode === "gpt54_then_mini" ? GPT54_MODEL : GPT54_MINI_MODEL,
    {
      fallbackModel: config.openAIMode === "gpt54_then_mini" ? GPT54_MINI_MODEL : null,
      maxOutputTokens: config.maxOutputTokens,
      tokenBudget: config.openAIMode === "gpt54_then_mini" ? tokenBudget : null,
      onDebug: (event, detail) => addDebug(session, "api", event, detail),
    }
  );
}

async function resolveAIResponse(session, client, response) {
  addDebug(session, "debug", "ai_response", {
    type: response.type,
    functionName: response.functionName || null,
  });

  if (response.type === "text") {
    addMessage(session, "warden", response.text);
    return;
  }

  let result;
  if (response.functionName === "roll_dice") {
    const roll = new DiceRoller().roll(response.args.dice_expression);
    result = roll.total;
    addMessage(
      session,
      "warden",
      `판정: ${response.args.reason}\n주사위 ${response.args.dice_expression} -> [${roll.rolls.join(", ")}], 합계 ${roll.total}`
    );
    addDebug(session, "game", "dice_rolled", {
      expression: response.args.dice_expression,
      reason: response.args.reason,
      rolls: roll.rolls,
      total: roll.total,
    });
  } else if (response.functionName === "update_hp") {
    session.state.characterHP += response.args.amount;
    result = session.state.characterHP;
    addMessage(
      session,
      "warden",
      `HP 변화: ${response.args.amount > 0 ? "+" : ""}${response.args.amount}\n현재 HP: ${session.state.characterHP}`
    );
    addDebug(session, "game", "hp_updated", {
      amount: response.args.amount,
      reason: response.args.reason,
      currentHP: session.state.characterHP,
    });
  } else {
    throw new Error(`지원하지 않는 함수 호출입니다: ${response.functionName}`);
  }

  session.messages.push({
    id: randomUUID(),
    timestamp: now(),
    role: "warden",
    type: "function_call",
    function: response.functionName,
    args: response.args,
    result,
    visible: false,
  });

  const narration = await client.generateText(
    new PromptBuilder().buildFollowUp(
      { ...session.state, messages: session.messages },
      response.functionName,
      result
    )
  );
  addMessage(session, "warden", narration);
}

export async function openGameSession(sessionId) {
  const loaded = (sessionId ? await loadSession(sessionId) : null) ?? await loadLatestSession();
  const session = loaded ?? createSession();
  await saveSession(session);
  return publicSession(session);
}

export async function sendGameInput(sessionId, input) {
  const session = await loadSession(sessionId);
  if (!session) {
    throw new Error("세션을 찾을 수 없습니다. 새 게임을 시작해 주세요.");
  }

  const text = String(input || "").trim();
  if (!text) {
    return publicSession(session);
  }

  addMessage(session, "player", text);
  addDebug(session, "input", "player_input", { text });

  if (text.toLowerCase() === "/help" || text.toLowerCase() === "help") {
    addMessage(session, "warden", HELP);
    await saveSession(session);
    return publicSession(session);
  }

  if (text.toLowerCase().startsWith("/roll ")) {
    try {
      const roll = new DiceRoller().roll(text.slice(6).trim());
      addMessage(
        session,
        "warden",
        `직접 굴림: ${roll.expression}\n결과: [${roll.rolls.join(", ")}]\n합계: ${roll.total}`
      );
      addDebug(session, "game", "manual_dice_roll", roll);
    } catch (error) {
      addMessage(session, "warden", `잘못된 주사위 식입니다: ${error.message}`);
      addDebug(session, "error", "manual_dice_roll_failed", { message: error.message });
    }
    await saveSession(session);
    return publicSession(session);
  }

  if (text.toLowerCase() === "/test_ai") {
    const roll = new DiceRoller().roll("1d20");
    addMessage(
      session,
      "warden",
      `모의 판정 굴림\n주사위 1d20 -> [${roll.rolls.join(", ")}], 합계 ${roll.total}\n\n[모의 진행] 주사위 결과에 따라 행동이 처리되었습니다.`
    );
    addDebug(session, "debug", "mock_function_call", { name: "roll_dice" });
    addDebug(session, "game", "dice_rolled", {
      expression: "1d20",
      reason: "모의 판정 굴림",
      rolls: roll.rolls,
      total: roll.total,
    });
    await saveSession(session);
    return publicSession(session);
  }

  const client = createAIClient(session);
  if (!client) {
    addMessage(session, "warden", "AI 기능이 꺼져 있습니다. API 키를 설정하거나 /help의 테스트 명령을 사용해 주세요.");
    addDebug(session, "warn", "ai_disabled", {});
    await saveSession(session);
    return publicSession(session);
  }

  try {
    const promptBuilder = new PromptBuilder();
    const promptState = { ...session.state, messages: session.messages };
    const prompt =
      text.toLowerCase() === "/scenario"
        ? promptBuilder.buildScenarioPrompt(promptState)
        : promptBuilder.build(promptState, text);

    addDebug(session, "api", "generation_started", {
      command: text.toLowerCase() === "/scenario" ? "scenario" : "action",
    });
    await resolveAIResponse(
      session,
      client,
      await client.generateWithFunctionCalling(prompt)
    );
    await compactHistory(session);
  } catch (error) {
    addMessage(session, "warden", `진행 중 오류가 발생했습니다: ${error.message}`);
    addDebug(session, "error", "generation_failed", { message: error.message });
  }

  await saveSession(session);
  return publicSession(session);
}
