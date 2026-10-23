///|
/// A stable, source-local diagnostic. Offsets are ASCII byte offsets, end-exclusive.
pub struct MMError {
  code : String
  message : String
  source : String
  start : Int
  end : Int
  line : Int
  column : Int
} derive(Debug, Eq)

///|
/// A statement together with its original declaration context.
pub struct MMDecl {
  priv label : String
  priv kind : String
  priv expression : Array[String]
  priv proof : Array[String]
  priv order : Int
  priv hypotheses : Array[String]
  priv disjoint : Array[(String, String)]
  priv active_disjoint : Array[(String, String)]
  priv active_variables : Array[String]
  priv active_hypotheses : Array[String]
  priv mut status : String
  priv source : String
  priv start : Int
  priv end : Int
  priv line : Int
  priv column : Int
} derive(Debug)

///|
pub struct MMDatabase {
  priv statements : Array[MMDecl]
  priv labels : Map[String, Int]
  priv entry : String
  priv sources : Array[(String, String)]
} derive(Debug)

///|
pub struct Limits {
  max_file_bytes : Int
  max_total_bytes : Int
  max_include_depth : Int
  max_tokens : Int
  max_operations : Int
  max_stack_items : Int
  max_expression_tokens : Int
} derive(Debug, Eq)

///|
pub fn default_limits() -> Limits {
  {
    max_file_bytes: 67108864,
    max_total_bytes: 134217728,
    max_include_depth: 32,
    max_tokens: 10000000,
    max_operations: 10000000,
    max_stack_items: 100000,
    max_expression_tokens: 1000000,
  }
}

///|
pub struct MMToken {
  text : String
  source : String
  start : Int
  end : Int
  line : Int
  column : Int
} derive(Debug, Eq)

///|
fn token_error(token : MMToken, code : String, message : String) -> MMError {
  {
    code,
    message,
    source: token.source,
    start: token.start,
    end: token.end,
    line: token.line,
    column: token.column,
  }
}

///|
pub extend MMError with @debug.Debug::{to_repr}

///|
pub extend MMError with Eq::{equal, not_equal}

///|
pub extend MMDecl with @debug.Debug::{to_repr}

///|
pub extend MMDatabase with @debug.Debug::{to_repr}

///|
pub extend Limits with @debug.Debug::{to_repr}

///|
pub extend Limits with Eq::{equal, not_equal}

///|
pub extend MMToken with @debug.Debug::{to_repr}

///|
pub extend MMToken with Eq::{equal, not_equal}

///|
fn valid_limits(limits : Limits) -> Bool {
  limits.max_file_bytes >= 0 &&
  limits.max_total_bytes >= 0 &&
  limits.max_include_depth >= 0 &&
  limits.max_tokens >= 0 &&
  limits.max_operations >= 0 &&
  limits.max_stack_items >= 0 &&
  limits.max_expression_tokens >= 0
}
