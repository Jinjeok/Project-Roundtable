import readline from "readline";
import dotenv from "dotenv";
import { GeminiClient } from "./lib/geminiClient.js";
import { DiceRoller } from "./lib/diceRoller.js";
import { PromptBuilder } from "./lib/promptBuilder.js";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is not set in .env file");
  process.exit(1);
}

// Initialize components
const gemini = new GeminiClient(GEMINI_API_KEY);
const dice = new DiceRoller();
const promptBuilder = new PromptBuilder();

// Session state
let sessionState = {
  messages: [],
  characterHP: 10,
  characterName: "Unnamed Adventurer",
  currentScene: "A misty forest path",
};

// Main game loop
async function gameLoop() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n========================================");
  console.log("   Project RT: Cairn RPG AI GM Test   ");
  console.log("========================================\n");
  console.log(`📖 Scene: ${sessionState.currentScene}`);
  console.log(`❤️  HP: ${sessionState.characterHP}\n`);
  console.log('Type your action (or "quit" to exit):\n');

  const askQuestion = () => {
    rl.question("> ", async (userInput) => {
      if (userInput.toLowerCase() === "quit") {
        console.log("\n👋 Game ended.");
        rl.close();
        return;
      }

      try {
        await handlePlayerAction(userInput);
        console.log("\n---\n");
        askQuestion(); // Continue loop
      } catch (error) {
        console.error("❌ Error:", error.message);
        askQuestion();
      }
    });
  };

  askQuestion();
}

// Handle player action
async function handlePlayerAction(playerInput) {
  console.log("\n🤔 Warden is thinking...\n");

  // Add player message to session
  sessionState.messages.push({
    role: "player",
    content: playerInput,
  });

  // Build prompt with context
  const prompt = promptBuilder.build(sessionState, playerInput);

  // Call Gemini
  const response = await gemini.generateWithFunctionCalling(prompt);

  // Parse response
  if (response.type === "function_call") {
    // AI wants to roll dice
    console.log(`\n📋 Warden requests: ${response.functionName}`);

    let functionResult;

    if (response.functionName === "roll_dice") {
      const diceExpr = response.args.dice_expression;
      const reason = response.args.reason;

      const rollResult = dice.roll(diceExpr);

      console.log(`\n🎲 ${reason}`);
      console.log(`   Expression: ${diceExpr}`);
      console.log(`   Rolls: [${rollResult.rolls.join(", ")}]`);
      console.log(`   Total: ${rollResult.total}`);

      functionResult = rollResult.total;

      // Add function call and result to message history
      sessionState.messages.push({
        role: "warden",
        type: "function_call",
        function: "roll_dice",
        args: response.args,
        result: functionResult,
      });
    } else if (response.functionName === "update_hp") {
      const amount = response.args.amount;
      sessionState.characterHP += amount; // negative = damage
      console.log(`\n❤️ HP changed by ${amount}. Current HP: ${sessionState.characterHP}`);

      sessionState.messages.push({
        role: "warden",
        type: "function_call",
        function: "update_hp",
        args: response.args,
        result: sessionState.characterHP,
      });
    }
  } else if (response.type === "narrative") {
    // AI response is pure narrative
    console.log(`\n📖 Warden: ${response.content}`);
    sessionState.messages.push({
      role: "warden",
      type: "narrative",
      content: response.content,
    });
  }
}

// Start game
gameLoop().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
