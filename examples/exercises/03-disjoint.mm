$( MoonMetamath exercise 03: a disjoint-variable diagnostic.
   Self-authored teaching fixture. Dedicated to the public domain under CC0-1.0.
   https://creativecommons.org/publicdomain/zero/1.0/
   vx vx pair-rule fails: the substitutions intersect.
   vx vy pair-rule succeeds. A new goal |- pair y x uses the same context. $)
$c setvar |- pair $.
$v x y $.
vx $f setvar x $.
vy $f setvar y $.
${
  $d x y $.
  pair-rule $a |- pair x y $.
  disjoint-goal $p |- pair x y $= ? $.
$}
