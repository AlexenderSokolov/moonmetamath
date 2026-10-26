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

///|
test "whole file lexical failures outrank earlier declaration errors" {
  for
    text in [
      "$c wff $. bad $a wff x $. $z", "$c wff $. bad $a wff x $. $( nested$( $)",
      "$c wff $. bad $a wff x $. $( unfinished",
    ] {
    let expected = match scan_source("test.mm", text, default_limits()) {
      Err(error) => error
      Ok(_) => fail("fixture needs a late lexical failure")
    }
    match parse_sources("test.mm", [("test.mm", text)]) {
      Err(error) => assert_eq(error, expected)
      Ok(_) => fail("late lexical error hidden by declaration parsing")
    }
  }
  let limits = { ..default_limits(), max_tokens: 8, }
  let text = "$c wff $. bad $a wff x $. extra"
  let expected = match scan_source("test.mm", text, limits) {
    Err(error) => error
    Ok(_) => fail("fixture needs a late token limit")
  }
  match parse_sources_with_limits("test.mm", [("test.mm", text)], limits) {
    Err(error) => assert_eq(error, expected)
    Ok(_) => fail("token limit hidden by earlier invalid expression")
  }
}

///|
test "declaration chunks retain scopes CRLF comments and incomplete diagnostics" {
  let db = parse_ok(
    "$c wff |- $.\r\n$v x $. fx $f wff x $.\r\n${ $( $. $} ignored $) ex $e |- x $. ${ ax $a |- x $. $} th $p |- x $= ex $. $}\r\nend $a |- x $.",
  )
  assert_eq(db.statements[db.labels["ax"]].active_hypotheses, ["fx", "ex"])
  assert_eq(db.statements[db.labels["end"]].active_hypotheses, ["fx"])
  assert_eq(verify_database(db, default_limits()).outcome, "valid")
  for
    (text, code, start) in [
      ("$c wff $. ${ ax $a wff", "unclosed_declaration", 13),
      ("$c wff $. ${ ax", "unclosed_declaration", 13),
      ("$c wff $. ${ ax $a wff $.", "unclosed_scope", 10),
      ("$c wff $. $}", "unexpected_scope_end", 10),
      ("$c wff $. ${ ax $a wff $} $.", "invalid_declaration", 23),
    ] {
    match parse_sources("test.mm", [("test.mm", text)]) {
      Err(error) => assert_eq((error.code, error.start), (code, start))
      Ok(_) => fail("malformed chunk accepted")
    }
  }
}

///|
test "private parser buffer retains only one declaration or include lookahead" {
  let text = "$c wff $. ${ $[ a.mm $] ax $a wff $. $} tail"
  let (scanner, count) = match
    prepare_scanner("chunks.mm", text, default_limits()) {
    Ok(value) => value
    Err(error) => fail(error.message)
  }
  assert_eq(count, 13)
  for
    expected in [
      ["$c", "wff", "$."],
      ["${"],
      ["$[", "a.mm", "$]"],
      ["ax", "$a", "wff", "$."],
      ["$}"],
      ["tail"],
      [],
    ] {
    let tokens = match next_parse_chunk(scanner) {
      Ok(tokens) => tokens
      Err(error) => fail(error.message)
    }
    assert_eq(tokens.map(t => t.text), expected)
  }
}
