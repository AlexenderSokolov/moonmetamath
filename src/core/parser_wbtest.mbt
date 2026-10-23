///|
fn parse_ok(text : String) -> MMDatabase raise {
  match parse_sources("test.mm", [("test.mm", text)]) {
    Ok(db) => db
    Err(error) => fail(error.code + ": " + error.message)
  }
}

///|
fn parse_code(text : String) -> String {
  match parse_sources("test.mm", [("test.mm", text)]) {
    Ok(_) => "accepted"
    Err(error) => error.code
  }
}

///|
test "minimal declarations retain unchecked proof and context" {
  let db = parse_ok(
    "$c wff |- $. $v x $. fx $f wff x $. ax $a |- x $. th $p |- x $= fx ax $.",
  )
  assert_eq(db.statements[db.labels["th"]].status, "not_checked")
  assert_eq(db.statements[db.labels["th"]].hypotheses, ["fx"])
}

///|
test "mandatory hypotheses preserve interleaved declaration order" {
  let db = parse_ok(
    "$c wff |- $. $v x y z $. fx $f wff x $. ex $e |- x $. fy $f wff y $. fz $f wff z $. ax $a |- y $.",
  )
  let ax = db.statements[db.labels["ax"]]
  assert_eq(ax.hypotheses, ["fx", "ex", "fy"])
  assert_eq(ax.active_hypotheses, ["fx", "ex", "fy", "fz"])
}

///|
test "invalid declarations are diagnosed" {
  assert_eq(parse_code("$c wff $. ax $a wff x $."), "undeclared_symbol")
  assert_eq(
    parse_code("$c wff $. ax $a wff $. ax $a wff $."),
    "duplicate_label",
  )
  assert_eq(parse_code("$c wff ax $. ax $a wff $."), "namespace_collision")
  assert_eq(parse_code("$c wff $. bad! $a wff $."), "invalid_label")
  assert_eq(parse_code("$c wff $. $v x $. fx $f x x $."), "invalid_typecode")
  assert_eq(parse_code("${ $c wff $. $}"), "constant_in_scope")
  assert_eq(parse_code("${"), "unclosed_scope")
  assert_eq(parse_code("$}"), "unexpected_scope_end")
}

///|
test "closed hypotheses and variables leave context but global type remains" {
  let db = parse_ok(
    "$c wff |- $. ${ $v x $. fx $f wff x $. ex $e |- x $. $} ax $a |- $.",
  )
  let ax = db.statements[db.labels["ax"]]
  assert_eq(ax.active_hypotheses, [])
  assert_eq(ax.active_variables, [])
  assert_eq(
    parse_code(
      "$c wff setvar $. $v x $. ${ fx $f wff x $. $} gx $f setvar x $.",
    ),
    "variable_type_conflict",
  )
}

///|
test "every variable in essential and assertion statements is already typed" {
  assert_eq(
    parse_code("$c wff |- $. $v x $. ex $e |- x $."),
    "missing_floating",
  )
  assert_eq(
    parse_code(
      "$c wff |- $. $v x $. ex $e |- x $. fx $f wff x $. ax $a |- x $.",
    ),
    "missing_floating",
  )
}
