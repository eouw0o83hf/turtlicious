// ---------------------------------------------------------------------------
// Rendering-stack monad contract.
//
// Every layer in the stack is a RenderingStackMember — it accepts a typed
// input and returns a RenderMonad wrapping the transformed output.
// Layers are composed with .chain(), which threads values through the stack
// and accumulates diagnostic errors without short-circuiting.
// ---------------------------------------------------------------------------

export type RenderingStackMember<Input, Output> = {
  /** Human-readable name shown in diagnostics. */
  name: string;
  run(input: Input): RenderMonad<Output>;
};

export class RenderMonad<Value> {
  constructor(
    readonly value: Value,
    readonly errors: string[] = [],
  ) {}

  /** Lift a plain value into the monad. */
  static of<Value>(value: Value) {
    return new RenderMonad(value);
  }

  /** Transform the wrapped value without introducing new errors. */
  map<NextValue>(transform: (value: Value) => NextValue) {
    return new RenderMonad(transform(this.value), this.errors);
  }

  /** Pass the current value through a stack layer, merging any new errors. */
  chain<NextValue>(layer: RenderingStackMember<Value, NextValue>) {
    const next = layer.run(this.value);
    return new RenderMonad(next.value, [...this.errors, ...next.errors]);
  }
}
