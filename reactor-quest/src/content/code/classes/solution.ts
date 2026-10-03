export class FuelTank {
  private amount = 0;

  constructor(public readonly capacity: number) {}

  fill(amount: number): number {
    this.amount = Math.min(this.capacity, this.amount + amount);
    return this.amount;
  }

  drain(amount: number): number {
    if (amount > this.amount) {
      throw new Error("Not enough fuel");
    }
    this.amount -= amount;
    return this.amount;
  }

  get level(): number {
    return this.amount;
  }

  get percent(): number {
    return Math.round((this.amount / this.capacity) * 100);
  }
}
