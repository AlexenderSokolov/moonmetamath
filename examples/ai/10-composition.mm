$c wff |- ( ) -> $.
$v ph ps ch $.
wph $f wff ph $.
wps $f wff ps $.
wch $f wff ch $.
wi $a wff ( ph -> ps ) $.
${
compose-left $e |- ( ph -> ps ) $.
compose-right $e |- ( ps -> ch ) $.
compose $a |- ( ph -> ch ) $.
$}
${
given-left $e |- ( ph -> ps ) $.
given-right $e |- ( ps -> ch ) $.
goal $p |- ( ph -> ch ) $= ? $.
$}
