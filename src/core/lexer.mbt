///|
fn is_mm_space(c : Char) -> Bool {
  c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\u{000C}'
}

///|
priv struct MMScanner {
  source : String
  text : String
  limits : Limits
  mut offset : Int
  mut line : Int
  mut column : Int
  mut previous_cr : Bool
  mut comment : MMToken?
  mut token_count : Int
}

///|
fn new_scanner(
  source : String,
  text : String,
  limits : Limits,
) -> Result[MMScanner, MMError] {
  let eof : MMToken = {
    text: "",
    source,
    start: 0,
    end: 0,
    line: 1,
    column: 1,
  }
  if !valid_limits(limits) {
    return Err(
      token_error(eof, "invalid_limits", "Limits must be nonnegative integers"),
    )
  }
  if text.length() > limits.max_file_bytes {
    return Err(
      token_error(eof, "resource_limit", "Source exceeds max_file_bytes"),
    )
  }
  let mut line = 1
  let mut column = 1
  let mut previous_cr = false
  let mut offset = 0
  // Validate before tokenization, including comments. Accepted characters are ASCII.
  for c in text.iter() {
    if (c.to_int() < 32 && !is_mm_space(c)) || c.to_int() > 126 {
      return Err({
        code: "invalid_ascii",
        message: "Expected printable ASCII or standard whitespace",
        source,
        start: offset,
        end: offset + 1,
        line,
        column,
      })
    }
    if c == '\r' {
      line = line + 1
      column = 1
    } else if c == '\n' {
      if !previous_cr {
        line = line + 1
      }
      column = 1
    } else {
      column = column + 1
    }
    previous_cr = c == '\r'
    offset = offset + 1
  }
  Ok({
    source,
    text,
    limits,
    offset: 0,
    line: 1,
    column: 1,
    previous_cr: false,
    comment: None,
    token_count: 0,
  })
}

///|
fn scan_next(scanner : MMScanner) -> Result[MMToken?, MMError] {
  let source = scanner.source
  let text = scanner.text
  let mut i = scanner.offset
  let mut line = scanner.line
  let mut column = scanner.column
  let mut previous_cr = scanner.previous_cr
  // Every code unit is now ASCII, so direct indexing needs no character buffer.
  while i < text.length() {
    let c = text[i].unsafe_to_char()
    if is_mm_space(c) {
      if c == '\r' {
        line = line + 1
        column = 1
      } else if c == '\n' {
        if !previous_cr {
          line = line + 1
        }
        column = 1
      } else {
        column = column + 1
      }
      previous_cr = c == '\r'
      i = i + 1
      continue
    }
    let start = i
    let start_column = column
    while i < text.length() && !is_mm_space(text[i].unsafe_to_char()) {
      i = i + 1
      column = column + 1
    }
    previous_cr = false
    let word = text[start:i].to_owned()
    let token : MMToken = {
      text: word,
      source,
      start,
      end: i,
      line,
      column: start_column,
    }
    if word == "$(" {
      if scanner.comment is Some(_) {
        return Err(token_error(token, "nested_comment", "Comments cannot nest"))
      }
      scanner.comment = Some(token)
      continue
    }
    if word == "$)" {
      if scanner.comment is None {
        return Err(
          token_error(token, "unexpected_comment_end", "No comment is open"),
        )
      }
      scanner.comment = None
      continue
    }
    if scanner.comment is Some(_) {
      if word.contains("$(") {
        return Err(
          token_error(
            token, "nested_comment", "Comment contents cannot contain $(",
          ),
        )
      }
      if word.contains("$)") {
        return Err(
          token_error(
            token, "invalid_comment", "Comment contents cannot contain embedded $)",
          ),
        )
      }
      continue
    }
    if word.contains("$") {
      match word {
        "$c"
        | "$v"
        | "$f"
        | "$e"
        | "$d"
        | "$a"
        | "$p"
        | "$."
        | "$="
        | "${"
        | "$}"
        | "$["
        | "$]" => ()
        _ =>
          return Err(
            token_error(
              token, "invalid_keyword", "Unknown or unseparated dollar keyword",
            ),
          )
      }
    }
    if scanner.token_count >= scanner.limits.max_tokens {
      return Err(
        token_error(token, "resource_limit", "Source exceeds max_tokens"),
      )
    }
    scanner.offset = i
    scanner.line = line
    scanner.column = column
    scanner.previous_cr = previous_cr
    scanner.token_count = scanner.token_count + 1
    return Ok(Some(token))
  }
  scanner.offset = i
  match scanner.comment {
    Some(opening) =>
      Err(
        token_error(
          opening, "unclosed_comment", "Comment is not terminated in this source",
        ),
      )
    None => Ok(None)
  }
}

///|
pub fn scan_source(
  source : String,
  text : String,
  limits : Limits,
) -> Result[Array[MMToken], MMError] {
  let scanner = match new_scanner(source, text, limits) {
    Ok(scanner) => scanner
    Err(error) => return Err(error)
  }
  let tokens : Array[MMToken] = []
  while true {
    match scan_next(scanner) {
      Ok(Some(token)) => tokens.push(token)
      Ok(None) => break
      Err(error) => return Err(error)
    }
  }
  Ok(tokens)
}

///|
// Lexical errors and this source's full token count precede declaration parsing
// and includes. Rewind only private cursor state, without retaining token objects.
fn prepare_scanner(
  source : String,
  text : String,
  limits : Limits,
) -> Result[(MMScanner, Int), MMError] {
  let scanner = match new_scanner(source, text, limits) {
    Ok(scanner) => scanner
    Err(error) => return Err(error)
  }
  while true {
    match scan_next(scanner) {
      Ok(Some(_)) => ()
      Ok(None) => break
      Err(error) => return Err(error)
    }
  }
  let count = scanner.token_count
  scanner.offset = 0
  scanner.line = 1
  scanner.column = 1
  scanner.previous_cr = false
  scanner.comment = None
  scanner.token_count = 0
  Ok((scanner, count))
}
