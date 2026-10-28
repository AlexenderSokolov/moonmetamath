///|
test "wire JSON matches fixed serializer for every control and Unicode boundary" {
  let controls = String::from_array(Array::makei(32, i => i.unsafe_to_char()))
  let cases = [
    "",
    "plain / 中文 😀",
    "\"\\\n\r\t\u{08}\u{0C}" + controls,
    String::from_array([
      (0xD800).unsafe_to_char(),
      'x',
      (0xDC00).unsafe_to_char(),
    ]),
  ]
  for text in cases {
    for n in [0, 4094, 4095, 4096, 4097, 8191] {
      let padding = Array::make(n, "a").join("")
      let value = Json::string(padding + text + padding)
      assert_eq(wire_stringify(value), value.stringify())
    }
  }
  let pair_boundary = Array::make(4095, "a").join("") + "😀\n"
  assert_eq(
    wire_stringify(Json::string(pair_boundary)),
    Json::string(pair_boundary).stringify(),
  )
}

///|
test "wire JSON preserves nested containers keys and number representations" {
  let value = @json.parse(
    "{\"x\":[null,true,false,0,-0,1.25,1e+30,[],{}],\"quote\\\"\\\\\\n\":\"text\"}",
  ) catch {
    _ => fail("fixture JSON must parse")
  }
  assert_eq(wire_stringify(value), value.stringify())
  let long_key = Array::make(5000, "\n").join("")
  let object = jobject([(long_key, value)])
  assert_eq(wire_stringify(object), object.stringify())
}

///|
test "wire JSON preserves large strings with dense escaping" {
  for unit in ["\n", "\"", "\\", "\u{00}", "abc\n中文😀"] {
    let text = Array::make(10000, unit).join("")
    assert_eq(
      wire_stringify(Json::string(text)),
      Json::string(text).stringify(),
    )
  }
}
