// Compressed opcodes use the exact same checked executor as ordinary proofs.
// Based on mmverify.py (MIT), Copyright (C) 2002 Raph Levien;
// David A. Wheeler and mmverify.py contributors.

///|
fn execute_compressed(
  session : MMSession,
  proof : Array[String],
) -> Result[Unit, MMError] {
  let target = session.db.statements[session.target_index]
  let labels = target.hypotheses.copy()
  let mut at = 1
  while at < proof.length() && proof[at] != ")" {
    if target.hypotheses.contains(proof[at]) {
      return Err(
        proof_error(
          target, "MandatoryLabelInCompressedTable", "Mandatory hypotheses must use their implicit compressed proof indices",
        ),
      )
    }
    // Reject unused bad labels as well as bad labels actually reached later.
    match checked_label(session, proof[at]) {
      Ok(_) => ()
      Err(err) => return Err(err)
    }
    labels.push(proof[at])
    at = at + 1
  }
  if at >= proof.length() {
    return Err(
      proof_error(
        target, "UnclosedCompressedLabels", "Missing ) in compressed label block",
      ),
    )
  }
  at = at + 1
  // Validate the entire encoded stream before any unknown marker stops replay.
  // In particular U? is an unfinished number and ?! contains an illegal byte.
  let mut syntax_prefix = 0
  let mut syntax_characters = 0
  for chunk_index = at
      chunk_index < proof.length()
      chunk_index = chunk_index + 1 {
    let chunk = proof[chunk_index]
    for i = 0; i < chunk.length(); i = i + 1 {
      if syntax_characters >= session.limits.max_operations {
        return Err(
          proof_error(
            target, "ResourceLimit", "Compressed character limit exceeded",
          ),
        )
      }
      syntax_characters = syntax_characters + 1
      let ch = chunk.code_unit_at(i).to_int()
      if ch >= 65 && ch <= 84 {
        let digit = ch - 64
        if syntax_prefix > (2147483647 - digit) / 20 {
          return Err(
            proof_error(
              target, "CompressedIntegerOverflow", "Compressed proof integer overflow",
            ),
          )
        }
        syntax_prefix = 0
      } else if ch >= 85 && ch <= 89 {
        let digit = ch - 84
        if syntax_prefix > (2147483647 - digit) / 5 {
          return Err(
            proof_error(
              target, "CompressedIntegerOverflow", "Compressed proof integer overflow",
            ),
          )
        }
        syntax_prefix = 5 * syntax_prefix + digit
      } else if ch == 90 || ch == 63 {
        if syntax_prefix != 0 {
          return Err(
            proof_error(
              target, "DanglingCompressedPrefix", "Z or ? cannot interrupt an integer prefix",
            ),
          )
        }
      } else {
        return Err(
          proof_error(
            target, "InvalidCompressedCharacter", "Compressed proof contains a character outside A-Z or ?",
          ),
        )
      }
    }
  }
  if syntax_prefix != 0 {
    return Err(
      proof_error(
        target, "DanglingCompressedPrefix", "Compressed proof ends with an integer prefix",
      ),
    )
  }
  let mut accumulator = 0
  let mut decoded_characters = 0
  while at < proof.length() {
    let chunk = proof[at]
    for i = 0; i < chunk.length(); i = i + 1 {
      if decoded_characters >= session.limits.max_operations {
        return Err(
          proof_error(
            target, "ResourceLimit", "Compressed character limit exceeded",
          ),
        )
      }
      decoded_characters = decoded_characters + 1
      let ch = chunk.code_unit_at(i).to_int()
      if ch >= 65 && ch <= 84 {
        let digit = ch - 64
        if accumulator > (2147483647 - digit) / 20 {
          return Err(
            proof_error(
              target, "CompressedIntegerOverflow", "Compressed proof integer overflow",
            ),
          )
        }
        let number = 20 * accumulator + digit
        accumulator = 0
        let op = if number <= labels.length() {
          ApplyLabel(labels[number - 1])
        } else {
          ReuseSaved(number - labels.length() - 1)
        }
        match execute_op(session, op) {
          Ok(_) => ()
          Err(err) => return Err(err)
        }
      } else if ch >= 85 && ch <= 89 {
        let digit = ch - 84
        if accumulator > (2147483647 - digit) / 5 {
          return Err(
            proof_error(
              target, "CompressedIntegerOverflow", "Compressed proof integer overflow",
            ),
          )
        }
        accumulator = 5 * accumulator + digit
      } else if ch == 90 {
        if accumulator != 0 {
          return Err(
            proof_error(
              target, "DanglingCompressedPrefix", "Z cannot interrupt an integer prefix",
            ),
          )
        }
        match execute_op(session, SaveTop) {
          Ok(_) => ()
          Err(err) => return Err(err)
        }
      } else if ch == 63 {
        return Err(proof_error(target, "IncompleteProof", "Proof contains ?"))
      } else {
        return Err(
          proof_error(
            target, "InvalidCompressedCharacter", "Compressed proof contains a character outside A-Z or ?",
          ),
        )
      }
    }
    at = at + 1
  }
  if accumulator != 0 {
    return Err(
      proof_error(
        target, "DanglingCompressedPrefix", "Compressed proof ends with an integer prefix",
      ),
    )
  }
  Ok(())
}
