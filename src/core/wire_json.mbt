///|
// 每块继续使用固定标准库转义；去掉外层引号时取得块级片段，
// 避免 JS 后端把整个大源文本保留为逐字符拼接链。
fn wire_write_string(buf : StringBuilder, text : String) -> Unit {
  if text.length() <= 4096 {
    buf.write_string(Json::string(text).stringify())
    return
  }
  buf.write_string("\"")
  let mut start = 0
  while start < text.length() {
    let mut end = if text.length() - start > 4096 {
      start + 4096
    } else {
      text.length()
    }
    // StringView 的边界保留完整 UTF-16 代理对。
    if end < text.length() {
      let before = text.code_unit_at(end - 1).to_int()
      let after = text.code_unit_at(end).to_int()
      if before >= 0xD800 &&
        before <= 0xDBFF &&
        after >= 0xDC00 &&
        after <= 0xDFFF {
        end -= 1
      }
    }
    let escaped = Json::string(text[start:end].to_owned()).stringify()
    buf.write_string(escaped[1:escaped.length() - 1].to_owned())
    start = end
  }
  buf.write_string("\"")
}

///|
// 只遍历本模块生成的响应结构；其嵌套深度由 schema 决定。
// 数字及其他标量继续使用标准库，保留原始数字表示和对象迭代顺序。
fn wire_write_json(buf : StringBuilder, value : Json) -> Unit {
  match value {
    String(text) => wire_write_string(buf, text)
    Array(values) => {
      buf.write_string("[")
      for i, item in values {
        if i > 0 {
          buf.write_string(",")
        }
        wire_write_json(buf, item)
      }
      buf.write_string("]")
    }
    Object(members) => {
      buf.write_string("{")
      let mut first = true
      for key, item in members {
        if !first {
          buf.write_string(",")
        }
        first = false
        wire_write_string(buf, key)
        buf.write_string(":")
        wire_write_json(buf, item)
      }
      buf.write_string("}")
    }
    _ => buf.write_string(value.stringify())
  }
}

///|
fn wire_stringify(value : Json) -> String {
  let buf = StringBuilder()
  wire_write_json(buf, value)
  buf.to_string()
}
