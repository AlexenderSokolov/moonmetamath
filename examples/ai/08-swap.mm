$c wff |- ( ) /\ $.
$v ph ps $.
wph $f wff ph $.
wps $f wff ps $.
${
pair $e |- ( ph /\ ps ) $.
swap $a |- ( ps /\ ph ) $.
$}
${
given $e |- ( ph /\ ps ) $.
goal $p |- ( ps /\ ph ) $= ? $.
$}
