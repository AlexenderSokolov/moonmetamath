///|
test "export preserves prefix scope and verifies candidate" {
  let session = session_fixture(
    "$c wff |- $. $v p $. wp $f wff p $. ${ ep $e |- p $. ax $a |- p $. th $p |- p $= wp ep ax $. $} future $p |- p $= ? $.",
    "th",
  )
  assert_true(export_normal_proof(session, "candidate") is Err(_))
  assert_applied(session, "wp")
  assert_applied(session, "ep")
  assert_applied(session, "ax")
  assert_true(finish(session) is Ok(_))
  let exported = match export_normal_proof(session, "candidate") {
    Ok(value) => value
    Err(err) => abort(err.message)
  }
  let candidate = proof_fixture(exported.text)
  assert_false(candidate.labels.contains("th"))
  assert_false(candidate.labels.contains("future"))
  assert_true(candidate.labels.contains("ep"))
  assert_eq(verify_database(candidate, default_limits()).outcome, "valid")
  assert_true(export_normal_proof(session, "wp") is Err(_))
  assert_true(export_normal_proof(session, "bad label") is Err(_))
}

///|
test "replay cannot export" {
  let db = proof_fixture("$c |- $. ax $a |- $. th $p |- $= ( ax ) A $.")
  let _ = verify_database(db, default_limits())
  let replay = match replay_proof(db, "th", default_limits()) {
    Ok(s) => s
    Err(err) => abort(err.message)
  }
  assert_eq(replay.state, "complete")
  assert_true(export_normal_proof(replay, "candidate") is Err(_))
  assert_true(apply_label(replay, "ax") is Err(_))
}
