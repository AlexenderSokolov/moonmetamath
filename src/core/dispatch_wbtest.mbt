///|
test "wire load is not verification and unknown handles are rejected" {
  let load = dispatch_json(
    "{\"schema_version\":1,\"request_id\":\"r\",\"operation\":\"load\",\"entry\":\"a.mm\",\"sources\":[{\"source_id\":\"a.mm\",\"text\":\"$c t $. a $a t $. p $p t $= a $.\"}]}",
  )
  assert_true(load.contains("\"status\":\"ok\""))
  let bad = dispatch_json(
    "{\"schema_version\":1,\"request_id\":\"r\",\"operation\":\"verify\",\"database_id\":\"missing\"}",
  )
  assert_true(bad.contains("UnknownDatabase"))
}

///|
test "wire schema and unknown fields are not silently accepted" {
  assert_true(
    dispatch_json("{\"schema_version\":2,\"operation\":\"list\"}").contains(
      "InputError",
    ),
  )
  assert_true(
    dispatch_json(
      "{\"schema_version\":1,\"operation\":\"verify\",\"database_id\":\"none\",\"trust_all\":true}",
    ).contains("InputError"),
  )
}

///|
test "wire requires request id and rejects unknown source fields" {
  assert_true(
    dispatch_json("{\"schema_version\":1,\"operation\":\"reset\"}").contains(
      "InputError",
    ),
  )
  assert_true(
    dispatch_json(
      "{\"schema_version\":1,\"request_id\":2,\"operation\":\"reset\"}",
    ).contains("InputError"),
  )
  assert_true(
    dispatch_json(
      "{\"schema_version\":1,\"request_id\":\"r\",\"operation\":\"load\",\"entry\":\"a.mm\",\"sources\":[{\"source_id\":\"a.mm\",\"text\":\"$c t $.\",\"trust_all\":true}]}",
    ).contains("InputError"),
  )
}

///|
fn lifecycle_call(
  engine : Engine,
  op : String,
  fields : Array[(String, Json)],
) -> Json {
  let request = [
    ("schema_version", jnumber(1)),
    ("request_id", jstring("lifecycle")),
    ("operation", jstring(op)),
  ]
  for field in fields {
    request.push(field)
  }
  @json.parse(dispatch_engine(engine, jobject(request).stringify())) catch {
    _ => abort("invalid response")
  }
}

///|
fn lifecycle_id(response : Json, name : String) -> String {
  match json_field(response, "data") {
    Some(data) =>
      match field_string(data, name) {
        Ok(id) => id
        Err(_) => abort(response.stringify())
      }
    None => abort(response.stringify())
  }
}

///|
fn lifecycle_load(engine : Engine) -> String {
  lifecycle_id(
    lifecycle_call(engine, "load", [
      ("entry", jstring("a.mm")),
      (
        "sources",
        Json::array([
          jobject([
            ("source_id", jstring("a.mm")),
            ("text", jstring("$c t $. a $a t $. p $p t $= a $. q $p t $= p $.")),
          ]),
        ]),
      ),
    ]),
    "database_id",
  )
}

///|
test "engine ownership reset and expired handles" {
  let first = new_engine()
  let second = new_engine()
  let a = lifecycle_load(first)
  let b = lifecycle_load(second)
  assert_false(a == b)
  assert_true(
    lifecycle_call(second, "list", [("database_id", jstring(a))])
    .stringify()
    .contains("UnknownDatabase"),
  )
  let sid = lifecycle_id(
    lifecycle_call(first, "start", [
      ("database_id", jstring(a)),
      ("target_label", jstring("p")),
    ]),
    "session_id",
  )
  assert_true(
    lifecycle_call(second, "inspect", [("session_id", jstring(sid))])
    .stringify()
    .contains("UnknownSession"),
  )
  ignore(lifecycle_call(first, "reset", []))
  let fresh = lifecycle_load(first)
  assert_false(a == fresh)
  assert_true(
    lifecycle_call(first, "list", [("database_id", jstring(a))])
    .stringify()
    .contains("UnknownDatabase"),
  )
  assert_true(
    lifecycle_call(first, "inspect", [("session_id", jstring(sid))])
    .stringify()
    .contains("UnknownSession"),
  )
  assert_true(
    lifecycle_call(second, "list", [("database_id", jstring(b))])
    .stringify()
    .contains("\"status\":\"ok\""),
  )
}

///|
test "close and unload reclaim quotas while busy unload is atomic" {
  let engine = new_engine()
  let db = lifecycle_load(engine)
  let sid = lifecycle_id(
    lifecycle_call(engine, "start", [
      ("database_id", jstring(db)),
      ("target_label", jstring("p")),
    ]),
    "session_id",
  )
  assert_true(
    lifecycle_call(engine, "unload_database", [("database_id", jstring(db))])
    .stringify()
    .contains("DatabaseInUse"),
  )
  ignore(
    lifecycle_call(engine, "apply_label", [
      ("session_id", jstring(sid)),
      ("label", jstring("a")),
    ]),
  )
  assert_true(
    lifecycle_call(engine, "finish", [("session_id", jstring(sid))])
    .stringify()
    .contains("\"outcome\":\"valid\""),
  )
  assert_true(
    lifecycle_call(engine, "unload_database", [("database_id", jstring(db))])
    .stringify()
    .contains("DatabaseInUse"),
  )
  assert_true(
    lifecycle_call(engine, "close_session", [
      ("session_id", jstring(sid)),
      ("extra", jbool(true)),
    ])
    .stringify()
    .contains("InputError"),
  )
  assert_true(
    lifecycle_call(engine, "close_session", [("session_id", jstring(sid))])
    .stringify()
    .contains("\"data\":null"),
  )
  assert_true(
    lifecycle_call(engine, "close_session", [("session_id", jstring(sid))])
    .stringify()
    .contains("UnknownSession"),
  )
  for i = 0; i < 70; i = i + 1 {
    let next = lifecycle_id(
      lifecycle_call(engine, "start", [
        ("database_id", jstring(db)),
        ("target_label", jstring("p")),
      ]),
      "session_id",
    )
    assert_false(next == sid)
    ignore(
      lifecycle_call(engine, "close_session", [("session_id", jstring(next))]),
    )
  }
  ignore(
    lifecycle_call(engine, "unload_database", [("database_id", jstring(db))]),
  )
  assert_true(
    lifecycle_call(engine, "list", [("database_id", jstring(db))])
    .stringify()
    .contains("UnknownDatabase"),
  )
  for i = 0; i < 20; i = i + 1 {
    let next = lifecycle_load(engine)
    ignore(
      lifecycle_call(engine, "unload_database", [("database_id", jstring(next))]),
    )
  }
}

///|
test "both resource diagnostic spellings have resource outcome" {
  let engine = new_engine()
  let response = lifecycle_call(engine, "load", [
    ("entry", jstring("a.mm")),
    (
      "sources",
      Json::array([
        jobject([("source_id", jstring("a.mm")), ("text", jstring("$c t $."))]),
      ]),
    ),
    ("limits", jobject([("max_file_bytes", jnumber(0))])),
  ])
  assert_true(response.stringify().contains("\"outcome\":\"resource_limit\""))
  assert_true(response.stringify().contains("\"code\":\"resource_limit\""))
  let db = lifecycle_load(engine)
  for i = 0; i < 64; i = i + 1 {
    ignore(
      lifecycle_id(
        lifecycle_call(engine, "start", [
          ("database_id", jstring(db)),
          ("target_label", jstring("p")),
        ]),
        "session_id",
      ),
    )
  }
  let limit = lifecycle_call(engine, "start", [
    ("database_id", jstring(db)),
    ("target_label", jstring("p")),
  ]).stringify()
  assert_true(limit.contains("\"code\":\"ResourceLimit\""))
  assert_true(limit.contains("\"outcome\":\"resource_limit\""))
}

///|
test "database quota is reclaimed and lifecycle fields remain strict" {
  let engine = new_engine()
  let handles : Array[String] = []
  for i = 0; i < 16; i = i + 1 {
    handles.push(lifecycle_load(engine))
  }
  assert_true(
    lifecycle_call(engine, "load", []).stringify().contains("ResourceLimit"),
  )
  let db = handles[0]
  assert_true(
    lifecycle_call(engine, "unload_database", [
      ("database_id", jstring(db)),
      ("limits", jobject([])),
    ])
    .stringify()
    .contains("InputError"),
  )
  assert_true(
    lifecycle_call(engine, "list", [("database_id", jstring(db))])
    .stringify()
    .contains("\"status\":\"ok\""),
  )
  ignore(
    lifecycle_call(engine, "unload_database", [("database_id", jstring(db))]),
  )
  assert_true(
    lifecycle_call(engine, "unload_database", [("database_id", jstring(db))])
    .stringify()
    .contains("UnknownDatabase"),
  )
  assert_false(lifecycle_load(engine) == db)
}

///|
test "legacy default dispatcher shares no owned resources with explicit engines" {
  let engine = new_engine()
  let db = lifecycle_load(engine)
  let legacy_load = @json.parse(
    dispatch_json(
      jobject([
        ("schema_version", jnumber(1)),
        ("request_id", jstring("legacy")),
        ("operation", jstring("load")),
        ("entry", jstring("legacy.mm")),
        (
          "sources",
          Json::array([
            jobject([
              ("source_id", jstring("legacy.mm")),
              ("text", jstring("$c t $.")),
            ]),
          ]),
        ),
      ]).stringify(),
    ),
  ) catch {
    _ => abort("legacy JSON")
  }
  let legacy_db = lifecycle_id(legacy_load, "database_id")
  assert_false(legacy_db == db)
  assert_true(
    lifecycle_call(engine, "list", [("database_id", jstring(legacy_db))])
    .stringify()
    .contains("UnknownDatabase"),
  )
  ignore(
    dispatch_json(
      "{\"schema_version\":1,\"request_id\":\"legacy\",\"operation\":\"reset\"}",
    ),
  )
  assert_true(
    lifecycle_call(engine, "list", [("database_id", jstring(db))])
    .stringify()
    .contains("\"status\":\"ok\""),
  )
}

///|
test "theorem summaries are paged and omit original proofs" {
  let engine = new_engine()
  let id = lifecycle_load(engine)
  let page = lifecycle_call(engine, "theorems", [
    ("database_id", jstring(id)),
    ("offset", jnumber(1)),
    ("limit", jnumber(1)),
  ]).stringify()
  assert_true(page.contains("\"status\":\"ok\""))
  assert_true(page.contains("\"label\":\"q\""))
  assert_false(page.contains("\"proof\""))
  assert_true(page.contains("\"total\":2"))
  let empty = lifecycle_call(engine, "theorems", [
    ("database_id", jstring(id)),
    ("limit", jnumber(0)),
  ]).stringify()
  assert_true(empty.contains("\"theorems\":[]"))
  assert_true(
    lifecycle_call(engine, "theorems", [
      ("database_id", jstring(id)),
      ("limit", jnumber(101)),
    ])
    .stringify()
    .contains("InputError"),
  )
  assert_true(
    lifecycle_call(engine, "list", [("database_id", jstring(id))])
    .stringify()
    .contains("\"proof\""),
  )
}

///|
test "theorem summary filters and rejects malformed paging" {
  let engine = new_engine()
  let id = lifecycle_load(engine)
  let filtered = lifecycle_call(engine, "theorems", [
    ("database_id", jstring(id)),
    ("query", jstring("q")),
  ]).stringify()
  assert_true(filtered.contains("\"total\":1"))
  assert_true(filtered.contains("\"label\":\"q\""))
  let beyond = lifecycle_call(engine, "theorems", [
    ("database_id", jstring(id)),
    ("offset", jnumber(99)),
  ]).stringify()
  assert_true(beyond.contains("\"theorems\":[]"))
  assert_true(beyond.contains("\"total\":2"))
  for
    field in [
      ("offset", jnumber(-1)),
      ("limit", Json::number(0.5)),
      ("query", jnumber(1)),
      ("proof", jbool(true)),
    ] {
    assert_true(
      lifecycle_call(engine, "theorems", [("database_id", jstring(id)), field])
      .stringify()
      .contains("InputError"),
    )
  }
}
