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
