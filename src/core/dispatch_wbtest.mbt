test "wire load is not verification and unknown handles are rejected" {
  let load = dispatch_json("{\"schema_version\":1,\"request_id\":\"r\",\"operation\":\"load\",\"entry\":\"a.mm\",\"sources\":[{\"source_id\":\"a.mm\",\"text\":\"$c t $. a $a t $. p $p t $= a $.\"}]}")
  assert_true(load.contains("\"status\":\"ok\""))
  let bad = dispatch_json("{\"schema_version\":1,\"request_id\":\"r\",\"operation\":\"verify\",\"database_id\":\"missing\"}")
  assert_true(bad.contains("UnknownDatabase"))
}

test "wire schema and unknown fields are not silently accepted" {
  assert_true(dispatch_json("{\"schema_version\":2,\"operation\":\"list\"}").contains("InputError"))
  assert_true(dispatch_json("{\"schema_version\":1,\"operation\":\"verify\",\"database_id\":\"none\",\"trust_all\":true}").contains("InputError"))
}
