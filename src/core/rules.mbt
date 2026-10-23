///|
pub(all) struct MMRuleHypothesis {
  label : String
  kind : String
  expression : Array[String]
}

///|
pub(all) struct MMRule {
  label : String
  kind : String
  conclusion : Array[String]
  mandatory_hypotheses : Array[MMRuleHypothesis]
  disjoint : Array[(String, String)]
}

///|
pub(all) struct MMRulePage {
  rules : Array[MMRule]
  total : Int
  offset : Int
}

///|
/// Discover only labels accepted by the same trust/context checks as proof steps.
pub fn search_rules(
  db : MMDatabase,
  target_label : String,
  query : String,
  typecode : String,
  offset : Int,
  limit : Int,
) -> Result[MMRulePage, MMError] {
  if offset < 0 || limit < 0 || limit > 100 {
    return Err(
      wire_error(
        "InputError", "Rule offset must be nonnegative and limit must be 0..100",
      ),
    )
  }
  let session = match start_proof(db, target_label, default_limits()) {
    Ok(s) => s
    Err(e) => return Err(e)
  }
  let target = db.statements[session.target_index]
  let rules : Array[MMRule] = []
  let mut total = 0
  for decl in db.statements {
    if decl.order >= target.order {
      break
    }
    if decl.label.is_empty() {
      continue
    }
    match checked_label(session, decl.label) {
      Err(_) => continue
      Ok(_) => ()
    }
    if !query.is_empty() &&
      !decl.label.contains(query) &&
      !decl.expression.join(" ").contains(query) {
      continue
    }
    if !typecode.is_empty() &&
      (decl.expression.is_empty() || decl.expression[0] != typecode) {
      continue
    }
    if total >= offset && rules.length() < limit {
      let hypotheses : Array[MMRuleHypothesis] = []
      // Hypotheses themselves push directly and have no mandatory stack inputs.
      if decl.kind == "$a" || decl.kind == "$p" {
        for label in decl.hypotheses {
          let hyp = db.statements[db.labels[label]]
          hypotheses.push({
            label: hyp.label,
            kind: hyp.kind,
            expression: hyp.expression.copy(),
          })
        }
      }
      rules.push({
        label: decl.label,
        kind: decl.kind,
        conclusion: decl.expression.copy(),
        mandatory_hypotheses: hypotheses,
        disjoint: if decl.kind == "$a" || decl.kind == "$p" {
          decl.disjoint.copy()
        } else {
          []
        },
      })
    }
    total = total + 1
  }
  Ok({ rules, total, offset, })
}
