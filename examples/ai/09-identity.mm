$c wff |- ( ) -> $.
$v ph ps ch $.
wph $f wff ph $.
wps $f wff ps $.
wch $f wff ch $.
wi $a wff ( ph -> ps ) $.
k $a |- ( ph -> ( ps -> ph ) ) $.
s $a |- ( ( ph -> ( ps -> ch ) ) -> ( ( ph -> ps ) -> ( ph -> ch ) ) ) $.
${
mp-minor $e |- ph $.
mp-major $e |- ( ph -> ps ) $.
mp $a |- ps $.
$}
goal $p |- ( ph -> ph ) $= ? $.
