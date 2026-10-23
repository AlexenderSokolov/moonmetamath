///|
fn proof_fixture(text : String) -> MMDatabase {
  match parse_sources("test.mm", [("test.mm", text)]) {
    Ok(db) => db
    Err(err) => abort("fixture parse: " + err.message)
  }
}

///|
test "ordinary proof and sequential trust" {
  let db = proof_fixture(
    "$c wff |- $. $v p $. wp $f wff p $. ax $a |- p $. th $p |- p $= wp ax $.",
  )
  let report = verify_database(db, default_limits())
  assert_eq(report.outcome, "valid")
  assert_eq(report.verified_count, 1)
  assert_true(report.complete)
}

///|
test "future self and unverified proof rejected" {
  let db = proof_fixture("$c |- $. bad $p |- $= later $. later $p |- $= bad $.")
  let report = verify_database(db, default_limits())
  assert_eq(report.outcome, "invalid")
  assert_eq(report.verified_count, 0)
}

///|
test "simultaneous and empty substitution" {
  let simultaneous = proof_fixture(
    "$c wff |- $. $v x y z $. fx $f wff x $. fy $f wff y $. fz $f wff z $. ax $a |- x y $. th $p |- y z $= fy fz ax $.",
  )
  assert_eq(verify_database(simultaneous, default_limits()).outcome, "valid")
  let db = proof_fixture(
    "$c wff |- $. $v x $. fx $f wff x $. empty $a wff $. ax $a |- x $. th $p |- $= empty ax $.",
  )
  assert_eq(verify_database(db, default_limits()).outcome, "valid")
}

///|
test "interleaved mandatory hypotheses" {
  let db = proof_fixture(
    "$c wff |- $. $v x y $. fx $f wff x $. ex $e |- x $. fy $f wff y $. ax $a |- y $. th $p |- y $= fx ex fy ax $.",
  )
  assert_eq(verify_database(db, default_limits()).outcome, "valid")
}

///|
test "disjoint intersection and missing context" {
  let db = proof_fixture(
    "$c wff |- $. $v x y $. fx $f wff x $. fy $f wff y $. ${ $d x y $. ax $a |- x y $. $} bad $p |- x x $= fx fx ax $.",
  )
  assert_eq(verify_database(db, default_limits()).outcome, "invalid")
  let missing = proof_fixture(
    "$c wff |- $. $v x y $. fx $f wff x $. fy $f wff y $. ${ $d x y $. ax $a |- x y $. $} bad $p |- x y $= fx fy ax $.",
  )
  assert_eq(verify_database(missing, default_limits()).outcome, "invalid")
}

///|
test "unknown proof blocks dependents" {
  let db = proof_fixture("$c |- $. gap $p |- $= ? $. blocked $p |- $= gap $.")
  let report = verify_database(db, default_limits())
  assert_eq(report.outcome, "incomplete")
  assert_eq(report.incomplete_count, 1)
  assert_eq(report.not_checked_count, 1)
  assert_false(report.complete)
}

///|
test "type essential and final-stack failures" {
  let type_bad = proof_fixture(
    "$c wff |- $. $v p $. wp $f wff p $. ax $a |- p $. wrong $a |- $. th $p |- p $= wrong ax $.",
  )
  assert_eq(
    verify_database(type_bad, default_limits()).diagnostics[0].code,
    "TypecodeMismatch",
  )
  let essential_bad = proof_fixture(
    "$c wff |- $. $v p q $. wp $f wff p $. wq $f wff q $. ax $a |- q $. ${ ep $e |- p $. infer $a |- p $. th $p |- p $= wp wq ax infer $. $}",
  )
  assert_eq(
    verify_database(essential_bad, default_limits()).diagnostics[0].code,
    "EssentialMismatch",
  )
  let two = proof_fixture("$c |- $. ax $a |- $. th $p |- $= ax ax $.")
  assert_eq(
    verify_database(two, default_limits()).diagnostics[0].code,
    "ExtraFinalStack",
  )
  let mismatch = proof_fixture("$c |- a b $. ax $a |- a $. th $p |- b $= ax $.")
  assert_eq(
    verify_database(mismatch, default_limits()).diagnostics[0].code,
    "GoalMismatch",
  )
  let underflow = proof_fixture(
    "$c wff |- $. $v p $. wp $f wff p $. ax $a |- p $. th $p |- p $= ax $.",
  )
  assert_eq(
    verify_database(underflow, default_limits()).diagnostics[0].code,
    "StackUnderflow",
  )
}

///|
test "DV active dummy variables and constant substitution" {
  // Target has no mandatory variables, but its original active DV context
  // still permits using x/y in intermediate expressions.
  let db = proof_fixture(
    "$c wff |- $. $v x y $. fx $f wff x $. fy $f wff y $. $d x y $. pair $a wff x y $. ${ fz $e wff x $. erase $a |- $. $} th $p |- $= fx fy pair fx fy pair erase $.",
  )
  assert_eq(verify_database(db, default_limits()).outcome, "valid")
  let constants = proof_fixture(
    "$c wff |- c $. $v x y $. fx $f wff x $. fy $f wff y $. cst $a wff c $. ${ $d x y $. pair $a |- x y $. $} th $p |- c c $= cst cst pair $.",
  )
  assert_eq(verify_database(constants, default_limits()).outcome, "valid")
}

///|
test "database operation limit stops without trusting remainder" {
  let db = proof_fixture(
    "$c |- $. ax $a |- $. one $p |- $= ax $. two $p |- $= one $.",
  )
  let report = verify_database(db, { ..default_limits(), max_operations: 1, })
  assert_eq(report.outcome, "resource_limit")
  assert_eq(report.verified_count, 1)
  assert_eq(report.not_checked_count, 1)
  assert_false(report.complete)
}

///|
test "native proof APIs reject negative resource limits" {
  let db = proof_fixture("$c |- $. ax $a |- $. th $p |- $= ax $.")
  let limits = { ..default_limits(), max_operations: -1, }
  let report = verify_database(db, limits)
  assert_eq(report.outcome, "resource_limit")
  assert_eq(report.verified_count, 0)
  assert_eq(report.invalid_count, 0)
  assert_eq(report.diagnostics[0].code, "invalid_limits")
  assert_true(start_proof(db, "th", limits) is Err(_))
}

///|
test "ordinary unknown marker cannot hide invalid labels" {
  for proof in ["? missing", "? th", "? later", "missing ?"] {
    let db = proof_fixture(
      "$c |- $. ax $a |- $. th $p |- $= " + proof + " $. later $p |- $= ax $.",
    )
    assert_eq(verify_database(db, default_limits()).outcome, "invalid")
  }
}

///|
test "verification does not retain event history" {
  let db = proof_fixture(
    "$c wff a $. $v x $. fx $f wff x $. seed $a wff $. grow $a wff x a $. th $p wff a a a $= seed grow grow grow $.",
  )
  let session = new_session(db, db.labels["th"], default_limits(), "verify")
  assert_true(execute_proof(session) is Ok(_))
  assert_eq(session.operations, 4)
  assert_eq(session.events.length(), 0)
}
