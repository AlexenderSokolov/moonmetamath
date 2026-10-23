///|
pub struct MMSession {
  priv db : MMDatabase
  priv target_index : Int
  priv limits : Limits
  priv mode : String
  priv mut state : String
  priv mut stack : Array[Array[String]]
  priv mut saved : Array[Array[String]]
  priv mut events : Array[MMStepEvent]
  priv mut labels : Array[String]
  priv mut operations : Int
}

///|
pub(all) struct MMSessionView {
  target_label : String
  goal : Array[String]
  active_hypotheses : Array[(String, Array[String])]
  state : String
  mode : String
  successful_step_count : Int
  stack : Array[Array[String]]
}

///|
fn new_session(
  db : MMDatabase,
  index : Int,
  limits : Limits,
  mode : String,
) -> MMSession {
  {
    db,
    target_index: index,
    limits,
    mode,
    state: "open",
    stack: [],
    saved: [],
    events: [],
    labels: [],
    operations: 0,
  }
}

///|
pub fn start_proof(
  db : MMDatabase,
  target_label : String,
  limits : Limits,
) -> Result[MMSession, MMError] {
  if !valid_limits(limits) {
    return Err({
      code: "invalid_limits",
      message: "Limits must be nonnegative Int values",
      source: db.entry,
      start: 0,
      end: 0,
      line: 1,
      column: 1,
    })
  }
  let index = match db.labels.get(target_label) {
    Some(index) => index
    None =>
      return Err({
        code: "UnknownTarget",
        message: "Unknown target " + target_label,
        source: db.entry,
        start: 0,
        end: 0,
        line: 1,
        column: 1,
      })
  }
  let target = db.statements[index]
  if target.kind != "$p" {
    return Err(
      proof_error(
        target, "NotTheorem", "Only existing $p targets can be reproved",
      ),
    )
  }
  for decl in db.statements {
    if decl.order >= target.order {
      break
    }
    if decl.kind == "$p" && decl.status != "verified" {
      return Err(
        proof_error(
          target,
          "UnverifiedPrefix",
          "Theorem prefix contains an unverified theorem: " + decl.label,
        ),
      )
    }
  }
  Ok(new_session(db, index, limits, "construct"))
}

///|
pub fn inspect_session(session : MMSession) -> MMSessionView {
  let target = session.db.statements[session.target_index]
  let hypotheses : Array[(String, Array[String])] = []
  for label in target.active_hypotheses {
    let decl = session.db.statements[session.db.labels[label]]
    hypotheses.push((label, decl.expression.copy()))
  }
  {
    target_label: target.label,
    goal: target.expression.copy(),
    active_hypotheses: hypotheses,
    state: session.state,
    mode: session.mode,
    successful_step_count: session.events.length(),
    stack: session.stack.map(expr => expr.copy()),
  }
}

///|
pub fn apply_label(
  session : MMSession,
  label : String,
) -> Result[MMStepEvent, MMError] {
  if session.mode != "construct" {
    return Err(
      proof_error(
        session.db.statements[session.target_index],
        "ReadOnlyReplay",
        "Replay is read-only",
      ),
    )
  }
  match execute_op(session, ApplyLabel(label)) {
    Ok(event) => {
      session.labels.push(label)
      Ok(event)
    }
    Err(err) => Err(err)
  }
}

///|
pub fn rewind(
  session : MMSession,
  successful_step_count : Int,
) -> Result[MMSessionView, MMError] {
  let target = session.db.statements[session.target_index]
  if session.mode != "construct" {
    return Err(proof_error(target, "ReadOnlyReplay", "Replay is read-only"))
  }
  if successful_step_count < 0 ||
    successful_step_count > session.labels.length() {
    return Err(
      proof_error(
        target, "InvalidRewind", "Rewind index is outside the successful action prefix",
      ),
    )
  }
  let replay = new_session(
    session.db,
    session.target_index,
    session.limits,
    "construct",
  )
  for i = 0; i < successful_step_count; i = i + 1 {
    match apply_label(replay, session.labels[i]) {
      Ok(_) => ()
      Err(err) => return Err(err)
    }
  }
  session.state = replay.state
  session.stack = replay.stack
  session.saved = replay.saved
  session.events = replay.events
  session.labels = replay.labels
  session.operations = replay.operations
  Ok(inspect_session(session))
}

///|
pub fn finish(session : MMSession) -> Result[MMSessionView, MMError] {
  let target = session.db.statements[session.target_index]
  if session.stack.is_empty() {
    return Err(
      proof_error(target, "EmptyFinalStack", "The final proof stack is empty"),
    )
  }
  if session.stack.length() != 1 {
    return Err(
      proof_error(
        target, "ExtraFinalStack", "The final proof stack must have exactly one expression",
      ),
    )
  }
  if session.stack[0] != target.expression {
    return Err(
      proof_error(
        target, "GoalMismatch", "Final expression differs from the theorem goal",
      ),
    )
  }
  session.state = "complete"
  Ok(inspect_session(session))
}

///|
pub fn replay_proof(
  db : MMDatabase,
  target_label : String,
  limits : Limits,
) -> Result[MMSession, MMError] {
  let session = match start_proof(db, target_label, limits) {
    Ok(value) => value
    Err(err) => return Err(err)
  }
  let replay = new_session(db, session.target_index, limits, "replay")
  match execute_proof(replay) {
    Ok(_) => ()
    Err(err) => return Err(err)
  }
  match finish(replay) {
    Ok(_) => Ok(replay)
    Err(err) => Err(err)
  }
}
