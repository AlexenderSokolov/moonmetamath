// Semantics adapted from mmverify.py, pinned 63a2aa3815cd5bf67892dbfc7f2048cbb177524c.
// Copyright (C) 2002 Raph Levien; David A. Wheeler and mmverify.py contributors.
// SPDX-License-Identifier: MIT

///|
fn bounded_substitute(
  expr : Array[String],
  subst : Map[String, Array[String]],
  limit : Int,
  target : MMDecl,
) -> Result[Array[String], MMError] {
  let result : Array[String] = []
  for token in expr {
    match subst.get(token) {
      Some(replacement) => {
        if replacement.length() > limit - result.length() {
          return Err(
            proof_error(
              target, "ResourceLimit", "Expression token limit exceeded",
            ),
          )
        }
        for item in replacement {
          result.push(item)
        }
      }
      None => {
        if result.length() >= limit {
          return Err(
            proof_error(
              target, "ResourceLimit", "Expression token limit exceeded",
            ),
          )
        }
        result.push(token)
      }
    }
  }
  Ok(result)
}

///|
fn expr_variables(
  expr : Array[String],
  active : Array[String],
) -> Array[String] {
  let vars : Array[String] = []
  for token in expr {
    if active.contains(token) && !vars.contains(token) {
      vars.push(token)
    }
  }
  vars
}

///|
fn has_disjoint(
  pairs : Array[(String, String)],
  x : String,
  y : String,
) -> Bool {
  pairs.any(pair => (pair.0 == x && pair.1 == y) || (pair.0 == y && pair.1 == x))
}
