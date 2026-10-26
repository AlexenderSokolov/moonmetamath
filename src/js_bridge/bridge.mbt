///|
pub fn dispatch_json(request : String) -> String {
  @core.dispatch_json(request)
}

///|
pub fn create_dispatcher() -> (String) -> String {
  let engine = @core.new_engine()
  request => @core.dispatch_engine(engine, request)
}
