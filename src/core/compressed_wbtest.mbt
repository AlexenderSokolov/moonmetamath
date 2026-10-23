///|
test "compressed proof and reuse share step semantics" {
  let db = proof_fixture(
    "$c wff |- $. $v p $. wp $f wff p $. ax $a |- p $. th $p |- p $= ( ax ) AB $.",
  )
  assert_eq(verify_database(db, default_limits()).outcome, "valid")
  let reuse = proof_fixture(
    "$c wff |- $. $v p $. wp $f wff p $. ${ e1 $e |- p $. e2 $e |- p $. join $a |- p $. $} ax $a |- p $. th $p |- p $= ( ax join ) AABZDC $.",
  )
  assert_eq(verify_database(reuse, default_limits()).outcome, "valid")
}

///|
test "compressed malformed and save errors" {
  let bad : Array[String] = ["Z", "C", "U", "UZ", "a", "YYYYYYYYYYYYYYYYA"]
  for code in bad {
    let db = proof_fixture(
      "$c |- $. ax $a |- $. th $p |- $= ( ax ) " + code + " $.",
    )
    let report = verify_database(db, default_limits())
    assert_eq(report.outcome, "invalid")
    assert_eq(report.verified_count, 0)
  }
}

///|
test "compressed hidden forward labels rejected" {
  let db = proof_fixture(
    "$c |- $. ax $a |- $. th $p |- $= ( ax future ) A $. future $p |- $= ax $.",
  )
  assert_eq(verify_database(db, default_limits()).outcome, "invalid")
}

///|
test "compressed inactive hypothesis rejected" {
  let db = proof_fixture("$c |- $. ${ e $e |- $. $} th $p |- $= ( e ) A $.")
  assert_eq(verify_database(db, default_limits()).outcome, "invalid")
}

///|
test "compressed explicit table rejects mandatory hypotheses" {
  // Upstream mm-verifier-tests/verify-tests/test040.mm (CC0).
  let db = proof_fixture("$c wff $. e $e wff $. th $p wff $= ( e ) B $.")
  let report = verify_database(db, default_limits())
  assert_eq(report.outcome, "invalid")
  assert_eq(report.diagnostics[0].code, "MandatoryLabelInCompressedTable")
}
