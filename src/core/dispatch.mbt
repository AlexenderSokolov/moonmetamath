// Versioned wire adapter. All semantic operations below call the native core.

///|
pub struct Engine {
  priv databases : Map[String, MMDatabase]
  priv sessions : Map[String, (String, MMSession)]
}

///|
pub fn new_engine() -> Engine {
  { databases: Map([]), sessions: Map([]), }
}

///|
let default_engine : Engine = new_engine()

///|
let wire_serial : Array[Int] = [0]

///|
// Decimal digits avoid bounded integer wraparound reviving an expired handle.
fn next_wire_id(prefix : String) -> String {
  let mut digit = 0
  while digit < wire_serial.length() && wire_serial[digit] == 9 {
    wire_serial[digit] = 0
    digit = digit + 1
  }
  if digit == wire_serial.length() {
    wire_serial.push(1)
  } else {
    wire_serial[digit] = wire_serial[digit] + 1
  }
  let characters : Array[String] = []
  for i = wire_serial.length() - 1; i >= 0; i = i - 1 {
    characters.push(wire_serial[i].to_string())
  }
  prefix + characters.join("")
}

///|
fn jstring(value : String) -> Json {
  Json::string(value)
}

///|
fn jnumber(value : Int) -> Json {
  Json::number(value.to_double())
}

///|
fn jbool(value : Bool) -> Json {
  Json::boolean(value)
}

///|
fn jstrings(values : Array[String]) -> Json {
  Json::array(values.map(jstring))
}

///|
fn jobject(fields : Array[(String, Json)]) -> Json {
  Json::object(Map(fields))
}

///|
fn wire_error(code : String, message : String) -> MMError {
  { code, message, source: "request", start: 0, end: 0, line: 1, column: 1, }
}

///|
fn is_resource_limit(code : String) -> Bool {
  code == "resource_limit" || code == "ResourceLimit"
}

///|
fn diagnostic_json(err : MMError) -> Json {
  jobject([
    ("code", jstring(err.code)),
    ("message", jstring(err.message)),
    ("source", jstring(err.source)),
    ("start", jnumber(err.start)),
    ("end", jnumber(err.end)),
    ("line", jnumber(err.line)),
    ("column", jnumber(err.column)),
  ])
}

///|
fn wire_response(
  op : String,
  request_id : String,
  data : Json,
  outcome : Json,
  diagnostics : Array[MMError],
  ok : Bool,
) -> Json {
  jobject([
    ("schema_version", jnumber(1)),
    ("request_id", jstring(request_id)),
    ("operation", jstring(op)),
    ("status", jstring(if ok { "ok" } else { "error" })),
    ("outcome", outcome),
    ("data", data),
    ("diagnostics", Json::array(diagnostics.map(diagnostic_json))),
  ])
}

///|
fn json_field(value : Json, key : String) -> Json? {
  match value {
    Object(obj) => obj.get(key)
    _ => None
  }
}

///|
fn field_string(value : Json, key : String) -> Result[String, MMError] {
  match json_field(value, key) {
    Some(String(s)) => Ok(s)
    _ => Err(wire_error("InputError", "Expected string field: " + key))
  }
}

///|
fn field_int(value : Json, key : String) -> Result[Int, MMError] {
  match json_field(value, key) {
    Some(Number(n, ..)) if n >= 0.0 &&
      n <= 2147483647.0 &&
      n.to_int().to_double() == n => Ok(n.to_int())
    _ =>
      Err(
        wire_error("InputError", "Expected nonnegative integer field: " + key),
      )
  }
}

///|
fn limits_from_json(value : Json) -> Result[Limits, MMError] {
  let defaults = default_limits()
  let obj = match value {
    Object(o) => o
    _ => return Err(wire_error("InputError", "limits must be an object"))
  }
  let known = [
    "max_file_bytes", "max_total_bytes", "max_include_depth", "max_tokens", "max_operations",
    "max_stack_items", "max_expression_tokens",
  ]
  for key, _ in obj {
    if !known.contains(key) {
      return Err(wire_error("InputError", "Unknown limit: " + key))
    }
  }
  let numbers = [
    defaults.max_file_bytes,
    defaults.max_total_bytes,
    defaults.max_include_depth,
    defaults.max_tokens,
    defaults.max_operations,
    defaults.max_stack_items,
    defaults.max_expression_tokens,
  ]
  for i = 0; i < known.length(); i = i + 1 {
    if obj.contains(known[i]) {
      match field_int(value, known[i]) {
        Ok(n) => numbers[i] = n
        Err(e) => return Err(e)
      }
    }
  }
  Ok({
    max_file_bytes: numbers[0],
    max_total_bytes: numbers[1],
    max_include_depth: numbers[2],
    max_tokens: numbers[3],
    max_operations: numbers[4],
    max_stack_items: numbers[5],
    max_expression_tokens: numbers[6],
  })
}

///|
fn report_json(report : MMReport) -> Json {
  jobject([
    ("complete", jbool(report.complete)),
    ("declaration_count", jnumber(report.declaration_count)),
    ("proof_count", jnumber(report.proof_count)),
    ("verified_count", jnumber(report.verified_count)),
    ("invalid_count", jnumber(report.invalid_count)),
    ("incomplete_count", jnumber(report.incomplete_count)),
    ("not_checked_count", jnumber(report.not_checked_count)),
  ])
}

///|
fn event_json(event : MMStepEvent) -> Json {
  jobject([
    ("label", jstring(event.label)),
    ("hypotheses", jstrings(event.hypotheses)),
    (
      "substitutions",
      Json::array(
        event.substitutions.map(pair => {
          jobject([
            ("variable", jstring(pair.0)),
            ("expression", jstrings(pair.1)),
          ])
        }),
      ),
    ),
    ("popped", jnumber(event.popped)),
    ("pushed", jnumber(event.pushed)),
    ("result", jstrings(event.result)),
  ])
}

///|
fn view_json(session : MMSession) -> Json {
  session_view_json(inspect_session(session))
}

///|
fn session_view_json(v : MMSessionView) -> Json {
  jobject([
    ("target_label", jstring(v.target_label)),
    ("goal", jstrings(v.goal)),
    ("state", jstring(v.state)),
    ("mode", jstring(v.mode)),
    (
      "active_hypotheses",
      Json::array(
        v.active_hypotheses.map(pair => {
          jobject([("label", jstring(pair.0)), ("expression", jstrings(pair.1))])
        }),
      ),
    ),
    ("successful_step_count", jnumber(v.successful_step_count)),
    ("stack", Json::array(v.stack.map(jstrings))),
  ])
}

///|
fn rules_json(page : MMRulePage) -> Json {
  jobject([
    (
      "rules",
      Json::array(
        page.rules.map(rule => {
          jobject([
            ("label", jstring(rule.label)),
            ("kind", jstring(rule.kind)),
            ("conclusion", jstrings(rule.conclusion)),
            (
              "mandatory_hypotheses",
              Json::array(
                rule.mandatory_hypotheses.map(h => {
                  jobject([
                    ("label", jstring(h.label)),
                    ("kind", jstring(h.kind)),
                    ("expression", jstrings(h.expression)),
                  ])
                }),
              ),
            ),
            (
              "disjoint",
              Json::array(rule.disjoint.map(p => jstrings([p.0, p.1]))),
            ),
          ])
        }),
      ),
    ),
    ("total", jnumber(page.total)),
    ("offset", jnumber(page.offset)),
  ])
}

///|
fn dispatch_request(
  engine : Engine,
  req : Json,
) -> Result[(Json, Json, Array[MMError]), MMError] {
  let wire_databases = engine.databases
  let wire_sessions = engine.sessions
  let op = match field_string(req, "operation") {
    Ok(v) => v
    Err(e) => return Err(e)
  }
  let allowed = match op {
    "load" => ["entry", "sources", "limits"]
    "verify" | "list" => ["database_id", "limits"]
    "unload_database" => ["database_id"]
    "start" | "replay" => ["database_id", "target_label", "limits"]
    "rules" =>
      ["database_id", "target_label", "query", "typecode", "offset", "limit"]
    "create_goal" =>
      ["database_id", "context_label", "new_label", "goal", "limits"]
    "apply_label" | "preview" => ["session_id", "label"]
    "rewind" => ["session_id", "successful_step_count"]
    "export" => ["session_id", "new_label"]
    "inspect" | "finish" | "close_session" => ["session_id"]
    "reset" => []
    _ => return Err(wire_error("InputError", "Unknown operation: " + op))
  }
  let object = match req {
    Object(o) => o
    _ => return Err(wire_error("InputError", "Request must be object"))
  }
  for key, _ in object {
    if key != "schema_version" &&
      key != "request_id" &&
      key != "operation" &&
      !allowed.contains(key) {
      return Err(wire_error("InputError", "Unknown field: " + key))
    }
  }
  let limits = match json_field(req, "limits") {
    None => default_limits()
    Some(v) =>
      match limits_from_json(v) {
        Ok(l) => l
        Err(e) => return Err(e)
      }
  }
  if op == "reset" {
    wire_databases.clear()
    wire_sessions.clear()
    return Ok((Json::null(), Json::null(), []))
  }
  if op == "load" {
    if wire_databases.length() >= 16 {
      return Err(
        wire_error(
          "ResourceLimit", "Database handle limit reached; reset context",
        ),
      )
    }
    let entry = match field_string(req, "entry") {
      Ok(v) => v
      Err(e) => return Err(e)
    }
    let items = match json_field(req, "sources") {
      Some(Array(a)) => a
      _ => return Err(wire_error("InputError", "sources must be an array"))
    }
    let sources : Array[(String, String)] = []
    for item in items {
      match item {
        Object(fields) =>
          for key, _ in fields {
            if key != "source_id" && key != "text" {
              return Err(
                wire_error("InputError", "Unknown source field: " + key),
              )
            }
          }
        _ =>
          return Err(wire_error("InputError", "Each source must be an object"))
      }
      let source = match field_string(item, "source_id") {
        Ok(v) => v
        Err(e) => return Err(e)
      }
      let text = match field_string(item, "text") {
        Ok(v) => v
        Err(e) => return Err(e)
      }
      sources.push((source, text))
    }
    let db = match parse_sources_with_limits(entry, sources, limits) {
      Ok(v) => v
      Err(e) => return Err(e)
    }
    let id = next_wire_id("db-")
    wire_databases[id] = db
    return Ok(
      (
        jobject([
          ("database_id", jstring(id)),
          ("declaration_count", jnumber(db.statements.length())),
          ("verified_count", jnumber(0)),
        ]),
        Json::null(),
        [],
      ),
    )
  }
  if [
      "verify", "list", "start", "replay", "rules", "create_goal", "unload_database",
    ].contains(op) {
    let id = match field_string(req, "database_id") {
      Ok(v) => v
      Err(e) => return Err(e)
    }
    let db = match wire_databases.get(id) {
      Some(v) => v
      None =>
        return Err(
          wire_error("UnknownDatabase", "Unknown or expired database handle"),
        )
    }
    if op == "unload_database" {
      for _, (owner, _) in wire_sessions {
        if owner == id {
          return Err(
            wire_error(
              "DatabaseInUse", "Close all sessions before unloading their database",
            ),
          )
        }
      }
      wire_databases.remove(id)
      return Ok((Json::null(), Json::null(), []))
    }
    if op == "rules" {
      let target = match field_string(req, "target_label") {
        Ok(v) => v
        Err(e) => return Err(e)
      }
      let query = match json_field(req, "query") {
        None => ""
        Some(_) =>
          match field_string(req, "query") {
            Ok(v) => v
            Err(e) => return Err(e)
          }
      }
      let typecode = match json_field(req, "typecode") {
        None => ""
        Some(_) =>
          match field_string(req, "typecode") {
            Ok(v) => v
            Err(e) => return Err(e)
          }
      }
      let offset = match json_field(req, "offset") {
        None => 0
        Some(_) =>
          match field_int(req, "offset") {
            Ok(v) => v
            Err(e) => return Err(e)
          }
      }
      let limit = match json_field(req, "limit") {
        None => 20
        Some(_) =>
          match field_int(req, "limit") {
            Ok(v) => v
            Err(e) => return Err(e)
          }
      }
      let page = match
        search_rules(db, target, query, typecode, offset, limit) {
        Ok(p) => p
        Err(e) => return Err(e)
      }
      return Ok((rules_json(page), Json::null(), []))
    }
    if op == "create_goal" {
      if wire_databases.length() >= 16 {
        return Err(
          wire_error(
            "ResourceLimit", "Database handle limit reached; reset context",
          ),
        )
      }
      let context = match field_string(req, "context_label") {
        Ok(v) => v
        Err(e) => return Err(e)
      }
      let label = match field_string(req, "new_label") {
        Ok(v) => v
        Err(e) => return Err(e)
      }
      let goal : Array[String] = []
      match json_field(req, "goal") {
        Some(Array(tokens)) =>
          for token in tokens {
            match token {
              String(s) => goal.push(s)
              _ =>
                return Err(
                  wire_error("InputError", "goal must be an array of strings"),
                )
            }
          }
        _ =>
          return Err(
            wire_error("InputError", "goal must be an array of strings"),
          )
      }
      let created = match create_goal(db, context, label, goal, limits) {
        Ok(c) => c
        Err(e) => return Err(e)
      }
      let id = next_wire_id("db-")
      wire_databases[id] = created.database
      return Ok(
        (
          jobject([
            ("database_id", jstring(id)),
            ("target_label", jstring(created.target_label)),
            ("entry", jstring(created.entry)),
            (
              "sources",
              Json::array(
                created.sources.map(p => {
                  jobject([("source_id", jstring(p.0)), ("text", jstring(p.1))])
                }),
              ),
            ),
            ("goal", jstrings(created.goal)),
            (
              "active_hypotheses",
              Json::array(
                created.active_hypotheses.map(p => {
                  jobject([
                    ("label", jstring(p.0)),
                    ("expression", jstrings(p.1)),
                  ])
                }),
              ),
            ),
            (
              "disjoint",
              Json::array(created.disjoint.map(p => jstrings([p.0, p.1]))),
            ),
          ]),
          Json::null(),
          [],
        ),
      )
    }
    if op == "verify" {
      let report = verify_database(db, limits)
      return Ok(
        (report_json(report), jstring(report.outcome), report.diagnostics),
      )
    }
    if op == "list" {
      let theorems : Array[Json] = []
      for decl in db.statements {
        if decl.kind == "$p" {
          theorems.push(
            jobject([
              ("label", jstring(decl.label)),
              ("decl_id", jnumber(decl.order)),
              ("status", jstring(decl.status)),
              ("goal", jstrings(decl.expression)),
              ("proof", jstrings(decl.proof)),
            ]),
          )
        }
      }
      return Ok(
        (jobject([("theorems", Json::array(theorems))]), Json::null(), []),
      )
    }
    let target = match field_string(req, "target_label") {
      Ok(v) => v
      Err(e) => return Err(e)
    }
    if op == "replay" {
      let session = match replay_proof(db, target, limits) {
        Ok(v) => v
        Err(e) => return Err(e)
      }
      return Ok(
        (
          jobject([
            ("view", view_json(session)),
            ("events", Json::array(session.events.map(event_json))),
            ("mode", jstring("replay")),
          ]),
          jstring("valid"),
          [],
        ),
      )
    }
    if wire_sessions.length() >= 64 {
      return Err(
        wire_error(
          "ResourceLimit", "Session handle limit reached; reset context",
        ),
      )
    }
    let session = match start_proof(db, target, limits) {
      Ok(v) => v
      Err(e) => return Err(e)
    }
    let sid = next_wire_id("session-")
    wire_sessions[sid] = (id, session)
    return Ok(
      (
        jobject([("session_id", jstring(sid)), ("view", view_json(session))]),
        Json::null(),
        [],
      ),
    )
  }
  let sid = match field_string(req, "session_id") {
    Ok(v) => v
    Err(e) => return Err(e)
  }
  let session = match wire_sessions.get(sid) {
    Some((_, v)) => v
    None =>
      return Err(
        wire_error("UnknownSession", "Unknown or expired session handle"),
      )
  }
  if op == "close_session" {
    wire_sessions.remove(sid)
    return Ok((Json::null(), Json::null(), []))
  }
  if op == "apply_label" || op == "preview" {
    let label = match field_string(req, "label") {
      Ok(v) => v
      Err(e) => return Err(e)
    }
    if op == "preview" {
      let (event, view) = match preview_label(session, label) {
        Ok(p) => p
        Err(e) => return Err(e)
      }
      return Ok(
        (
          jobject([
            ("event", event_json(event)),
            ("view", session_view_json(view)),
          ]),
          Json::null(),
          [],
        ),
      )
    }
    let event = match apply_label(session, label) {
      Ok(v) => v
      Err(e) => return Err(e)
    }
    return Ok(
      (
        jobject([("event", event_json(event)), ("view", view_json(session))]),
        Json::null(),
        [],
      ),
    )
  }
  if op == "rewind" {
    let n = match field_int(req, "successful_step_count") {
      Ok(v) => v
      Err(e) => return Err(e)
    }
    match rewind(session, n) {
      Ok(_) => ()
      Err(e) => return Err(e)
    }
    return Ok((jobject([("view", view_json(session))]), Json::null(), []))
  }
  if op == "finish" {
    match finish(session) {
      Ok(_) => ()
      Err(e) => return Err(e)
    }
    return Ok((jobject([("view", view_json(session))]), jstring("valid"), []))
  }
  if op == "export" {
    let label = match field_string(req, "new_label") {
      Ok(v) => v
      Err(e) => return Err(e)
    }
    let result = match export_normal_proof(session, label) {
      Ok(v) => v
      Err(e) => return Err(e)
    }
    return Ok(
      (
        jobject([
          ("text", jstring(result.text)),
          ("new_label", jstring(result.new_label)),
          ("source_ids", jstrings(result.source_ids)),
        ]),
        jstring("valid"),
        [],
      ),
    )
  }
  Ok((jobject([("view", view_json(session))]), Json::null(), []))
}

///|
/// Process one schema-version-1 request; contexts are local to this instance.
pub fn dispatch_json(request : String) -> String {
  dispatch_engine(default_engine, request)
}

///|
/// Process one schema-version-1 request in an explicitly owned context.
pub fn dispatch_engine(engine : Engine, request : String) -> String {
  let req = @json.parse(request) catch {
    _ =>
      return wire_response(
          "unknown",
          "",
          Json::null(),
          Json::null(),
          [wire_error("InputError", "Malformed JSON")],
          false,
        )
        |> wire_stringify
  }
  let op = match json_field(req, "operation") {
    Some(String(v)) => v
    _ => "unknown"
  }
  let id = match json_field(req, "request_id") {
    Some(String(v)) => v
    _ =>
      return wire_response(
          op,
          "",
          Json::null(),
          Json::null(),
          [wire_error("InputError", "request_id must be a string")],
          false,
        )
        |> wire_stringify
  }
  if json_field(req, "schema_version") != Some(Json::number(1.0)) {
    return wire_response(
        op,
        id,
        Json::null(),
        Json::null(),
        [wire_error("InputError", "schema_version must equal 1")],
        false,
      )
      |> wire_stringify
  }
  match dispatch_request(engine, req) {
    Ok((data, outcome, diagnostics)) =>
      wire_response(op, id, data, outcome, diagnostics, true) |> wire_stringify
    Err(e) =>
      wire_response(
        op,
        id,
        Json::null(),
        if is_resource_limit(e.code) {
          jstring("resource_limit")
        } else {
          Json::null()
        },
        [e],
        false,
      )
      |> wire_stringify
  }
}
