///|
/// Execute a versioned request using the native MoonBit proof engine.
pub fn dispatch_json(request : String) -> String {
  @core.dispatch_json(request)
}

///|
pub struct Engine {
  priv core : @core.Engine
}

///|
pub fn new_engine() -> Engine {
  { core: @core.new_engine(), }
}

///|
pub fn dispatch_engine(engine : Engine, request : String) -> String {
  @core.dispatch_engine(engine.core, request)
}

///|
pub fn create_dispatcher() -> (String) -> String {
  let engine = new_engine()
  request => dispatch_engine(engine, request)
}
