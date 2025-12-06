export class DiceRoller {
  roll(expression) {
    const parsed = this.parse(expression);
    const { count, sides, modifier } = parsed;

    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;

    return {
      expression,
      rolls,
      modifier,
      total,
    };
  }

  parse(expression) {
    // Parse formats: d20, 2d6, d8+3, 3d6-1
    const match = expression.match(/^(\d*)d(\d+)(([+-])(\d+))?$/i);

    if (!match) {
      throw new Error(`Invalid dice expression: ${expression}`);
    }

    const count = match[1] ? parseInt(match[1]) : 1;
    const sides = parseInt(match[2]);
    const modifier = match[4] === "+" ? parseInt(match[5]) : -parseInt(match[5]) || 0;

    return { count, sides, modifier };
  }
}
