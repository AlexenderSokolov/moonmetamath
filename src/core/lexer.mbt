///|
fn is_mm_space(c : Char) -> Bool {
  c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\u{000C}'
}

///|
pub fn scan_source(
  source : String,
  text : String,
  limits : Limits,
) -> Result[Array[MMToken], MMError] {
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
  let chars = text.iter().collect()
  let mut line = 1
  let mut column = 1
  let mut previous_cr = false
  // Validate before tokenization, including comments. Accepted characters are ASCII.
  for i in 0..<chars.length() {
    let c = chars[i]
    if (c.to_int() < 32 && !is_mm_space(c)) || c.to_int() > 126 {
      return Err({
        code: "invalid_ascii",
        message: "Expected printable ASCII or standard whitespace",
        source,
        start: i,
        end: i + 1,
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
  }
  let tokens : Array[MMToken] = []
  let mut comment : MMToken? = None
  let mut i = 0
  line = 1
  column = 1
  previous_cr = false
  while i < chars.length() {
    if is_mm_space(chars[i]) {
      let c = chars[i]
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
    while i < chars.length() && !is_mm_space(chars[i]) {
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
      if comment is Some(_) {
        return Err(token_error(token, "nested_comment", "Comments cannot nest"))
      }
      comment = Some(token)
      continue
    }
    if word == "$)" {
      if comment is None {
        return Err(
          token_error(token, "unexpected_comment_end", "No comment is open"),
        )
      }
      comment = None
      continue
    }
    if comment is Some(_) {
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
    if tokens.length() >= limits.max_tokens {
      return Err(
        token_error(token, "resource_limit", "Source exceeds max_tokens"),
      )
    }
    tokens.push(token)
  }
  match comment {
    Some(opening) =>
      Err(
        token_error(
          opening, "unclosed_comment", "Comment is not terminated in this source",
        ),
      )
    None => Ok(tokens)
  }
}
