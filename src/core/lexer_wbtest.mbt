///|
fn lexer_ok(text : String) -> Array[MMToken] raise {
  match scan_source("test.mm", text, default_limits()) {
    Ok(tokens) => tokens
    Err(error) => fail(error.code + ": " + error.message)
  }
}

///|
fn lexer_code(text : String) -> String {
  match scan_source("test.mm", text, default_limits()) {
    Ok(_) => "accepted"
    Err(error) => error.code
  }
}

///|
test "lex_ascii_whitespace and CRLF spans" {
  let tokens = lexer_ok("a \tb\r\nc\u{000C}d")
  assert_eq(tokens.map(t => t.text), ["a", "b", "c", "d"])
  assert_eq(tokens[2].line, 2)
  assert_eq(tokens[2].column, 1)
  assert_eq(tokens[2].start, 6)
}

///|
test "comments suppress include and reject nested or unfinished comments" {
  assert_eq(lexer_ok("a $( $[ nope $] $) b").map(t => t.text), ["a", "b"])
  assert_eq(lexer_code("$( unfinished"), "unclosed_comment")
  assert_eq(lexer_code("$( $( $) $)"), "nested_comment")
}

///|
test "ASCII and keywords are checked" {
  assert_eq(lexer_code("é"), "invalid_ascii")
  assert_eq(lexer_code("\u{FEFF}a"), "invalid_ascii")
  assert_eq(lexer_code("\u{000B}"), "invalid_ascii")
  assert_eq(lexer_code("$z"), "invalid_keyword")
  assert_eq(lexer_code("a$b"), "invalid_keyword")
}

///|
test "scanner enforces file and token bounds" {
  let limits = { ..default_limits(), max_file_bytes: 2, }
  match scan_source("t", "abc", limits) {
    Err(error) => assert_eq(error.code, "resource_limit")
    Ok(_) => fail("oversized input accepted")
  }
  let limits = { ..default_limits(), max_tokens: 1, }
  match scan_source("t", "a b", limits) {
    Err(error) => assert_eq(error.code, "resource_limit")
    Ok(_) => fail("too many tokens accepted")
  }
}

///|
test "comment contents cannot contain embedded delimiter substrings" {
  assert_eq(lexer_code("$( text$(nested $)"), "nested_comment")
  assert_eq(lexer_code("$( text$)tail $)"), "invalid_comment")
}

///|
test "ASCII prevalidation keeps diagnostic priority and positions" {
  let limits = { ..default_limits(), max_tokens: 0, }
  for text in ["$z\r\n$( é $)", "a\r\n$( é $)"] {
    match scan_source("priority.mm", text, limits) {
      Err(error) => {
        assert_eq(error.code, "invalid_ascii")
        assert_eq(error.line, 2)
        assert_eq(error.column, 4)
        assert_eq(error.start, if text.has_prefix("$z") { 7 } else { 6 })
        assert_eq(error.end, error.start + 1)
      }
      Ok(_) => fail("invalid ASCII hidden by earlier lexical failure")
    }
  }
  match scan_source("unicode.mm", "$z 😀", default_limits()) {
    Err(error) => {
      assert_eq(error.code, "invalid_ascii")
      assert_eq(
        (error.start, error.end, error.line, error.column),
        (3, 4, 1, 4),
      )
    }
    Ok(_) => fail("non-BMP character accepted")
  }
}

///|
test "ASCII scanner preserves all whitespace spans and exact token bounds" {
  let text = "a\r\nb\rc\n\td\u{000C}e"
  let tokens = lexer_ok(text)
  assert_eq(tokens.map(t => (t.text, t.start, t.end, t.line, t.column)), [
    ("a", 0, 1, 1, 1),
    ("b", 3, 4, 2, 1),
    ("c", 5, 6, 3, 1),
    ("d", 8, 9, 4, 2),
    ("e", 10, 11, 4, 4),
  ])
  assert_eq(lexer_ok(""), [])
  let limits = { ..default_limits(), max_tokens: 5, }
  assert_eq(scan_source("test.mm", text, limits), Ok(tokens))
  let limits = { ..default_limits(), max_tokens: 4, }
  match scan_source("test.mm", text, limits) {
    Err(error) => assert_eq((error.code, error.start), ("resource_limit", 10))
    Ok(_) => fail("token bound ignored")
  }
}
