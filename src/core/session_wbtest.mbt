///|
fn session_fixture(text : String, target : String) -> MMSession {
  let db = proof_fixture(text)
  let _ = verify_database(db, default_limits())
  match start_proof(db, target, default_limits()) {
    Ok(session) => session
    Err(err) => abort(err.message)
  }
}

///|
fn assert_applied(session : MMSession, label : String) -> Unit raise {
  match apply_label(session, label) {
    Ok(_) => ()
    Err(err) => fail(err.message)
  }
}

///|
test "session failed steps atomic rewind and completion" {
  let session = session_fixture(
    "$c wff |- $. $v p $. wp $f wff p $. ax $a |- p $. th $p |- p $= wp ax $. future $p |- p $= th $.",
    "th",
  )
  let before = inspect_session(session)
  assert_true(apply_label(session, "ax") is Err(_))
  assert_eq(inspect_session(session).stack, before.stack)
  assert_eq(session.operations, 0)
  assert_true(apply_label(session, "th") is Err(_))
  assert_true(apply_label(session, "future") is Err(_))
  assert_applied(session, "wp")
  assert_eq(inspect_session(session).successful_step_count, 1)
  assert_true(finish(session) is Err(_))
  assert_eq(session.state, "open")
  assert_applied(session, "ax")
  assert_true(finish(session) is Ok(_))
  assert_true(apply_label(session, "wp") is Err(_))
  assert_true(rewind(session, 1) is Ok(_))
  assert_eq(session.state, "open")
  assert_eq(session.stack, [["wff", "p"]])
  assert_applied(session, "ax")
  assert_true(finish(session) is Ok(_))
  assert_true(rewind(session, 0) is Ok(_))
  assert_eq(session.stack.length(), 0)
  assert_true(rewind(session, 1) is Err(_))
}

///|
test "unverified prefix prevents session" {
  let db = proof_fixture("$c |- $. gap $p |- $= ? $. target $p |- $= ? $.")
  assert_true(start_proof(db, "target", default_limits()) is Err(_))
}

///|
test "resource rejection atomic" {
  let db = proof_fixture("$c |- $. ax $a |- $. th $p |- $= ax $.")
  let limits = { ..default_limits(), max_stack_items: 0, }
  let session = match start_proof(db, "th", limits) {
    Ok(s) => s
    Err(err) => abort(err.message)
  }
  assert_true(apply_label(session, "ax") is Err(_))
  assert_eq(session.operations, 0)
  assert_eq(session.stack, [])
  assert_eq(session.events.length(), 0)
}

///|
test "essential and disjoint failures leave complete state unchanged" {
  let session = session_fixture(
    "$c wff |- $. $v x y $. fx $f wff x $. fy $f wff y $. ${ $d x y $. pair $a |- x y $. $} th $p |- x x $= ? $.",
    "th",
  )
  assert_applied(session, "fx")
  assert_applied(session, "fx")
  let before = inspect_session(session)
  assert_true(apply_label(session, "pair") is Err(_))
  let after = inspect_session(session)
  assert_eq(after.stack, before.stack)
  assert_eq(after.successful_step_count, before.successful_step_count)
  assert_eq(session.operations, 2)
  assert_eq(session.events.length(), 2)
  assert_eq(session.saved.length(), 0)
}

///|
test "inspection does not expose mutable stack or goal" {
  let session = session_fixture(
    "$c |- a $. ax $a |- a $. th $p |- a $= ax $.", "th",
  )
  assert_applied(session, "ax")
  let view = inspect_session(session)
  view.stack[0][0] = "corrupt"
  view.goal[0] = "corrupt"
  assert_eq(session.stack[0][0], "|-")
  assert_true(finish(session) is Ok(_))
}

///|
test "step events do not expose internal stack or retained event log" {
  let session = session_fixture(
    "$c |- a $. ax $a |- a $. th $p |- a $= ax $.", "th",
  )
  let event = match apply_label(session, "ax") {
    Ok(event) => event
    Err(err) => abort(err.message)
  }
  event.result[0] = "corrupt"
  assert_eq(session.stack[0][0], "|-")
  assert_eq(session.events[0].result[0], "|-")
}
