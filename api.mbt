/// Execute a versioned request using the native MoonBit proof engine.
pub fn dispatch_json(request : String) -> String {
  @core.dispatch_json(request)
}
