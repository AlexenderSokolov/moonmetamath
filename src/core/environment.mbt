///|
priv struct MMEnv {
  constants : Map[String, Bool]
  ever_variables : Map[String, Bool]
  variable_types : Map[String, String]
  variables : Array[String]
  hypotheses : Array[Int]
  disjoint : Array[(String, String)]
  statements : Array[MMDecl]
  labels : Map[String, Int]
}

///|
fn new_env() -> MMEnv {
  {
    constants: Map([]),
    ever_variables: Map([]),
    variable_types: Map([]),
    variables: [],
    hypotheses: [],
    disjoint: [],
    statements: [],
    labels: Map([]),
  }
}

///|
fn valid_label(label : String) -> Bool {
  if label == "" {
    return false
  }
  for c in label.iter() {
    if !((c >= 'A' && c <= 'Z') ||
      (c >= 'a' && c <= 'z') ||
      (c >= '0' && c <= '9') ||
      c == '-' ||
      c == '_' ||
      c == '.') {
      return false
    }
  }
  true
}

///|
fn pair_canonical(a : String, b : String) -> (String, String) {
  if a < b {
    (a, b)
  } else {
    (b, a)
  }
}

///|
fn active_f(env : MMEnv, variable : String) -> Int? {
  for idx in env.hypotheses {
    let h = env.statements[idx]
    if h.kind == "$f" && h.expression[1] == variable {
      return Some(idx)
    }
  }
  None
}

///|
fn check_expression(
  env : MMEnv,
  expression : Array[String],
  token : MMToken,
) -> Result[Unit, MMError] {
  if expression.length() == 0 {
    return Err(
      token_error(
        token, "empty_expression", "Expression requires a constant typecode",
      ),
    )
  }
  if !env.constants.contains(expression[0]) {
    return Err(
      token_error(
        token, "invalid_typecode", "Expression must start with an active constant typecode",
      ),
    )
  }
  for symbol in expression {
    if env.variables.contains(symbol) && active_f(env, symbol) is None {
      return Err(
        token_error(
          token,
          "missing_floating",
          "Variable lacks an active floating hypothesis: " + symbol,
        ),
      )
    }
    if !env.constants.contains(symbol) && !env.variables.contains(symbol) {
      return Err(
        token_error(
          token,
          "undeclared_symbol",
          "Expression uses undeclared or inactive symbol: " + symbol,
        ),
      )
    }
  }
  Ok(())
}

///|
fn add_decl(
  env : MMEnv,
  label : String,
  kind : String,
  expression : Array[String],
  proof : Array[String],
  first : MMToken,
  last : MMToken,
) -> Result[Unit, MMError] {
  if label != "" {
    if !valid_label(label) {
      return Err(
        token_error(
          first, "invalid_label", "Labels use letters, digits, hyphen, underscore, and period",
        ),
      )
    }
    if env.labels.contains(label) {
      return Err(
        token_error(
          first,
          "duplicate_label",
          "Label already declared: " + label,
        ),
      )
    }
    if env.constants.contains(label) || env.ever_variables.contains(label) {
      return Err(
        token_error(
          first, "namespace_collision", "Label is already a mathematical symbol",
        ),
      )
    }
  }
  let mandatory : Array[String] = []
  let mandatory_d : Array[(String, String)] = []
  if kind == "$a" || kind == "$p" {
    let variables : Array[String] = []
    for symbol in expression {
      if env.variables.contains(symbol) && !variables.contains(symbol) {
        variables.push(symbol)
      }
    }
    for idx in env.hypotheses {
      let h = env.statements[idx]
      if h.kind == "$e" {
        for symbol in h.expression {
          if env.variables.contains(symbol) && !variables.contains(symbol) {
            variables.push(symbol)
          }
        }
      }
    }
    for variable in variables {
      if active_f(env, variable) is None {
        return Err(
          token_error(
            first,
            "missing_floating",
            "Mandatory variable lacks active floating hypothesis: " + variable,
          ),
        )
      }
    }
    for idx in env.hypotheses {
      let h = env.statements[idx]
      if h.kind == "$e" ||
        (h.kind == "$f" && variables.contains(h.expression[1])) {
        mandatory.push(h.label)
      }
    }
    for pair in env.disjoint {
      if variables.contains(pair.0) && variables.contains(pair.1) {
        mandatory_d.push(pair)
      }
    }
  }
  let index = env.statements.length()
  let declaration : MMDecl = {
    label,
    kind,
    expression,
    proof,
    order: index,
    hypotheses: mandatory,
    disjoint: mandatory_d,
    active_disjoint: env.disjoint.copy(),
    active_variables: env.variables.copy(),
    active_hypotheses: env.hypotheses.map(idx => env.statements[idx].label),
    status: if kind == "$p" {
      "not_checked"
    } else if kind == "$a" {
      "axiom"
    } else {
      "hypothesis"
    },
    source: first.source,
    start: first.start,
    end: last.end,
    line: first.line,
    column: first.column,
  }
  env.statements.push(declaration)
  if label != "" {
    env.labels.set(label, index)
  }
  if kind == "$f" || kind == "$e" {
    env.hypotheses.push(index)
  }
  Ok(())
}
