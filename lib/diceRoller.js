export class DiceRoller {
  roll(expression) {
    // Parse: "1d6", "2d8+1", etc.
    const match = expression.match(/^(\d+)d(\d+)([\+\-]\d+)?$/);

    if (!match) {
      throw new Error(`Invalid dice expression: ${expression}`);
    }

    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;

    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = rolls.reduce((a, b) => a + b, 0) + modifier;

    return {
      expression,
      count,
      sides,
      modifier,
      rolls,
      total,
    };
  }
}
