///|
pub(all) struct MMReport {
  outcome : String
  complete : Bool
  declaration_count : Int
  proof_count : Int
  verified_count : Int
  invalid_count : Int
  incomplete_count : Int
  not_checked_count : Int
  diagnostics : Array[MMError]
}

///|
fn execute_proof(session : MMSession) -> Result[Unit, MMError] {
  let target = session.db.statements[session.target_index]
  if !target.proof.is_empty() && target.proof[0] == "(" {
    return execute_compressed(session, target.proof)
  }
  // Validate every label before executing up to the first unknown step.
  // An unknown marker does not make malformed labels or forward references legal.
  for label in target.proof {
    if label != "?" {
      match checked_label(session, label) {
        Ok(_) => ()
        Err(err) => return Err(err)
      }
    }
  }
  for label in target.proof {
    if label == "?" {
      return Err(proof_error(target, "IncompleteProof", "Proof contains ?"))
    }
    match execute_op(session, ApplyLabel(label)) {
      Ok(_) => ()
      Err(err) => return Err(err)
    }
  }
  Ok(())
}

///|
pub fn verify_database(db : MMDatabase, limits : Limits) -> MMReport {
  if !valid_limits(limits) {
    let proof_count = db.statements.filter(decl => decl.kind == "$p").length()
    return {
      outcome: "resource_limit",
      complete: false,
      declaration_count: db.statements.length(),
      proof_count,
      verified_count: 0,
      invalid_count: 0,
      incomplete_count: 0,
      not_checked_count: proof_count,
      diagnostics: [
        {
          code: "invalid_limits",
          message: "Limits must be nonnegative Int values",
          source: db.entry,
          start: 0,
          end: 0,
          line: 1,
          column: 1,
        },
      ],
    }
  }
  let diagnostics : Array[MMError] = []
  let mut verified_count = 0
  let mut invalid_count = 0
  let mut incomplete_count = 0
  let mut not_checked_count = 0
  let mut resource_limit = false
  let mut operations = 0
  for decl in db.statements {
    if decl.kind == "$p" {
      decl.status = "not_checked"
    }
  }
  for index = 0; index < db.statements.length(); index = index + 1 {
    let decl = db.statements[index]
    if decl.kind != "$p" {
      continue
    }
    if resource_limit {
      not_checked_count = not_checked_count + 1
      continue
    }
    let remaining = {
      ..limits,
      max_operations: limits.max_operations - operations,
    }
    let session = new_session(db, index, remaining, "verify")
    let result = match execute_proof(session) {
      Err(err) => Err(err)
      Ok(_) =>
        match finish(session) {
          Err(err) => Err(err)
          Ok(_) => Ok(())
        }
    }
    operations = operations + session.operations
    match result {
      Ok(_) => {
        decl.status = "verified"
        verified_count = verified_count + 1
      }
      Err(err) => {
        diagnostics.push(err)
        if err.code == "ResourceLimit" {
          resource_limit = true
          not_checked_count = not_checked_count + 1
        } else if err.code == "IncompleteProof" {
          decl.status = "incomplete"
          incomplete_count = incomplete_count + 1
        } else if err.code == "UnverifiedDependency" {
          not_checked_count = not_checked_count + 1
        } else {
          decl.status = "invalid"
          invalid_count = invalid_count + 1
        }
      }
    }
  }
  let outcome = if resource_limit {
    "resource_limit"
  } else if invalid_count > 0 {
    "invalid"
  } else if incomplete_count > 0 || not_checked_count > 0 {
    "incomplete"
  } else {
    "valid"
  }
  {
    outcome,
    complete: outcome == "valid",
    declaration_count: db.statements.length(),
    proof_count: verified_count +
    invalid_count +
    incomplete_count +
    not_checked_count,
    verified_count,
    invalid_count,
    incomplete_count,
    not_checked_count,
    diagnostics,
  }
}
