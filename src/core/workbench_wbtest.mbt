///|
test "rules obey context visibility metadata and pagination" {
  let db = proof_fixture(
    "$c wff |- $. $v x y $. fx $f wff x $. fy $f wff y $. ${ gone $e |- y $. scoped $a |- y $. $} base $a |- x $. prior $p |- x $= fx base $. ${ $d x y $. local $e |- x $. pair $a |- x y $. target $p |- x $= local $. $} future $p |- x $= fx base $.",
  )
  let _ = verify_database(db, default_limits())
  let page = match search_rules(db, "target", "", "", 0, 100) {
    Ok(p) => p
    Err(e) => abort(e.message)
  }
  assert_eq(page.rules.map(r => r.label), [
    "fx", "fy", "scoped", "base", "prior", "local", "pair",
  ])
  assert_eq(page.total, 7)
  assert_eq(page.rules[6].mandatory_hypotheses.map(h => h.label), [
    "fx", "fy", "local",
  ])
  assert_eq(page.rules[6].disjoint, [("x", "y")])
  assert_true(search_rules(db, "target", "", "", 0, 101) is Err(_))
  let filtered = match search_rules(db, "target", "|- x", "|-", 1, 2) {
    Ok(p) => p
    Err(e) => abort(e.message)
  }
  assert_eq(filtered.total, 4)
  assert_eq(filtered.offset, 1)
  assert_eq(filtered.rules.map(r => r.label), ["prior", "local"])
  let untrusted = proof_fixture("$c t $. gap $p t $= ? $. target $p t $= ? $.")
  assert_true(search_rules(untrusted, "target", "", "", 0, 20) is Err(_))
}

///|
test "preview shares executor without consuming state trace or budgets" {
  let db = proof_fixture("$c t $. ax $a t $. target $p t $= ax $.")
  let session = match
    start_proof(db, "target", {
      ..default_limits(),
      max_operations: 1,
      max_tokens: 2,
    }) {
    Ok(s) => s
    Err(e) => abort(e.message)
  }
  assert_true(preview_label(session, "missing") is Err(_))
  let (event, view) = match preview_label(session, "ax") {
    Ok(p) => p
    Err(e) => abort(e.message)
  }
  assert_eq(event.result, ["t"])
  assert_eq(view.stack, [["t"]])
  assert_eq(view.successful_step_count, 1)
  view.stack[0][0] = "corrupt"
  event.result[0] = "corrupt"
  assert_eq(session.stack, [])
  assert_eq(session.events.length(), 0)
  assert_eq(session.operations, 0)
  assert_eq(session.retained_tokens, 0)
  assert_applied(session, "ax")
  assert_true(preview_label(session, "ax") is Err(_))
  assert_eq(session.operations, 1)
  assert_true(finish(session) is Ok(_))
  assert_true(preview_label(session, "ax") is Err(_))
  assert_eq(session.state, "complete")
  assert_eq(session.events.length(), 1)
}

///|
test "preview errors preserve every counter and essential or disjoint inputs" {
  let session = session_fixture(
    "$c wff |- $. $v x y $. fx $f wff x $. fy $f wff y $. ${ $d x y $. pair $a |- x y $. $} target $p |- x x $= ? $.",
    "target",
  )
  assert_applied(session, "fx")
  assert_applied(session, "fx")
  let original = inspect_session(session)
  let retained = session.retained_tokens
  let operations = session.operations
  assert_true(preview_label(session, "pair") is Err(_))
  assert_eq(session.stack, original.stack)
  assert_eq(session.state, original.state)
  assert_eq(session.retained_tokens, retained)
  assert_eq(session.operations, operations)
  assert_eq(session.labels, ["fx", "fx"])
  assert_eq(session.events.length(), 2)
  let limited = match
    start_proof(session.db, "target", { ..default_limits(), max_tokens: 0, }) {
    Ok(s) => s
    Err(e) => abort(e.message)
  }
  assert_true(preview_label(limited, "fx") is Err(_))
  assert_eq(limited.retained_tokens, 0)
  assert_eq(limited.operations, 0)
  assert_eq(limited.events.length(), 0)
  assert_eq(limited.stack, [])
  let essential = session_fixture(
    "$c t a b $. ${ h $e t a $. rule $a t b $. $} other $a t b $. target $p t b $= ? $.",
    "target",
  )
  assert_applied(essential, "other")
  let before_essential = inspect_session(essential)
  match preview_label(essential, "rule") {
    Err(e) => assert_eq(e.code, "EssentialMismatch")
    Ok(_) => fail("Essential mismatch preview unexpectedly succeeded")
  }
  assert_eq(essential.stack, before_essential.stack)
  assert_eq(essential.operations, 1)
  assert_eq(essential.events.length(), 1)
}

///|
test "new goal inherits local context and exports independently" {
  let db = proof_fixture(
    "$c wff |- $. $v x $. fx $f wff x $. ${ $v y $. fy $f wff y $. $d x y $. local $e |- x $. target $p |- x $= local $. $} future $p |- x $= ? $.",
  )
  let _ = verify_database(db, default_limits())
  let old = match start_proof(db, "target", default_limits()) {
    Ok(s) => s
    Err(e) => abort(e.message)
  }
  let created = match
    create_goal(db, "target", "fresh", ["|-", "x"], default_limits()) {
    Ok(c) => c
    Err(e) => abort(e.message)
  }
  assert_true(!created.sources[0].1.contains("target"))
  assert_true(!created.sources[0].1.contains("future"))
  assert_true(created.sources[0].1.contains("$d x y $."))
  let session = match start_proof(created.database, "fresh", default_limits()) {
    Ok(s) => s
    Err(e) => abort(e.message)
  }
  assert_eq(inspect_session(session).active_hypotheses.map(h => h.0), [
    "fx", "fy", "local",
  ])
  assert_applied(session, "local")
  assert_true(finish(session) is Ok(_))
  let exported = match export_normal_proof(session, "finished") {
    Ok(e) => e
    Err(e) => abort(e.message)
  }
  let independent = proof_fixture(exported.text)
  assert_eq(verify_database(independent, default_limits()).outcome, "valid")
  assert_eq(inspect_session(old).stack, [])
  assert_true(db.labels.contains("target"))
  assert_true(!db.labels.contains("fresh"))
  let changed = match
    create_goal(db, "target", "different", ["wff", "y"], default_limits()) {
    Ok(c) => c
    Err(e) => abort(e.message)
  }
  let changed_session = match
    start_proof(changed.database, "different", default_limits()) {
    Ok(s) => s
    Err(e) => abort(e.message)
  }
  assert_applied(changed_session, "fy")
  assert_true(finish(changed_session) is Ok(_))
}

///|
test "new goal rejects invalid namespaces tokens and untrusted prefix" {
  let db = proof_fixture(
    "$c t a $. ${ $v x $. fx $f t x $. $} target $p t a $= ? $. future $a t a $.",
  )
  for label in ["target", "future", "t", "x", "bad name", ""] {
    assert_true(
      create_goal(db, "target", label, ["t", "a"], default_limits()) is Err(_),
    )
  }
  for
    goal in [
      [],
      ["unknown"],
      ["t", "x"],
      ["t a"],
      ["t", "a $. injected $a t a $."],
      ["a", "$="],
    ] {
    assert_true(
      create_goal(db, "target", "fresh", goal, default_limits()) is Err(_),
    )
  }
  let blocked = proof_fixture("$c t $. gap $p t $= ? $. target $p t $= ? $.")
  assert_true(
    create_goal(blocked, "target", "fresh", ["t"], default_limits()) is Err(_),
  )
  assert_true(
    create_goal(db, "target", "fresh", ["t", "a"], {
      ..default_limits(),
      max_file_bytes: 0,
    })
    is Err(_),
  )
}

///|
test "goal generation flattens includes while preserving verified earlier proofs" {
  let db = match
    parse_sources("main.mm", [
      ("main.mm", "$[ base.mm $] target $p t $= prior $. future $a t $."),
      ("base.mm", "$c t $. ax $a t $. prior $p t $= ax $."),
    ]) {
    Ok(d) => d
    Err(e) => abort(e.message)
  }
  let _ = verify_database(db, default_limits())
  let created = match
    create_goal(db, "target", "fresh", ["t"], default_limits()) {
    Ok(c) => c
    Err(e) => abort(e.message)
  }
  assert_eq(created.sources.length(), 1)
  assert_true(!created.sources[0].1.contains("$["))
  assert_true(created.sources[0].1.contains("prior $p t $= ax $."))
  assert_eq(
    created.database.statements[created.database.labels["prior"]].status,
    "verified",
  )
  let session = match start_proof(created.database, "fresh", default_limits()) {
    Ok(s) => s
    Err(e) => abort(e.message)
  }
  assert_applied(session, "prior")
  assert_true(finish(session) is Ok(_))
}

///|
test "created goal retains active disjoint constraints for substitution" {
  let db = proof_fixture(
    "$c wff |- $. $v x y $. fx $f wff x $. fy $f wff y $. ${ $d x y $. pair $a |- x y $. target $p |- x y $= fx fy pair $. $}",
  )
  let _ = verify_database(db, default_limits())
  let created = match
    create_goal(db, "target", "fresh", ["|-", "y", "x"], default_limits()) {
    Ok(c) => c
    Err(e) => abort(e.message)
  }
  assert_eq(created.disjoint, [("x", "y")])
  let session = match start_proof(created.database, "fresh", default_limits()) {
    Ok(s) => s
    Err(e) => abort(e.message)
  }
  assert_applied(session, "fy")
  assert_applied(session, "fx")
  assert_applied(session, "pair")
  assert_true(finish(session) is Ok(_))
  let exported = match export_normal_proof(session, "finished") {
    Ok(e) => e
    Err(e) => abort(e.message)
  }
  assert_eq(
    verify_database(proof_fixture(exported.text), default_limits()).outcome,
    "valid",
  )
}

///|
fn workbench_request(op : String, fields : Array[(String, Json)]) -> Json {
  let fields = fields.copy()
  fields.push(("schema_version", jnumber(1)))
  fields.push(("request_id", jstring("workbench-test")))
  fields.push(("operation", jstring(op)))
  @json.parse(dispatch_json(jobject(fields).stringify())) catch {
    _ => abort("Invalid response JSON")
  }
}

///|
fn workbench_data(response : Json) -> Json {
  match json_field(response, "data") {
    Some(value) => value
    None => abort("Missing response data")
  }
}

///|
test "wire exposes additive workbench contracts and strict inputs" {
  let db = proof_fixture(
    "$c t a $. ax $a t a $. target $p t a $= ax $. future $p t a $= ax $.",
  )
  default_engine.databases["workbench-db"] = db
  let rules = workbench_request("rules", [
    ("database_id", jstring("workbench-db")),
    ("target_label", jstring("target")),
  ])
  assert_eq(json_field(rules, "status"), Some(jstring("ok")))
  let encoded = workbench_data(rules).stringify()
  assert_true(encoded.contains("mandatory_hypotheses"))
  assert_true(!encoded.contains("proof"))
  assert_true(!encoded.contains("source"))
  assert_true(!encoded.contains("target"))
  assert_true(!encoded.contains("future"))
  for bad in [jnumber(101), jstring("20"), Json::number(-1.0)] {
    let response = workbench_request("rules", [
      ("database_id", jstring("workbench-db")),
      ("target_label", jstring("target")),
      ("limit", bad),
    ])
    assert_eq(json_field(response, "status"), Some(jstring("error")))
  }
  let created = workbench_request("create_goal", [
    ("database_id", jstring("workbench-db")),
    ("context_label", jstring("target")),
    ("new_label", jstring("fresh")),
    ("goal", jstrings(["t", "a"])),
  ])
  assert_eq(json_field(created, "status"), Some(jstring("ok")))
  let data = workbench_data(created)
  assert_eq(json_field(data, "entry"), Some(jstring("goal.mm")))
  let database_id = match field_string(data, "database_id") {
    Ok(id) => id
    Err(e) => abort(e.message)
  }
  let started = workbench_request("start", [
    ("database_id", jstring(database_id)),
    ("target_label", jstring("fresh")),
  ])
  let sid = match field_string(workbench_data(started), "session_id") {
    Ok(id) => id
    Err(e) => abort(e.message)
  }
  let preview = workbench_request("preview", [
    ("session_id", jstring(sid)),
    ("label", jstring("ax")),
  ])
  assert_eq(json_field(preview, "status"), Some(jstring("ok")))
  assert_true(workbench_data(preview).stringify().contains("\"event\""))
  let inspected = workbench_request("inspect", [("session_id", jstring(sid))])
  let view = match json_field(workbench_data(inspected), "view") {
    Some(v) => v
    None => abort("Missing view")
  }
  assert_eq(json_field(view, "successful_step_count"), Some(jnumber(0)))
  assert_eq(json_field(view, "stack"), Some(Json::array([])))
  let malformed = workbench_request("create_goal", [
    ("database_id", jstring("workbench-db")),
    ("context_label", jstring("target")),
    ("new_label", jstring("fresh2")),
    ("goal", Json::array([jnumber(1)])),
  ])
  assert_eq(json_field(malformed, "status"), Some(jstring("error")))
}
