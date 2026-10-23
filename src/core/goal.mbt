///|
pub(all) struct MMCreatedGoal {
  database : MMDatabase
  target_label : String
  entry : String
  sources : Array[(String, String)]
  goal : Array[String]
  active_hypotheses : Array[(String, Array[String])]
  disjoint : Array[(String, String)]
}

///|
/// Rebuild an independent, incomplete theorem in an existing declaration context.
/// The caller controls only its label and expression; all declarations are inherited.
pub fn create_goal(
  db : MMDatabase,
  context_label : String,
  new_label : String,
  goal : Array[String],
  limits : Limits,
) -> Result[MMCreatedGoal, MMError] {
  let context = match start_proof(db, context_label, limits) {
    Ok(s) => s
    Err(e) => return Err(e)
  }
  let target = db.statements[context.target_index]
  if !valid_export_label(new_label) {
    return Err(
      proof_error(
        target, "InvalidGoalLabel", "New label must use ASCII letters, digits, period, underscore, or hyphen",
      ),
    )
  }
  if db.labels.contains(new_label) {
    return Err(
      proof_error(target, "DuplicateGoalLabel", "New label already exists"),
    )
  }
  let constants : Array[String] = []
  for decl in db.statements {
    if (decl.kind == "$c" || decl.kind == "$v") &&
      decl.expression.contains(new_label) {
      return Err(
        proof_error(
          target, "DuplicateGoalLabel", "New label conflicts with a mathematical symbol",
        ),
      )
    }
    if decl.order < target.order && decl.kind == "$c" {
      for symbol in decl.expression {
        constants.push(symbol)
      }
    }
  }
  if goal.is_empty() {
    return Err(
      proof_error(target, "InvalidGoal", "Goal expression must not be empty"),
    )
  }
  for token in goal {
    if !constants.contains(token) && !target.active_variables.contains(token) {
      return Err(
        proof_error(
          target,
          "InvalidGoal",
          "Goal contains an unknown or inactive token: " + token,
        ),
      )
    }
  }
  let (lines, depth, _) = match declaration_prefix(db, target) {
    Ok(p) => p
    Err(e) => return Err(e)
  }
  lines.push(new_label + " $p " + goal.join(" ") + " $= ? $.")
  for _ in 0..<depth {
    lines.push("$}")
  }
  let entry = "goal.mm"
  let sources = [(entry, lines.join("\n") + "\n")]
  let database = match parse_sources_with_limits(entry, sources, limits) {
    Ok(d) => d
    Err(e) => return Err(e)
  }
  let report = verify_database(database, limits)
  if report.outcome != "incomplete" ||
    report.incomplete_count != 1 ||
    report.not_checked_count != 0 ||
    report.invalid_count != 0 {
    if !report.diagnostics.is_empty() {
      return Err(report.diagnostics[0])
    }
    return Err(
      proof_error(
        target, "InvalidGoalContext", "Generated prefix did not verify",
      ),
    )
  }
  let created = match start_proof(database, new_label, limits) {
    Ok(s) => s
    Err(e) => return Err(e)
  }
  let view = inspect_session(created)
  Ok({
    database,
    target_label: new_label,
    entry,
    sources,
    goal: view.goal,
    active_hypotheses: view.active_hypotheses,
    disjoint: target.active_disjoint.copy(),
  })
}
