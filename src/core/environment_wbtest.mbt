///|
test "includes normalize identities ignore visited and resolve relative directories" {
  let sources = [
    (
      "root.mm", "$c wff $. $[ ./root.mm $] $[ lib/a.mm $] $[ ./lib/a.mm $] th $p wff $= ax $.",
    ),
    ("lib/a.mm", "$[ $( ignored $) ../root.mm $] ax $a wff $."),
  ]
  match parse_sources("./root.mm", sources) {
    Ok(db) => {
      assert_eq(db.labels.length(), 2)
      assert_eq(db.statements[db.labels["ax"]].source, "lib/a.mm")
      assert_true(db.labels["ax"] < db.labels["th"])
    }
    Err(e) => fail(e.code + ": " + e.message)
  }
}

///|
test "include boundaries cannot complete statements comments or scopes" {
  let cases = [
    ("$c wff", "$. ax $a wff $.", "unclosed_declaration"),
    ("$(", "", "unclosed_comment"),
    ("${", "$}", "unclosed_scope"),
  ]
  for item in cases {
    match
      parse_sources("root.mm", [
        ("root.mm", "$[ child.mm $] " + item.1),
        ("child.mm", item.0),
      ]) {
      Err(e) => assert_eq(e.code, item.2)
      Ok(_) => fail("cross-file completion was accepted")
    }
  }
  assert_eq(parse_code("${ $[ missing.mm $] $}"), "include_in_scope")
  assert_eq(parse_code("$c a $[ missing.mm $] $."), "include_in_statement")
  assert_eq(parse_code("$[ missing.mm $]"), "missing_source")
}

///|
test "disjoint frames include dummy variables and restore outer scope" {
  let db = parse_ok(
    "$c wff |- $. $v x y z $. fx $f wff x $. fy $f wff y $. fz $f wff z $. $d x y $. ${ $d x z $. ax $a |- x y $. $} bx $a |- x y $.",
  )
  let ax = db.statements[db.labels["ax"]]
  let bx = db.statements[db.labels["bx"]]
  assert_eq(ax.disjoint, [("x", "y")])
  assert_eq(ax.active_disjoint, [("x", "y"), ("x", "z")])
  assert_eq(bx.active_disjoint, [("x", "y")])
}

///|
test "variables and labels occupy distinct permanent namespaces" {
  assert_eq(parse_code("$c wff $. ${ $v x $. $} $c x $."), "duplicate_symbol")
  assert_eq(
    parse_code("$c wff $. ${ $v x $. $} x $a wff $."),
    "namespace_collision",
  )
  assert_eq(
    parse_code("$c wff $. ax $a wff $. $v ax $."),
    "namespace_collision",
  )
  assert_eq(
    parse_code("$c wff $. $v x $. fx $f wff x $. gx $f wff x $."),
    "duplicate_floating",
  )
  assert_eq(parse_code("$c wff $. $v x $. ax $a wff x $."), "missing_floating")
  assert_eq(parse_code("$c wff $. $v x $. ax $p x $= ? $."), "invalid_typecode")
}

///|
test "parse resource limits include aggregate tokens depth and source sizes" {
  let limits = { ..default_limits(), max_tokens: 5, }
  match
    parse_sources_with_limits(
      "a.mm",
      [("a.mm", "$[ b.mm $]"), ("b.mm", "$c wff $.")],
      limits,
    ) {
    Err(e) => assert_eq(e.code, "resource_limit")
    Ok(_) => fail("aggregate token limit ignored")
  }
  let limits = { ..default_limits(), max_include_depth: 0, }
  match
    parse_sources_with_limits(
      "a.mm",
      [("a.mm", "$[ b.mm $]"), ("b.mm", "")],
      limits,
    ) {
    Err(e) => assert_eq(e.code, "resource_limit")
    Ok(_) => fail("include depth limit ignored")
  }
}

///|
test "include cannot hide absolute paths behind containing directory" {
  match
    parse_sources("lib/root.mm", [
      ("lib/root.mm", "$[ /outside.mm $]"),
      ("lib/outside.mm", ""),
    ]) {
    Err(e) => assert_eq(e.code, "invalid_source_id")
    Ok(_) => fail("absolute include accepted as a relative name")
  }
}

///|
test "negative limits are rejected as configuration errors" {
  let limits = { ..default_limits(), max_total_bytes: -1, }
  match parse_sources_with_limits("a.mm", [("a.mm", "")], limits) {
    Err(e) => assert_eq(e.code, "invalid_limits")
    Ok(_) => fail("negative limit accepted")
  }
  match scan_source("a.mm", "", limits) {
    Err(e) => assert_eq(e.code, "invalid_limits")
    Ok(_) => fail("scanner accepted negative limits")
  }
}

///|
test "unchanged private context snapshots reuse storage independently" {
  let db = parse_ok(
    "$c wff |- $. $v x y $. fx $f wff x $. fy $f wff y $. a $a |- x $. b $a |- y $. ex $e |- x $. c $a |- y $. $d x y $. d $a |- y $. $d x y $. e $a |- x $. ${ $v z $. fz $f wff z $. inner $a |- z $. $} outer $a |- x $.",
  )
  let a = db.statements[db.labels["a"]]
  let b = db.statements[db.labels["b"]]
  let c = db.statements[db.labels["c"]]
  let d = db.statements[db.labels["d"]]
  let e = db.statements[db.labels["e"]]
  let inner = db.statements[db.labels["inner"]]
  let outer = db.statements[db.labels["outer"]]
  // Representation guards for the measured retained-array allocation problem.
  // Mathematical semantics never depend on physical identity.
  assert_true(physical_equal(a.active_variables, b.active_variables))
  assert_true(physical_equal(a.active_hypotheses, b.active_hypotheses))
  assert_true(physical_equal(a.active_disjoint, b.active_disjoint))
  assert_true(physical_equal(b.active_variables, c.active_variables))
  assert_false(physical_equal(b.active_hypotheses, c.active_hypotheses))
  assert_true(physical_equal(b.active_disjoint, c.active_disjoint))
  assert_true(physical_equal(c.active_variables, d.active_variables))
  assert_true(physical_equal(c.active_hypotheses, d.active_hypotheses))
  assert_false(physical_equal(c.active_disjoint, d.active_disjoint))
  assert_true(physical_equal(d.active_disjoint, e.active_disjoint))
  assert_eq(a.active_variables, ["x", "y"])
  assert_eq(a.active_hypotheses, ["fx", "fy"])
  assert_eq(a.active_disjoint, [])
  assert_eq(inner.active_variables, ["x", "y", "z"])
  assert_eq(inner.active_hypotheses, ["fx", "fy", "ex", "fz"])
  assert_eq(outer.active_variables, ["x", "y"])
  assert_eq(outer.active_hypotheses, ["fx", "fy", "ex"])
  assert_eq(outer.active_disjoint, [("x", "y")])
}

///|
test "snapshot invalidation follows nested pop and variable redeclaration" {
  let db = parse_ok(
    "$c wff |- $. $v x $. fx $f wff x $. before $a |- x $. ${ $v y $. fy $f wff y $. $d x y $. ${ $v z $. fz $f wff z $. $d y z $. deep $a |- z $. $} middle $a |- y $. $} after $a |- x $. ${ $v y $. gy $f wff y $. again $a |- y $. $} end $a |- x $.",
  )
  let deep = db.statements[db.labels["deep"]]
  let middle = db.statements[db.labels["middle"]]
  let after = db.statements[db.labels["after"]]
  let again = db.statements[db.labels["again"]]
  let end = db.statements[db.labels["end"]]
  assert_eq(deep.active_variables, ["x", "y", "z"])
  assert_eq(deep.active_hypotheses, ["fx", "fy", "fz"])
  assert_eq(deep.active_disjoint, [("x", "y"), ("y", "z")])
  assert_eq(middle.active_variables, ["x", "y"])
  assert_eq(middle.active_hypotheses, ["fx", "fy"])
  assert_eq(middle.active_disjoint, [("x", "y")])
  assert_eq(after.active_variables, ["x"])
  assert_eq(after.active_hypotheses, ["fx"])
  assert_eq(after.active_disjoint, [])
  assert_eq(again.active_variables, ["x", "y"])
  assert_eq(again.active_hypotheses, ["fx", "gy"])
  assert_eq(again.active_disjoint, [])
  assert_eq(end.active_variables, ["x"])
  assert_eq(end.active_hypotheses, ["fx"])
  assert_eq(end.active_disjoint, [])
}
