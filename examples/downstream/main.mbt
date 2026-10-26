///|
fn field(value : Json, key : String) -> Json {
  match value {
    Object(fields) => match fields.get(key) {
      Some(value) => value
      None => abort("Missing response field: " + key)
    }
    _ => abort("Expected response object")
  }
}

///|
fn send(
  engine : @moonmetamath.Engine,
  operation : String,
  values : Array[(String, Json)],
) -> Json {
  values.push(("schema_version", Json::number(1.0)))
  values.push(("request_id", Json::string("example-" + operation)))
  values.push(("operation", Json::string(operation)))
  @json.parse(
    @moonmetamath.dispatch_engine(engine, Json::object(Map(values)).stringify()),
  ) catch { _ => abort("Invalid JSON response") }
}

///|
fn checked(response : Json) -> Json {
  if field(response, "status") != Json::string("ok") {
    abort(response.stringify())
  }
  response
}

///|
fn main {
  let first = @moonmetamath.new_engine()
  let second = @moonmetamath.new_engine()
  let source = @json.parse(
    "{\"source_id\":\"example.mm\",\"text\":\"$c |- a $. ax $a |- a $. target $p |- a $= ax $.\"}",
  ) catch { _ => abort("Invalid example source") }
  let loaded = checked(send(first, "load", [
    ("entry", Json::string("example.mm")),
    ("sources", Json::array([source])),
  ]))
  let database_id = field(field(loaded, "data"), "database_id")
  let report = checked(send(first, "verify", [("database_id", database_id)]))
  if field(report, "outcome") != Json::string("valid") {
    abort("Input was not verified")
  }
  // A second independent client may reset without affecting the first one.
  let _ = checked(send(second, "reset", []))
  for _ in 0..<80 {
    let started = checked(send(first, "start", [
      ("database_id", database_id),
      ("target_label", Json::string("target")),
    ]))
    let sid = field(field(started, "data"), "session_id")
    let _ = checked(send(first, "close_session", [("session_id", sid)]))
  }
  let started = checked(send(first, "start", [
    ("database_id", database_id),
    ("target_label", Json::string("target")),
  ]))
  let session_id = field(field(started, "data"), "session_id")
  if field(send(second, "inspect", [("session_id", session_id)]), "status") !=
    Json::string("error") {
    abort("Cross-engine handle was accepted")
  }
  if field(send(first, "unload_database", [("database_id", database_id)]), "status") !=
    Json::string("error") {
    abort("Database with active proof was unloaded")
  }
  let _ = checked(send(first, "apply_label", [
    ("session_id", session_id), ("label", Json::string("ax")),
  ]))
  let finished = checked(send(first, "finish", [("session_id", session_id)]))
  if field(finished, "outcome") != Json::string("valid") {
    abort("Proof did not finish")
  }
  let exported = checked(send(first, "export", [
    ("session_id", session_id),
    ("new_label", Json::string("downstream-proof")),
  ]))
  println(exported.stringify())
  let _ = checked(send(first, "close_session", [("session_id", session_id)]))
  let _ = checked(send(first, "unload_database", [("database_id", database_id)]))
  if field(send(first, "inspect", [("session_id", session_id)]), "status") !=
    Json::string("error") {
    abort("Closed handle survived")
  }
  println("{\"pass\":true,\"scenario\":\"isolated-proof-client\",\"reused_sessions\":80}")
}
