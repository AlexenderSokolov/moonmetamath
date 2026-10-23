// Shared execution engine for ordinary proofs, compressed proofs, and sessions.
// Adapted from mmverify.py (MIT), Copyright (C) 2002 Raph Levien;
// David A. Wheeler and mmverify.py contributors. See THIRD_PARTY notices.

///|
priv enum ProofOp {
  ApplyLabel(String)
  SaveTop
  ReuseSaved(Int)
}

///|
pub(all) struct MMStepEvent {
  label : String
  hypotheses : Array[String]
  substitutions : Array[(String, Array[String])]
  popped : Int
  pushed : Int
  result : Array[String]
}

///|
fn proof_error(target : MMDecl, code : String, message : String) -> MMError {
  {
    code,
    message: target.label + ": " + message,
    source: target.source,
    start: target.start,
    end: target.end,
    line: target.line,
    column: target.column,
  }
}

///|
fn checked_label(
  session : MMSession,
  label : String,
) -> Result[MMDecl, MMError] {
  let target = session.db.statements[session.target_index]
  let index = match session.db.labels.get(label) {
    Some(index) => index
    None =>
      return Err(
        proof_error(target, "UnknownLabel", "Unknown proof label " + label),
      )
  }
  let decl = session.db.statements[index]
  if decl.order >= target.order {
    return Err(
      proof_error(
        target,
        "ForwardReference",
        "A proof cannot use itself or a future label: " + label,
      ),
    )
  }
  if decl.kind == "$f" || decl.kind == "$e" {
    if !target.active_hypotheses.contains(label) {
      return Err(
        proof_error(
          target,
          "InactiveHypothesis",
          "Hypothesis is not active: " + label,
        ),
      )
    }
  } else if decl.kind == "$p" {
    if decl.status != "verified" {
      return Err(
        proof_error(
          target,
          "UnverifiedDependency",
          "Prior theorem is not verified: " + label,
        ),
      )
    }
  } else if decl.kind != "$a" {
    return Err(
      proof_error(
        target,
        "InvalidLabelKind",
        "Label is not a proof step: " + label,
      ),
    )
  }
  Ok(decl)
}

// Retained trace metadata is separately bounded. Verification never needs a trace.
// Count each event label, hypothesis label, substitution variable/value, and result
// token against max_tokens; use subtraction to avoid signed integer overflow.

///|
fn event_retention_budget(
  session : MMSession,
  result : Array[String],
  substitutions : Array[(String, Array[String])],
  hypotheses : Int,
) -> Result[Int, MMError] {
  if session.mode == "verify" {
    return Ok(session.retained_tokens)
  }
  let target = session.db.statements[session.target_index]
  let mut remaining = session.limits.max_tokens - session.retained_tokens
  if remaining < 1 {
    return Err(
      proof_error(
        target, "ResourceLimit", "Retained proof-event token limit exceeded",
      ),
    )
  }
  remaining = remaining - 1
  if hypotheses > remaining {
    return Err(
      proof_error(
        target, "ResourceLimit", "Retained proof-event token limit exceeded",
      ),
    )
  }
  remaining = remaining - hypotheses
  for pair in substitutions {
    if remaining < 1 {
      return Err(
        proof_error(
          target, "ResourceLimit", "Retained proof-event token limit exceeded",
        ),
      )
    }
    remaining = remaining - 1
    if pair.1.length() > remaining {
      return Err(
        proof_error(
          target, "ResourceLimit", "Retained proof-event token limit exceeded",
        ),
      )
    }
    remaining = remaining - pair.1.length()
  }
  if result.length() > remaining {
    return Err(
      proof_error(
        target, "ResourceLimit", "Retained proof-event token limit exceeded",
      ),
    )
  }
  remaining = remaining - result.length()
  Ok(session.limits.max_tokens - remaining)
}

// All validation, allocation bounds, substitution, and DV checks precede mutation.

///|
fn execute_op(
  session : MMSession,
  op : ProofOp,
) -> Result[MMStepEvent, MMError] {
  let target = session.db.statements[session.target_index]
  if session.state != "open" {
    return Err(
      proof_error(
        target, "SessionClosed", "Rewind before editing a completed session",
      ),
    )
  }
  if session.operations >= session.limits.max_operations {
    return Err(
      proof_error(target, "ResourceLimit", "Proof operation limit exceeded"),
    )
  }
  let mut retained_tokens = session.retained_tokens
  let event = match op {
    SaveTop => {
      if session.stack.is_empty() {
        return Err(
          proof_error(target, "EmptySave", "Z requires a nonempty proof stack"),
        )
      }
      if session.saved.length() >= session.limits.max_stack_items {
        return Err(
          proof_error(
            target, "ResourceLimit", "Saved-expression limit exceeded",
          ),
        )
      }
      let expr = session.stack[session.stack.length() - 1].copy()
      retained_tokens = match event_retention_budget(session, expr, [], 0) {
        Ok(value) => value
        Err(err) => return Err(err)
      }
      session.saved.push(expr)
      {
        label: "save_top",
        hypotheses: [],
        substitutions: [],
        popped: 0,
        pushed: 0,
        result: expr.copy(),
      }
    }
    ReuseSaved(index) => {
      if index < 0 || index >= session.saved.length() {
        return Err(
          proof_error(
            target, "InvalidSavedReference", "Compressed proof references an unavailable saved expression",
          ),
        )
      }
      if session.stack.length() >= session.limits.max_stack_items {
        return Err(
          proof_error(target, "ResourceLimit", "Proof stack limit exceeded"),
        )
      }
      let expr = session.saved[index].copy()
      retained_tokens = match event_retention_budget(session, expr, [], 0) {
        Ok(value) => value
        Err(err) => return Err(err)
      }
      session.stack.push(expr)
      {
        label: "reuse_saved",
        hypotheses: [],
        substitutions: [],
        popped: 0,
        pushed: 1,
        result: expr.copy(),
      }
    }
    ApplyLabel(label) => {
      let decl = match checked_label(session, label) {
        Ok(decl) => decl
        Err(err) => return Err(err)
      }
      if decl.kind == "$f" || decl.kind == "$e" {
        if session.stack.length() >= session.limits.max_stack_items ||
          decl.expression.length() > session.limits.max_expression_tokens {
          return Err(
            proof_error(
              target, "ResourceLimit", "Proof stack or expression limit exceeded",
            ),
          )
        }
        retained_tokens = match
          event_retention_budget(session, decl.expression, [], 0) {
          Ok(value) => value
          Err(err) => return Err(err)
        }
        session.stack.push(decl.expression.copy())
        {
          label,
          hypotheses: [],
          substitutions: [],
          popped: 0,
          pushed: 1,
          result: decl.expression.copy(),
        }
      } else {
        let count = decl.hypotheses.length()
        let base = session.stack.length() - count
        if base < 0 {
          return Err(
            proof_error(
              target,
              "StackUnderflow",
              "Not enough mandatory hypotheses for " + label,
            ),
          )
        }
        let subst : Map[String, Array[String]] = Map([])
        let substitutions : Array[(String, Array[String])] = []
        // Construct all floating substitutions before checking any essential.
        // Stack positions still follow the original interleaved declaration order.
        for i = 0; i < count; i = i + 1 {
          let hyp = session.db.statements[session.db.labels[decl.hypotheses[i]]]
          if hyp.kind == "$f" {
            let entry = session.stack[base + i]
            if entry.is_empty() || entry[0] != hyp.expression[0] {
              return Err(
                proof_error(
                  target,
                  "TypecodeMismatch",
                  "Floating hypothesis typecode mismatch for " + hyp.label,
                ),
              )
            }
            let replacement = Array::makei(entry.length() - 1, j => entry[j + 1])
            subst[hyp.expression[1]] = replacement
            substitutions.push((hyp.expression[1], replacement.copy()))
          }
        }
        for i = 0; i < count; i = i + 1 {
          let hyp = session.db.statements[session.db.labels[decl.hypotheses[i]]]
          if hyp.kind == "$e" {
            let expected = match
              bounded_substitute(
                hyp.expression,
                subst,
                session.limits.max_expression_tokens,
                target,
              ) {
              Ok(value) => value
              Err(err) => return Err(err)
            }
            if session.stack[base + i] != expected {
              return Err(
                proof_error(
                  target,
                  "EssentialMismatch",
                  "Essential hypothesis mismatch for " + hyp.label,
                ),
              )
            }
          }
        }
        for pair in decl.disjoint {
          let left = match subst.get(pair.0) {
            Some(expr) => expr
            None =>
              return Err(
                proof_error(
                  target, "MissingSubstitution", "Missing mandatory variable substitution",
                ),
              )
          }
          let right = match subst.get(pair.1) {
            Some(expr) => expr
            None =>
              return Err(
                proof_error(
                  target, "MissingSubstitution", "Missing mandatory variable substitution",
                ),
              )
          }
          let left_vars = expr_variables(left, target.active_variables)
          let right_vars = expr_variables(right, target.active_variables)
          for x in left_vars {
            for y in right_vars {
              if x == y || !has_disjoint(target.active_disjoint, x, y) {
                return Err(
                  proof_error(
                    target,
                    "DisjointViolation",
                    "Disjoint variable condition violated for " + x + ", " + y,
                  ),
                )
              }
            }
          }
        }
        let result = match
          bounded_substitute(
            decl.expression,
            subst,
            session.limits.max_expression_tokens,
            target,
          ) {
          Ok(value) => value
          Err(err) => return Err(err)
        }
        if base >= session.limits.max_stack_items {
          return Err(
            proof_error(target, "ResourceLimit", "Proof stack limit exceeded"),
          )
        }
        retained_tokens = match
          event_retention_budget(session, result, substitutions, count) {
          Ok(value) => value
          Err(err) => return Err(err)
        }
        while session.stack.length() > base {
          let _ = session.stack.pop()
        }
        session.stack.push(result)
        {
          label,
          hypotheses: decl.hypotheses.copy(),
          substitutions,
          popped: count,
          pushed: 1,
          result: result.copy(),
        }
      }
    }
  }
  session.operations = session.operations + 1
  if session.mode != "verify" {
    session.retained_tokens = retained_tokens
    session.events.push({
      label: event.label,
      hypotheses: event.hypotheses.copy(),
      substitutions: event.substitutions.map(pair => (pair.0, pair.1.copy())),
      popped: event.popped,
      pushed: event.pushed,
      result: event.result.copy(),
    })
  }
  Ok(event)
}
