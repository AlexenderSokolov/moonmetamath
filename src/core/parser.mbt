///|
priv struct MMParseState {
  env : MMEnv
  sources : Map[String, String]
  visited : Map[String, Bool]
  limits : Limits
  mut token_count : Int
}

///|
/// Normalize logical relative source names; return None for paths escaping the bundle root.
fn normalize_source_id(name : String) -> String? {
  if name == "" ||
    name.has_prefix("/") ||
    name.contains("\\") ||
    name.contains(":") {
    return None
  }
  let parts : Array[String] = []
  for item in name.split("/") {
    let part = item.to_owned()
    if part == "." || part == "" {
      continue
    }
    if part == ".." {
      if parts.length() == 0 {
        return None
      }
      ignore(parts.pop())
    } else {
      parts.push(part)
    }
  }
  if parts.length() == 0 {
    None
  } else {
    Some(parts.join("/"))
  }
}

///|
fn resolve_source_id(source : String, included : String) -> String? {
  if included.has_prefix("/") ||
    included.contains("\\") ||
    included.contains(":") {
    return None
  }
  let parts = source.split("/").map(p => p.to_owned()).collect()
  ignore(parts.pop())
  normalize_source_id(
    if parts.length() == 0 {
      included
    } else {
      parts.join("/") + "/" + included
    },
  )
}

///|
fn source_start(source : String) -> MMToken {
  { text: "", source, start: 0, end: 0, line: 1, column: 1, }
}

///|
fn parse_file(
  state : MMParseState,
  source : String,
  depth : Int,
  include_at : MMToken,
) -> Result[Unit, MMError] {
  if state.visited.contains(source) {
    return Ok(())
  }
  if depth > state.limits.max_include_depth {
    return Err(
      token_error(
        include_at, "resource_limit", "Include depth exceeds max_include_depth",
      ),
    )
  }
  let text = match state.sources.get(source) {
    Some(text) => text
    None =>
      return Err(
        token_error(
          include_at,
          "missing_source",
          "Source is absent from bundle: " + source,
        ),
      )
  }
  state.visited.set(source, true)
  let tokens = match scan_source(source, text, state.limits) {
    Ok(tokens) => tokens
    Err(error) => return Err(error)
  }
  if tokens.length() > state.limits.max_tokens - state.token_count {
    return Err(
      token_error(include_at, "resource_limit", "Bundle exceeds max_tokens"),
    )
  }
  state.token_count = state.token_count + tokens.length()
  let env = state.env
  let scopes : Array[(Int, Int, Int, MMToken)] = []
  let mut i = 0
  while i < tokens.length() {
    let first = tokens[i]
    let mut kind = first.text
    let mut label = ""
    i = i + 1
    if kind == "$[" {
      if scopes.length() != 0 {
        return Err(
          token_error(
            first, "include_in_scope", "Includes are allowed only at top level",
          ),
        )
      }
      if i + 1 >= tokens.length() ||
        tokens[i + 1].text != "$]" ||
        tokens[i].text.contains("$") {
        return Err(
          token_error(
            first, "invalid_include", "Include requires one filename followed by $] in the same source",
          ),
        )
      }
      let included = match resolve_source_id(source, tokens[i].text) {
        Some(name) => name
        None =>
          return Err(
            token_error(
              tokens[i],
              "invalid_source_id",
              "Include path must remain inside the logical bundle root",
            ),
          )
      }
      match parse_file(state, included, depth + 1, tokens[i]) {
        Ok(_) => ()
        Err(error) => return Err(error)
      }
      i = i + 2
      continue
    }
    if kind == "${" {
      match add_decl(env, "", kind, [], [], first, first) {
        Err(e) => return Err(e)
        Ok(_) => ()
      }
      scopes.push(
        (
          env.variables.length(),
          env.hypotheses.length(),
          env.disjoint.length(),
          first,
        ),
      )
      continue
    }
    if kind == "$}" {
      match scopes.pop() {
        None =>
          return Err(
            token_error(
              first, "unexpected_scope_end", "Scope closes outside this source",
            ),
          )
        Some((v, h, d, _)) => {
          if env.variables.length() > v {
            env.variables_snapshot = None
          }
          while env.variables.length() > v {
            ignore(env.variables.pop())
          }
          if env.hypotheses.length() > h {
            env.hypotheses_snapshot = None
          }
          while env.hypotheses.length() > h {
            ignore(env.hypotheses.pop())
          }
          if env.disjoint.length() > d {
            env.disjoint_snapshot = None
          }
          while env.disjoint.length() > d {
            ignore(env.disjoint.pop())
          }
        }
      }
      match add_decl(env, "", kind, [], [], first, first) {
        Err(e) => return Err(e)
        Ok(_) => ()
      }
      continue
    }
    if !kind.has_prefix("$") {
      label = kind
      if i >= tokens.length() {
        return Err(
          token_error(
            first, "unclosed_declaration", "Label must precede a declaration in the same source",
          ),
        )
      }
      kind = tokens[i].text
      i = i + 1
      if kind != "$f" && kind != "$e" && kind != "$a" && kind != "$p" {
        return Err(
          token_error(
            first, "invalid_declaration", "Labels precede $f, $e, $a, or $p",
          ),
        )
      }
    } else if kind != "$c" && kind != "$v" && kind != "$d" {
      return Err(
        token_error(first, "unexpected_keyword", "Unexpected keyword: " + kind),
      )
    }
    let expression : Array[String] = []
    let proof : Array[String] = []
    let mut in_proof = false
    while i < tokens.length() && tokens[i].text != "$." {
      let token = tokens[i]
      if token.text == "$=" && kind == "$p" && !in_proof {
        in_proof = true
      } else if token.text.has_prefix("$") {
        return Err(
          token_error(
            token,
            if token.text == "$[" {
              "include_in_statement"
            } else {
              "invalid_declaration"
            },
            "Unexpected keyword within declaration",
          ),
        )
      } else if in_proof {
        proof.push(token.text)
      } else {
        expression.push(token.text)
      }
      if expression.length() > state.limits.max_expression_tokens {
        return Err(
          token_error(
            token, "resource_limit", "Declaration exceeds max_expression_tokens",
          ),
        )
      }
      i = i + 1
    }
    if i >= tokens.length() {
      return Err(
        token_error(
          first, "unclosed_declaration", "Declaration is not terminated in this source",
        ),
      )
    }
    let last = tokens[i]
    i = i + 1
    if kind == "$p" && (!in_proof || proof.length() == 0) {
      return Err(
        token_error(
          first, "missing_proof", "$p requires $= and a nonempty proof",
        ),
      )
    }
    if kind == "$c" || kind == "$v" {
      if expression.length() == 0 {
        return Err(
          token_error(
            first, "empty_declaration", "Symbol declaration cannot be empty",
          ),
        )
      }
      if kind == "$c" && scopes.length() != 0 {
        return Err(
          token_error(
            first, "constant_in_scope", "Constants are declared only at top level",
          ),
        )
      }
      for symbol in expression {
        if env.labels.contains(symbol) {
          return Err(
            token_error(
              first, "namespace_collision", "Mathematical symbol is already a label",
            ),
          )
        }
        if kind == "$c" {
          if env.constants.contains(symbol) ||
            env.ever_variables.contains(symbol) {
            return Err(
              token_error(
                first, "duplicate_symbol", "Constant conflicts with an existing mathematical symbol",
              ),
            )
          }
          env.constants.set(symbol, true)
        } else {
          if env.constants.contains(symbol) || env.variables.contains(symbol) {
            return Err(
              token_error(
                first, "duplicate_symbol", "Variable conflicts with an active mathematical symbol",
              ),
            )
          }
          env.ever_variables.set(symbol, true)
          env.variables.push(symbol)
          env.variables_snapshot = None
        }
      }
    } else if kind == "$d" {
      if expression.length() < 2 {
        return Err(
          token_error(
            first, "invalid_disjoint", "$d requires at least two distinct active variables",
          ),
        )
      }
      for a in 0..<expression.length() {
        if !env.variables.contains(expression[a]) {
          return Err(
            token_error(
              first, "invalid_disjoint", "$d requires active variables",
            ),
          )
        }
        for b in (a + 1)..<expression.length() {
          if expression[a] == expression[b] {
            return Err(
              token_error(
                first, "invalid_disjoint", "$d variables must be distinct",
              ),
            )
          }
          let pair = pair_canonical(expression[a], expression[b])
          if !env.disjoint.contains(pair) {
            env.disjoint.push(pair)
            env.disjoint_snapshot = None
          }
        }
      }
    } else if kind == "$f" {
      if expression.length() != 2 {
        return Err(
          token_error(
            first, "invalid_floating", "$f requires a typecode and one variable",
          ),
        )
      }
      if !env.constants.contains(expression[0]) {
        return Err(
          token_error(
            first, "invalid_typecode", "$f typecode must be a constant",
          ),
        )
      }
      let variable = expression[1]
      if !env.variables.contains(variable) {
        return Err(
          token_error(
            first, "undeclared_symbol", "$f requires an active variable",
          ),
        )
      }
      if active_f(env, variable) is Some(_) {
        return Err(
          token_error(
            first, "duplicate_floating", "Variable already has an active $f",
          ),
        )
      }
      match env.variable_types.get(variable) {
        Some(previous) =>
          if previous != expression[0] {
            return Err(
              token_error(
                first, "variable_type_conflict", "A variable cannot change its global typecode",
              ),
            )
          }
        None => env.variable_types.set(variable, expression[0])
      }
    } else {
      match check_expression(env, expression, first) {
        Err(e) => return Err(e)
        Ok(_) => ()
      }
    }
    match add_decl(env, label, kind, expression, proof, first, last) {
      Err(e) => return Err(e)
      Ok(_) => ()
    }
  }
  if scopes.length() != 0 {
    return Err(
      token_error(
        scopes[scopes.length() - 1].3,
        "unclosed_scope",
        "Scope is not terminated within this source",
      ),
    )
  }
  Ok(())
}

///|
pub fn parse_sources(
  entry : String,
  sources : Array[(String, String)],
) -> Result[MMDatabase, MMError] {
  parse_sources_with_limits(entry, sources, default_limits())
}

///|
pub fn parse_sources_with_limits(
  entry : String,
  sources : Array[(String, String)],
  limits : Limits,
) -> Result[MMDatabase, MMError] {
  let entry_token = source_start(entry)
  if !valid_limits(limits) {
    return Err(
      token_error(
        entry_token, "invalid_limits", "Limits must be nonnegative integers",
      ),
    )
  }
  let entry = match normalize_source_id(entry) {
    Some(name) => name
    None =>
      return Err(
        token_error(
          entry_token, "invalid_source_id", "Invalid logical entry source",
        ),
      )
  }
  let files : Map[String, String] = Map([])
  let normalized : Array[(String, String)] = []
  let mut total = 0
  for pair in sources {
    let source = match normalize_source_id(pair.0) {
      Some(name) => name
      None =>
        return Err(
          token_error(
            source_start(pair.0),
            "invalid_source_id",
            "Invalid logical source name",
          ),
        )
    }
    if files.contains(source) {
      return Err(
        token_error(
          source_start(source),
          "duplicate_source",
          "Duplicate canonical source name",
        ),
      )
    }
    if pair.1.length() > limits.max_total_bytes - total {
      return Err(
        token_error(
          source_start(source),
          "resource_limit",
          "Bundle exceeds max_total_bytes",
        ),
      )
    }
    total = total + pair.1.length()
    files.set(source, pair.1)
    normalized.push((source, pair.1))
  }
  let env = new_env()
  let state : MMParseState = {
    env,
    sources: files,
    visited: Map([]),
    limits,
    token_count: 0,
  }
  match parse_file(state, entry, 0, entry_token) {
    Err(error) => Err(error)
    Ok(_) =>
      Ok({
        statements: env.statements,
        labels: env.labels,
        entry,
        sources: normalized,
      })
  }
}
